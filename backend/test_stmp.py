#!/usr/bin/env python3
"""
test_smtp.py

Checks SMTP settings and optionally EmailListVerify.

Environment variables used:
- OTP_EMAIL_HOST (required for SMTP test)
- OTP_EMAIL_PORT (default 587)
- OTP_EMAIL_USER (required for SMTP test)
- OTP_EMAIL_PASS (required for SMTP test)
- OTP_SMTP_USE_TLS (1 or 0, default 1)  # for STARTTLS flows on non-SSL ports
- TEST_RECIPIENT (optional, defaults to OTP_EMAIL_USER)
- EMAILLISTVERIFY_KEY (optional) - if present, will run an EmailListVerify check for TEST_RECIPIENT
- EMAILLISTVERIFY_BASE (optional) - override default EmailListVerify endpoint

Usage:
    # set env vars in same shell, then:
    python test_smtp.py
"""

import os
import sys
import smtplib
from email.message import EmailMessage
import socket
import base64
import traceback

try:
    import requests
except Exception:
    requests = None

# Read config from environment
HOST = os.environ.get("OTP_EMAIL_HOST")
PORT = int(os.environ.get("OTP_EMAIL_PORT", "587"))
USER = os.environ.get("OTP_EMAIL_USER")
PASS = os.environ.get("OTP_EMAIL_PASS")
USE_TLS = os.environ.get("OTP_SMTP_USE_TLS", "1") == "1"
RECIPIENT = os.environ.get("TEST_RECIPIENT") or USER

EMAILLISTVERIFY_KEY = os.environ.get("EMAILLISTVERIFY_KEY") or os.environ.get("EMAIL_LISTVERIFY_API_KEY")
EMAILLISTVERIFY_BASE = os.environ.get("EMAILLISTVERIFY_BASE", "https://apps.emaillistverify.com/api/verifyEmail")

def print_header(title):
    print("\n" + "="*8 + f" {title} " + "="*8)

def smtp_test():
    print_header("SMTP TEST")
    if not HOST or not USER or not PASS:
        print("Missing SMTP configuration. Please set OTP_EMAIL_HOST, OTP_EMAIL_USER, OTP_EMAIL_PASS in your environment.")
        return False

    print(f"Host: {HOST}:{PORT}")
    print(f"User: {USER}")
    print(f"Recipient: {RECIPIENT}")
    print(f"Use TLS (STARTTLS): {USE_TLS}")
    sock = None
    try:
        # Choose SSL for port 465, otherwise plain SMTP
        if PORT == 465:
            print("Using implicit SSL (port 465) with smtplib.SMTP_SSL")
            smtp = smtplib.SMTP_SSL(HOST, PORT, timeout=10)
        else:
            smtp = smtplib.SMTP(HOST, PORT, timeout=10)
        smtp.set_debuglevel(0)
        code, msg = smtp.ehlo()
        print(f"EHLO returned: {code} {msg!r}")
        if PORT != 465 and USE_TLS:
            try:
                print("Attempting STARTTLS...")
                code, msg = smtp.starttls()
                print(f"STARTTLS returned: {code} {msg!r}")
                code, msg = smtp.ehlo()
                print(f"EHLO after STARTTLS returned: {code} {msg!r}")
            except smtplib.SMTPException as e:
                print("STARTTLS failed:", repr(e))
                # continue to attempt login depending on server behavior
        # Attempt login
        try:
            print("Attempting login...")
            smtp.login(USER, PASS)
            print("Login succeeded.")
        except smtplib.SMTPAuthenticationError as e:
            print("SMTP Authentication failed.")
            try:
                code = e.smtp_code
                resp = e.smtp_error
                print(f"Auth error code: {code}, response: {resp!r}")
                # Some servers send base64 challenges; show decoded if looks like base64
                try:
                    if isinstance(resp, (bytes, bytearray)):
                        candidate = resp.decode('utf-8', errors='ignore')
                    else:
                        candidate = str(resp)
                    # Try base64 decode if it looks base64-y
                    stripped = candidate.strip()
                    if len(stripped) % 4 == 0:
                        try:
                            dec = base64.b64decode(stripped)
                            print("Base64-decoded server message:", dec.decode('utf-8', errors='ignore'))
                        except Exception:
                            pass
                except Exception:
                    pass
            except Exception:
                pass
            raise
        # Compose test message
        msg = EmailMessage()
        msg["Subject"] = "SMTP test message"
        msg["From"] = USER
        msg["To"] = RECIPIENT
        msg.set_content("This is a test email sent by test_smtp.py to validate SMTP configuration.")
        # Send
        try:
            print("Sending test message...")
            smtp.send_message(msg)
            print("Message sent successfully (SMTP accepted). Check recipient inbox/spam.")
        except smtplib.SMTPResponseException as e:
            print("SMTP response exception while sending:")
            print("SMTP code:", e.smtp_code)
            try:
                print("SMTP message:", e.smtp_error.decode('utf-8', errors='ignore'))
            except Exception:
                print("SMTP message (raw):", e.smtp_error)
            raise
        except Exception as e:
            print("Failed to send message:", repr(e))
            raise
        finally:
            try:
                smtp.quit()
            except Exception:
                try:
                    smtp.close()
                except Exception:
                    pass
        return True
    except (smtplib.SMTPAuthenticationError, smtplib.SMTPException, socket.error) as e:
        print("SMTP test failed with exception:")
        traceback.print_exc()
        return False
    except Exception as e:
        print("Unexpected error during SMTP test:")
        traceback.print_exc()
        return False

def emaillistverify_test():
    if not EMAILLISTVERIFY_KEY:
        print("\nSkipping EmailListVerify test (EMAILLISTVERIFY_KEY not set).")
        return None
    if requests is None:
        print("\nrequests package not available — install with `pip install requests` to test EmailListVerify.")
        return None

    print_header("EMAILLISTVERIFY TEST")
    print(f"Checking: {RECIPIENT}")
    try:
        params = {"secret": EMAILLISTVERIFY_KEY, "email": RECIPIENT}
        resp = requests.get(EMAILLISTVERIFY_BASE, params=params, timeout=8)
        print("HTTP status:", resp.status_code)
        # Print raw body and attempt to parse
        print("Response body:")
        print(resp.text.strip())
        try:
            j = resp.json()
            print("Parsed JSON:", j)
        except Exception:
            pass
        return resp.text.strip()
    except Exception:
        print("EmailListVerify check failed:")
        traceback.print_exc()
        return None

def main():
    ok = smtp_test()
    # If SMTP fails but you rely on dev fallback logging, the OTP server may still work (it will log OTPs).
    if not ok:
        print("\nSMTP test did not succeed. If you use a dev fallback in your server (logging OTPs to console), registration may still work for testing.")
        print("Common causes: wrong password, Gmail requiring App Password, port/SSL mismatch, or blocked outbound SMTP.")
    # Optionally test EmailListVerify
    emaillistverify_test()

if __name__ == "__main__":
    main()
