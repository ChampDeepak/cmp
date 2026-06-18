import os
import httpx
from dotenv import load_dotenv

load_dotenv()

# Resend sends mail over HTTPS (port 443), which Render allows — unlike raw
# SMTP (ports 25/465/587), which Render blocks. Same send_email() signature
# as before, so the worker doesn't change.
RESEND_API_KEY = os.getenv("RESEND_API_KEY")

# The "from" address. Resend only accepts either:
#   - "onboarding@resend.dev" (test mode — ONLY delivers to the email you
#     signed up to Resend with), or
#   - an address on a domain you've verified in the Resend dashboard.
# Override with RESEND_FROM once your domain is verified.
RESEND_FROM = os.getenv("RESEND_FROM", "onboarding@resend.dev")

RESEND_API_URL = "https://api.resend.com/emails"


def send_email(recipient_email: str, subject: str, body: str):
    """Sends an email using the Resend HTTP API."""
    if not RESEND_API_KEY:
        print("⚠️ RESEND_API_KEY not set. Skipping email.")
        return

    try:
        response = httpx.post(
            RESEND_API_URL,
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": RESEND_FROM,
                "to": [recipient_email],
                "subject": subject,
                "text": body,
            },
            timeout=15.0,
        )

        if response.status_code in (200, 201):
            message_id = response.json().get("id")
            print(f" Email sent to {recipient_email} (Resend id: {message_id})")
        else:
            # Resend returns a JSON error body explaining what went wrong
            # (e.g. unverified domain, invalid 'from', bad API key).
            print(f"Failed to send email: {response.status_code} {response.text}")
    except Exception as e:
        print(f"Failed to send email: {e}")
