from __future__ import annotations

import json
import logging
import smtplib
import urllib.request
from email.message import EmailMessage
from typing import Any

from . import notification_settings as ns

logger = logging.getLogger("uvicorn")

# Severity ranking used to compare against *_alert_min_severity settings
_SEVERITY_RANK = {"info": 0, "warn": 1, "crit": 2}


def slack_enabled() -> bool:
    return bool(ns.get_value("slack_webhook_url").strip())


def email_enabled() -> bool:
    return bool(ns.get_value("smtp_host").strip() and ns.get_value("alert_email_to").strip())


def teams_enabled() -> bool:
    return bool(ns.get_value("teams_webhook_url").strip())


def discord_enabled() -> bool:
    return bool(ns.get_value("discord_webhook_url").strip())


def pagerduty_enabled() -> bool:
    return bool(ns.get_value("pagerduty_routing_key").strip())


def _severity_meets_threshold(severity: str, setting_name: str) -> bool:
    threshold = _SEVERITY_RANK.get(ns.get_value(setting_name), 2)
    return _SEVERITY_RANK.get(severity, 0) >= threshold


def severity_meets_slack_threshold(severity: str) -> bool:
    return _severity_meets_threshold(severity, "slack_alert_min_severity")


def severity_meets_email_threshold(severity: str) -> bool:
    return _severity_meets_threshold(severity, "email_alert_min_severity")


def severity_meets_teams_threshold(severity: str) -> bool:
    return _severity_meets_threshold(severity, "teams_alert_min_severity")


def severity_meets_discord_threshold(severity: str) -> bool:
    return _severity_meets_threshold(severity, "discord_alert_min_severity")


def severity_meets_pagerduty_threshold(severity: str) -> bool:
    return _severity_meets_threshold(severity, "pagerduty_alert_min_severity")


def _post_json(url: str, payload: dict[str, Any], headers: dict[str, str] | None = None) -> bool:
    """POST a JSON payload to `url`. Returns True on 2xx, False otherwise. Never raises."""
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **(headers or {})},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            ok = 200 <= resp.status < 300
            if not ok:
                logger.warning("Webhook POST to %s returned status %s", url, resp.status)
            return ok
    except Exception as exc:
        logger.warning("Webhook POST to %s failed: %s", url, exc)
        return False


def send_slack_message(text: str) -> bool:
    """Post a message to Slack via an incoming webhook.

    Returns True on success, False otherwise. Never raises.
    """
    webhook_url = ns.get_value("slack_webhook_url").strip()
    if not webhook_url:
        logger.warning("Slack notification skipped: webhook URL not configured")
        return False

    payload: dict[str, str] = {"text": text}
    channel = ns.get_value("slack_channel").strip()
    if channel:
        payload["channel"] = channel

    return _post_json(webhook_url, payload)


def send_teams_message(text: str) -> bool:
    """Post a message to Microsoft Teams via an Incoming Webhook connector.

    Returns True on success, False otherwise. Never raises.
    """
    webhook_url = ns.get_value("teams_webhook_url").strip()
    if not webhook_url:
        logger.warning("Teams notification skipped: webhook URL not configured")
        return False

    return _post_json(webhook_url, {"text": text})


def send_discord_message(text: str) -> bool:
    """Post a message to Discord via a channel webhook.

    Returns True on success, False otherwise. Never raises.
    """
    webhook_url = ns.get_value("discord_webhook_url").strip()
    if not webhook_url:
        logger.warning("Discord notification skipped: webhook URL not configured")
        return False

    return _post_json(webhook_url, {"content": text})


# Maps internal severity levels to PagerDuty Events API v2 severities
_PAGERDUTY_SEVERITY = {"info": "info", "warn": "warning", "crit": "critical"}


def send_pagerduty_event(summary: str, severity: str = "crit", dedup_key: str | None = None) -> bool:
    """Trigger a PagerDuty alert via the Events API v2.

    Returns True on success, False otherwise. Never raises.
    """
    routing_key = ns.get_value("pagerduty_routing_key").strip()
    if not routing_key:
        logger.warning("PagerDuty notification skipped: routing key not configured")
        return False

    payload: dict[str, Any] = {
        "routing_key": routing_key,
        "event_action": "trigger",
        "payload": {
            "summary": summary,
            "source": "system-trace",
            "severity": _PAGERDUTY_SEVERITY.get(severity, "critical"),
        },
    }
    if dedup_key:
        payload["dedup_key"] = dedup_key

    return _post_json("https://events.pagerduty.com/v2/enqueue", payload)


def send_email(subject: str, body: str) -> bool:
    """Send an alert email via SMTP to the configured recipients.

    Returns True on success, False otherwise. Never raises.
    """
    if not email_enabled():
        logger.warning("Email notification skipped: SMTP host / recipients not configured")
        return False

    recipients = [addr.strip() for addr in ns.get_value("alert_email_to").split(",") if addr.strip()]
    if not recipients:
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = ns.get_value("smtp_from_addr") or ns.get_value("smtp_username") or "system-trace@localhost"
    msg["To"] = ", ".join(recipients)
    msg.set_content(body)

    try:
        with smtplib.SMTP(ns.get_value("smtp_host"), int(ns.get_value("smtp_port")), timeout=10) as smtp:
            if ns.get_value("smtp_use_tls"):
                smtp.starttls()
            username = ns.get_value("smtp_username")
            if username:
                smtp.login(username, ns.get_value("smtp_password"))
            smtp.send_message(msg)
        return True
    except Exception as exc:
        logger.warning("Email alert send failed: %s", exc)
        return False
