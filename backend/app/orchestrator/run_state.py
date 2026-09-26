from enum import StrEnum


class RunStage(StrEnum):
    QUEUED = "queued"
    PROVISIONING = "provisioning"
    SEEDING = "seeding"
    MIGRATING = "migrating"
    QUERYING = "querying"
    ANALYZING = "analyzing"
    DONE = "done"
    FAILED = "failed"