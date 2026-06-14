from __future__ import annotations

import json
import logging
import smtplib
import urllib.request
from email.message import EmailMessage

from .config import settings

logger = logging.getLogger("uvicorn")

# Severity ranking used to compare against *_alert_min_severity settings
_SEVERITY_RANK = {"info": 0, "warn": 1, "crit": 2}


def slack_enabled() -> bool:
    return bool(settings.slack_webhook_url.strip())


def email_enabled() -> bool:
    return bool(settings.smtp_host.strip() and settings.alert_email_to.strip())


def severity_meets_slack_threshold(severity: str) -> bool:
    threshold = _SEVERITY_RANK.get(settings.slack_alert_min_severity, 2)
    return _SEVERITY_RANK.get(severity, 0) >= threshold


def severity_meets_email_threshold(severity: str) -> bool:
    threshold = _SEVERITY_RANK.get(settings.email_alert_min_severity, 2)
    return _SEVERITY_RANK.get(severity, 0) >= threshold


def send_slack_message(text: str) -> bool:
    """Post a message to Slack via an incoming webhook.

    Returns True on success, False otherwise. Never raises.
    """
    if not slack_enabled():
        logger.warning("Slack notification skipped: SLACK_WEBHOOK_URL not configured")
        return False

    payload: dict[str, str] = {"text": text}
    if settings.slack_channel.strip():
        payload["channel"] = settings.slack_channel.strip()

    req = urllib.request.Request(
        settings.slack_webhook_url,
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
    """Send an alert email via SMTP to settings.alert_email_to.

    Returns True on success, False otherwise. Never raises.
    """
    if not email_enabled():
        logger.warning("Email notification skipped: SMTP_HOST/ALERT_EMAIL_TO not configured")
        return False

    recipients = [addr.strip() for addr in settings.alert_email_to.split(",") if addr.strip()]
    if not recipients:
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from_addr or settings.smtp_username or "system-trace@localhost"
    msg["To"] = ", ".join(recipients)
    msg.set_content(body)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(msg)
        return True
    except Exception as exc:
        logger.warning("Email alert send failed: %s", exc)
        return False
