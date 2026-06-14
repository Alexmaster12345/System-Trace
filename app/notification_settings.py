from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

from .config import settings

_STORE_PATH = Path("data/notification_settings.json")
_lock = threading.Lock()

# field name -> type used for coercion when saving overrides
_FIELDS: dict[str, type] = {
    "slack_webhook_url": str,
    "slack_channel": str,
    "slack_alert_min_severity": str,
    "slack_alert_cooldown_seconds": int,
    "smtp_host": str,
    "smtp_port": int,
    "smtp_username": str,
    "smtp_password": str,
    "smtp_use_tls": bool,
    "smtp_from_addr": str,
    "alert_email_to": str,
    "email_alert_min_severity": str,
    "email_alert_cooldown_seconds": int,
}

SECRET_FIELDS = {"smtp_password"}


def _defaults() -> dict[str, Any]:
    return {name: getattr(settings, name) for name in _FIELDS}


def _load() -> dict[str, Any]:
    data = _defaults()
    try:
        if _STORE_PATH.exists():
            with open(_STORE_PATH) as f:
                stored = json.load(f)
            for k in _FIELDS:
                if k in stored:
                    data[k] = stored[k]
    except Exception:
        pass
    return data


def get_settings() -> dict[str, Any]:
    """Return effective notification settings (overrides merged over env defaults)."""
    with _lock:
        return _load()


def get_value(name: str) -> Any:
    return get_settings()[name]


def update_settings(partial: dict[str, Any]) -> dict[str, Any]:
    """Merge `partial` into the persisted overrides and return the new effective settings.

    A value of None resets that field back to its env-configured default.
    """
    with _lock:
        data = _load()
        for key, value in partial.items():
            if key not in _FIELDS:
                continue
            if value is None:
                data[key] = getattr(settings, key)
                continue
            field_type = _FIELDS[key]
            if field_type is bool:
                data[key] = bool(value)
            elif field_type is int:
                data[key] = int(value)
            else:
                data[key] = str(value)

        _STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(_STORE_PATH, "w") as f:
            json.dump(data, f, indent=2)
        return data


def public_settings() -> dict[str, Any]:
    """Effective settings with secret fields replaced by a boolean "is set" flag."""
    data = get_settings()
    out = dict(data)
    for key in SECRET_FIELDS:
        out[key] = bool(str(out.get(key, "")).strip())
    return out
