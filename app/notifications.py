from __future__ import annotations

import json
import logging
import smtplib
import urllib.request
from email.message import EmailMessage

from . import notification_settings as ns

logger = logging.getLogger("uvicorn")

# Severity ranking used to compare against *_alert_min_severity settings
_SEVERITY_RANK = {"info": 0, "warn": 1, "crit": 2}


def slack_enabled() -> bool:
    return bool(ns.get_value("slack_webhook_url").strip())


def email_enabled() -> bool:
    return bool(ns.get_value("smtp_host").strip() and ns.get_value("alert_email_to").strip())


def severity_meets_slack_threshold(severity: str) -> bool:
    threshold = _SEVERITY_RANK.get(ns.get_value("slack_alert_min_severity"), 2)
    return _SEVERITY_RANK.get(severity, 0) >= threshold


def severity_meets_email_threshold(severity: str) -> bool:
    threshold = _SEVERITY_RANK.get(ns.get_value("email_alert_min_severity"), 2)
    return _SEVERITY_RANK.get(severity, 0) >= threshold


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

    req = urllib.request.Request(
        webhook_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            ok = 200 <= resp.status < 300
            if not ok:
                logger.warning("Slack webhook returned status %s", resp.status)
            return ok
    except Exception as exc:
        logger.warning("Slack webhook request failed: %s", exc)
        return False


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
