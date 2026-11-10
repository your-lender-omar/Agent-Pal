"""Load, validate and save config.json. Shared by app.py (the pet) and dashboard.py (settings UI)."""

import json
import os
from copy import deepcopy
from pathlib import Path

CONFIG_PATH = Path(__file__).resolve().parent / "config.json"

FREQUENCIES = ("frequent", "interval_10min", "only_important")
SKINS = ("skin1", "skin2", "skin3", "skin4", "skin5", "RANDOM")

DEFAULT_CONFIG = {
    "frequency": "interval_10min",
    "window_interaction": False,
    "selected_skin": "skin1",
    "custom_reminders": [
        {"name": "Water Reminder", "interval_sec": 900, "text": "Time to drink water! 💧"},
    ],
}


class ConfigError(ValueError):
    """config.json exists but its contents are invalid."""


def validate_config(data) -> dict:
    """Return a complete, checked config. Missing keys take defaults; unknown keys are dropped."""
    if not isinstance(data, dict):
        raise ConfigError("top level must be a JSON object")

    cfg = deepcopy(DEFAULT_CONFIG)
    cfg.update({key: value for key, value in data.items() if key in DEFAULT_CONFIG})

    if cfg["frequency"] not in FREQUENCIES:
        raise ConfigError(f"frequency must be one of {', '.join(FREQUENCIES)}")
    if cfg["selected_skin"] not in SKINS:
        raise ConfigError(f"selected_skin must be one of {', '.join(SKINS)}")
    if not isinstance(cfg["window_interaction"], bool):
        raise ConfigError("window_interaction must be true or false")

    reminders = cfg["custom_reminders"]
    if not isinstance(reminders, list):
        raise ConfigError("custom_reminders must be a list")
    for i, rule in enumerate(reminders):
        if not isinstance(rule, dict):
            raise ConfigError(f"custom_reminders[{i}] must be an object")
        if not isinstance(rule.get("name"), str) or not isinstance(rule.get("text"), str):
            raise ConfigError(f"custom_reminders[{i}] needs string 'name' and 'text'")
        interval = rule.get("interval_sec")
        if isinstance(interval, bool) or not isinstance(interval, int) or interval < 1:
            raise ConfigError(f"custom_reminders[{i}].interval_sec must be a whole number of seconds >= 1")

    return cfg


def load_config(path: Path = CONFIG_PATH) -> dict:
    """Read and validate config.json. If the file is missing, write the defaults and return them."""
    if not path.exists():
        return save_config(DEFAULT_CONFIG, path)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ConfigError(f"{path.name} is not valid JSON: {exc}") from exc
    return validate_config(data)


def save_config(cfg: dict, path: Path = CONFIG_PATH) -> dict:
    """Validate and write config.json atomically (write temp file, then replace)."""
    cfg = validate_config(cfg)
    tmp_path = path.with_name(path.name + ".tmp")
    tmp_path.write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(tmp_path, path)
    return cfg
