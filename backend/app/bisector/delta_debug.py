from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Generic, TypeVar


Item = TypeVar("Item")


@dataclass(frozen=True)
class DeltaDebugResult(Generic[Item]):
	subset: tuple[Item, ...]
	test_count: int
	trail: tuple[int, ...]


def minimize_failing_subset(
	items: Sequence[Item],
	reproduces: Callable[[Sequence[Item]], bool],
) -> DeltaDebugResult[Item]:
	"""Return a 1-minimal subset for which the failure predicate remains true."""
	current = list(items)
	test_count = 0
	trail: list[int] = []

	def test(candidate: Sequence[Item]) -> bool:
		nonlocal test_count
		test_count += 1
		result = reproduces(tuple(candidate))
		if result and (not trail or len(candidate) < trail[-1]):
			trail.append(len(candidate))
		return result

	if not current or not test(current):
		raise ValueError("The full input set must reproduce the failure.")

	granularity = 2
	while len(current) > 1:
		chunks = _partition(current, min(granularity, len(current)))
		reduced = False

		for chunk in chunks:
			if test(chunk):
				current = chunk
				granularity = max(granularity - 1, 2)
				reduced = True
				break
		if reduced:
			continue

		for index in range(len(chunks)):
			complement = [item for chunk_index, chunk in enumerate(chunks) if chunk_index != index for item in chunk]
			if complement and test(complement):
				current = complement
				granularity = max(granularity - 1, 2)
				reduced = True
				break
		if reduced:
			continue

		if granularity >= len(current):
			break
		granularity = min(len(current), granularity * 2)

	return DeltaDebugResult(subset=tuple(current), test_count=test_count, trail=tuple(trail))


def _partition(items: list[Item], part_count: int) -> list[list[Item]]:
	base_size, extra_items = divmod(len(items), part_count)
	chunks: list[list[Item]] = []
	start = 0
	for index in range(part_count):
		chunk_size = base_size + (1 if index < extra_items else 0)
		chunks.append(items[start : start + chunk_size])
		start += chunk_size
	return chunks
