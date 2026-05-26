from dataclasses import dataclass, field
from typing import Any


@dataclass
class ModelStore:
    t5: Any = field(default=None, repr=False)
    t5_tokenizer: Any = field(default=None, repr=False)
    nli: Any = field(default=None, repr=False)
    nli_tokenizer: Any = field(default=None, repr=False)
    device: str = "cpu"

    # Convenience: expose as dict for modules that still expect one
    def as_dict(self) -> dict:
        return {
            "t5": self.t5,
            "t5_tokenizer": self.t5_tokenizer,
            "nli": self.nli,
            "nli_tokenizer": self.nli_tokenizer,
            "device": self.device,
        }


# Module-level singleton — populated during lifespan startup
store = ModelStore()