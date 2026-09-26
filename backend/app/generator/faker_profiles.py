from faker import Faker


def build_faker(seed: int = 0) -> Faker:
    faker = Faker()
    faker.seed_instance(seed)
    return faker