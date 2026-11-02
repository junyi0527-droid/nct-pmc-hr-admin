"""Run daily: python reminders.py. Add --send-email after configuring SMTP."""
import argparse
import smtplib
import ssl
from datetime import date
from email.message import EmailMessage

from app.config import get_settings
from app.database import SessionLocal
from app.models import User
from app.models.workflow import AdminRecord, WorkflowNotice
from app.services.workflow_service import notice
from app.utils.timeutil import now_local
from app.workflow_catalog import CATALOG


def run(send_email=False):
    settings = get_settings()
    if send_email and (not settings.smtp_host or not settings.smtp_from):
        raise RuntimeError("Configure SMTP_HOST and SMTP_FROM before sending email")
    generated = emailed = 0
    with SessionLocal() as db:
        for record in db.query(AdminRecord).filter(AdminRecord.archived.is_(False)):
            if record.status in {"cancelled", "rejected"} or (record.status == "completed" and not CATALOG[record.kind].get("renewable")):
                continue
            reminder_date = record.reminder_date or record.due_date
            if not reminder_date:
                continue
            days = (date.fromisoformat(reminder_date) - now_local().date()).days
            if (record.reminder_date and days > 0) or (not record.reminder_date and days > record.reminder_days):
                continue
            key = f"reminder:{record.id}:{reminder_date}:{record.owner_id}"
            if not db.query(WorkflowNotice).filter_by(dedup_key=key).first():
                notice(db, record, record.owner_id, f"{record.title} reminder: {reminder_date}", key)
                generated += 1
        db.commit()
        if send_email:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
                if settings.smtp_starttls:
                    smtp.starttls(context=ssl.create_default_context())
                if settings.smtp_username:
                    smtp.login(settings.smtp_username, settings.smtp_password)
                pending = db.query(WorkflowNotice).filter(WorkflowNotice.emailed_at.is_(None), WorkflowNotice.read.is_(False)).all()
                for item in pending:
                    recipient = db.get(User, item.recipient_id)
                    if not recipient or not recipient.is_active:
                        continue
                    message = EmailMessage()
                    message["Subject"] = "HR Administration reminder / workflow update"
                    message["From"], message["To"] = settings.smtp_from, recipient.email
                    message.set_content(f"{item.message}\n\nOpen request: {settings.frontend_url.rstrip('/')}/records/{item.record_id}\n")
                    smtp.send_message(message)
                    item.emailed_at = now_local().isoformat()
                    db.commit()
                    emailed += 1
    return {"reminders_created": generated, "emails_sent": emailed}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--send-email", action="store_true")
    print(run(parser.parse_args().send_email))
