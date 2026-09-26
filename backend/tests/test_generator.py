from app.generator.corrupt import generate_orders


def test_generate_orders_is_deterministic_across_recreated_runs() -> None:
	first_run = list(generate_orders(row_count=64))
	second_run = list(generate_orders(row_count=64))

	assert first_run == second_run
