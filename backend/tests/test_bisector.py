import pytest

from app.bisector.delta_debug import minimize_failing_subset


def test_minimize_failing_subset_finds_single_trigger() -> None:
	result = minimize_failing_subset(
		list(range(64)),
		lambda candidate: 17 in candidate,
	)

	assert result.subset == (17,)
	assert result.test_count < 20
	assert result.trail[0] == 64
	assert result.trail[-1] == 1
	assert all(left > right for left, right in zip(result.trail, result.trail[1:]))


def test_minimize_failing_subset_preserves_interacting_items() -> None:
	required_items = {13, 47}
	result = minimize_failing_subset(
		list(range(64)),
		lambda candidate: required_items.issubset(candidate),
	)

	assert set(result.subset) == required_items
	assert result.trail[-1] == len(required_items)


def test_minimize_failing_subset_requires_reproducible_input() -> None:
	with pytest.raises(ValueError, match="must reproduce"):
		minimize_failing_subset([1, 2, 3], lambda candidate: False)
