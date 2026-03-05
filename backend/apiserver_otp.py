"""
apiserver_otp.py (EmailListVerify integrated)

- Verifies emails using EmailListVerify before creating account or sending OTP
- Sends OTP via SMTP, with dev fallback (logs OTP to console) if SMTP fails
- Uses SQLite for users/profiles/otps
- Token creation with itsdangerous.URLSafeTimedSerializer
- CORS enabled for development (flask-cors)

Environment variables used:
- OTP_DB_PATH (default: otp_users.db)
- OTP_EMAIL_HOST, OTP_EMAIL_PORT, OTP_EMAIL_USER, OTP_EMAIL_PASS
- OTP_SECRET_KEY
- OTP_SMTP_USE_TLS (1 or 0)
- OTP_CORS_ORIGIN (default http://localhost:5173)
- OTP_DEV_FALLBACK_LOG_OTP (1 to enable dev fallback logging OTPs)
- EMAILLISTVERIFY_KEY (your EmailListVerify API key)  <-- IMPORTANT
- EMAILLISTVERIFY_BASE (optional, default: https://apps.emaillistverify.com/api/verifyEmail)

Install requirements:
    pip install flask flask-cors bcrypt itsdangerous requests
"""
import os
import time
import sqlite3
import secrets
import hashlib
import hmac
import smtplib
from email.message import EmailMessage

from flask import Flask, request, jsonify
import bcrypt
from itsdangerous import URLSafeTimedSerializer
from flask_cors import CORS
import requests
from dotenv import load_dotenv
load_dotenv("key.env")


# ---------- Configuration ----------
DB_PATH = os.environ.get("OTP_DB_PATH", "otp_users.db")
EMAIL_HOST = os.environ.get("OTP_EMAIL_HOST")
EMAIL_PORT = int(os.environ.get("OTP_EMAIL_PORT", "587"))
EMAIL_USER = os.environ.get("OTP_EMAIL_USER")
EMAIL_PASS = os.environ.get("OTP_EMAIL_PASS")
SECRET_KEY = os.environ.get("OTP_SECRET_KEY", secrets.token_hex(32))
USE_TLS = os.environ.get("OTP_SMTP_USE_TLS", "1") == "1"
CORS_ORIGIN = os.environ.get("OTP_CORS_ORIGIN", "http://localhost:5173")
DEV_FALLBACK_LOG_OTP = os.environ.get("OTP_DEV_FALLBACK_LOG_OTP", "1") == "1"

# EmailListVerify config
EMAILLISTVERIFY_KEY = os.environ.get("EMAILLISTVERIFY_KEY") or os.environ.get("EMAIL_LISTVERIFY_API_KEY")
EMAILLISTVERIFY_BASE = os.environ.get("EMAILLISTVERIFY_BASE", "https://apps.emaillistverify.com/api/verifyEmail")

# ---------- App init ----------
app = Flask(__name__)
app.config["SECRET_KEY"] = SECRET_KEY

CORS(app, resources={r"/api/*": {"origins": CORS_ORIGIN}}, supports_credentials=True)

# ---------- DB helpers ----------
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash BLOB,
        provider TEXT DEFAULT 'local',
        verified INTEGER DEFAULT 0,
        created_at INTEGER
    )
    """)
    c.execute("""
    CREATE TABLE IF NOT EXISTS profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        data TEXT,
        FOREIGN KEY(email) REFERENCES users(email)
    )
    """)
    c.execute("""
    CREATE TABLE IF NOT EXISTS otps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        otp_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        expires_at INTEGER NOT NULL
    )
    """)
    conn.commit()
    conn.close()

def get_conn():
    return sqlite3.connect(DB_PATH)

def ensure_verified_column():
    try:
        conn = get_conn(); c = conn.cursor()
        c.execute("PRAGMA table_info(users)")
        cols = [row[1] for row in c.fetchall()]
        if "verified" not in cols:
            c.execute("ALTER TABLE users ADD COLUMN verified INTEGER DEFAULT 0")
            conn.commit()
    except Exception:
        pass
    finally:
        try:
            conn.close()
        except Exception:
            pass

# ---------- Security helpers ----------
def hash_password(password: str) -> bytes:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())

def check_password(password: str, pw_hash: bytes) -> bool:
    try:
        if isinstance(pw_hash, str):
            pw_hash = pw_hash.encode("utf-8")
        return bcrypt.checkpw(password.encode("utf-8"), pw_hash)
    except Exception:
        return False

def get_serializer():
    return URLSafeTimedSerializer(app.config["SECRET_KEY"], salt="otp-auth")

def create_token(payload: dict, expires_sec: int = 60 * 60 * 24) -> str:
    s = get_serializer()
    return s.dumps(payload)

def verify_token(token: str, max_age: int = 60 * 60 * 24):
    s = get_serializer()
    try:
        return s.loads(token, max_age=max_age)
    except Exception:
        return None

# ---------- EmailListVerify integration ----------
def verify_with_emaillistverify(email: str, timeout: float = 6.0):
    """
    Calls EmailListVerify API. Returns a tuple (ok:bool, status:str, raw_response:str)
      - ok: True when address is allowed to proceed (status 'ok' or 'unknown' depending on policy)
      - status: raw status from service (ok|failed|unknown|incorrect|key_not_valid|...)
      - raw_response: text body returned by the API
    Policy used here:
      - 'ok' => allow
      - 'failed' or 'incorrect' => deny
      - 'unknown' => allow but mark as unknown (proceed with caution)
      - If EmailListVerify key missing => treat as allowed (but note missing key)
    """
    if not EMAILLISTVERIFY_KEY:
        return True, "not_configured", "EmailListVerify key not set; skipping verification"

    try:
        params = {"secret": EMAILLISTVERIFY_KEY, "email": email}
        resp = requests.get(EMAILLISTVERIFY_BASE, params=params, timeout=timeout)
        text = resp.text.strip()
        # The API returns a simple status string according to docs: ok, failed, unknown, incorrect, key_not_valid
        status = text.lower()
        # Normalize just-in-case (trim newlines, JSON etc.)
        if status.startswith("{") or status.startswith("["):
            # If they return JSON, try to parse 'status' field
            try:
                j = resp.json()
                status = str(j.get("status", text)).lower()
            except Exception:
                status = text.lower()
        # Decide policy
        if status == "ok":
            return True, status, text
        if status in ("unknown", "key_not_valid"):
            # unknown -> allow but note
            return True, status, text
        if status in ("failed", "incorrect", "missing parameters"):
            return False, status, text
        # default allow
        return True, status, text
    except requests.exceptions.RequestException as e:
        app.logger.exception("EmailListVerify request failed")
        # on network errors, choose to allow but mark as 'verify_error'
        return True, "verify_error", str(e)

# ---------- Email helpers (SMTP with dev fallback) ----------
def _log_dev_otp(to_addr: str, subject: str, body: str):
    print("\n" + "="*40)
    print("[DEV OTP FALLBACK] Email NOT sent via SMTP (dev fallback enabled).")
    print(f"To: {to_addr}")
    print(f"Subject: {subject}")
    print("Body:")
    print(body)
    print("="*40 + "\n")

def send_email(to_addr: str, subject: str, body: str):
    """
    Try to send email via SMTP. Returns (status, info):
      - status: "sent" or "logged"
      - info: additional message (empty on sent)
    If SMTP not configured or sending fails and DEV_FALLBACK_LOG_OTP is True -> log OTP to console and return ("logged", message).
    If SMTP fails and fallback disabled -> raise exception.
    """
    if not EMAIL_HOST or not EMAIL_USER or not EMAIL_PASS:
        info = "SMTP not configured"
        if DEV_FALLBACK_LOG_OTP:
            _log_dev_otp(to_addr, subject, body)
            return ("logged", info + " — dev fallback logged OTP to console")
        raise RuntimeError("Email config is not set. Set OTP_EMAIL_HOST, OTP_EMAIL_USER, OTP_EMAIL_PASS.")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = EMAIL_USER
    msg["To"] = to_addr
    msg.set_content(body)

    try:
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT, timeout=10) as s:
            if USE_TLS:
                s.starttls()
            s.login(EMAIL_USER, EMAIL_PASS)
            s.send_message(msg)
        return ("sent", "")
    except Exception as ex:
        app.logger.exception("SMTP send failed")
        if DEV_FALLBACK_LOG_OTP:
            _log_dev_otp(to_addr, subject, body)
            return ("logged", f"SMTP failed ({type(ex).__name__}): {str(ex)} — dev fallback logged OTP to console")
        raise

# ---------- OTP helpers ----------
def generate_otp() -> str:
    return "%06d" % secrets.randbelow(1000000)

def store_otp(email: str, otp: str, ttl_seconds: int = 300):
    salt = secrets.token_hex(8)
    otp_hash = hashlib.sha256((salt + otp).encode("utf-8")).hexdigest()
    expires = int(time.time()) + ttl_seconds
    conn = get_conn()
    c = conn.cursor()
    c.execute("DELETE FROM otps WHERE email = ?", (email,))
    c.execute("INSERT INTO otps (email, otp_hash, salt, expires_at) VALUES (?, ?, ?, ?)", (email, otp_hash, salt, expires))
    conn.commit()
    conn.close()

def verify_otp_value(email: str, otp_try: str):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT otp_hash, salt, expires_at FROM otps WHERE email = ? ORDER BY id DESC LIMIT 1", (email,))
    row = c.fetchone()
    conn.close()
    if not row:
        return False, "no_otp"
    otp_hash_db, salt, expires_at = row
    if int(time.time()) > expires_at:
        return False, "expired"
    otp_hash_try = hashlib.sha256((salt + otp_try).encode("utf-8")).hexdigest()
    if hmac.compare_digest(otp_hash_db, otp_hash_try):
        # delete used OTP
        conn = get_conn()
        c = conn.cursor()
        c.execute("DELETE FROM otps WHERE email = ?", (email,))
        conn.commit()
        conn.close()
        return True, "ok"
    return False, "mismatch"

# ---------- API endpoints ----------
@app.route("/api/register", methods=["POST"])
def api_register():
    data = request.json or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")
    provider = data.get("provider") or "local"
    if not email:
        return jsonify({"ok": False, "error": "missing_email"}), 400

    # Email verification via EmailListVerify
    ok_verify, verify_status, verify_raw = verify_with_emaillistverify(email)
    if not ok_verify:
        return jsonify({"ok": False, "error": "email_invalid", "verify_status": verify_status, "detail": verify_raw}), 400

    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT email FROM users WHERE email = ?", (email,))
    if c.fetchone():
        conn.close()
        return jsonify({"ok": False, "error": "exists"}), 409

    pw_hash = None
    if provider == "local":
        if not password or len(password) < 6:
            conn.close()
            return jsonify({"ok": False, "error": "weak_password"}), 400
        pw_hash = hash_password(password)

    try:
        c.execute("INSERT INTO users (email, password_hash, provider, verified, created_at) VALUES (?, ?, ?, ?, ?)",
                  (email, pw_hash, provider, 0, int(time.time())))
        c.execute("INSERT OR REPLACE INTO profiles (email, data) VALUES (?, ?)", (email, "{}"))
        conn.commit()
    except Exception as e:
        conn.close()
        return jsonify({"ok": False, "error": "db_error", "message": str(e)}), 500
    finally:
        try: conn.close()
        except Exception: pass

    # generate & send OTP
    otp = generate_otp()
    try:
        store_otp(email, otp)
        body = f"Your verification code is: {otp}\nIt will expire in 5 minutes."
        status, info = send_email(email, "Your verification code", body)
    except Exception as e:
        app.logger.exception("Failed to send OTP on register (unexpected)")
        return jsonify({"ok": False, "error": "otp_failed", "message": str(e)}), 500

    resp = {"ok": True, "otp_sent": True, "verify_status": verify_status}
    if status == "logged":
        resp["note"] = info
    return jsonify(resp)

@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.json or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")
    if not email:
        return jsonify({"ok": False, "error": "missing_email"}), 400

    # verify email address via EmailListVerify before login/OTP send
    ok_verify, verify_status, verify_raw = verify_with_emaillistverify(email)
    if not ok_verify:
        return jsonify({"ok": False, "error": "email_invalid", "verify_status": verify_status, "detail": verify_raw}), 400

    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT password_hash, provider FROM users WHERE email = ?", (email,))
    row = c.fetchone()
    conn.close()
    if not row:
        return jsonify({"ok": False, "error": "not_found"}), 404
    pw_hash_db, provider = row
    if provider != "local":
        return jsonify({"ok": False, "error": "use_oauth", "provider": provider}), 400
    if not pw_hash_db:
        return jsonify({"ok": False, "error": "no_password"}), 400
    if not check_password(password, pw_hash_db):
        return jsonify({"ok": False, "error": "bad_credentials"}), 401

    otp = generate_otp()
    try:
        store_otp(email, otp)
        body = f"Your verification code is: {otp}\nIt will expire in 5 minutes."
        status, info = send_email(email, "Your verification code", body)
    except Exception as e:
        app.logger.exception("Failed to send OTP on login (unexpected)")
        return jsonify({"ok": False, "error": "otp_failed", "message": str(e)}), 500

    resp = {"ok": True, "otp_sent": True, "verify_status": verify_status}
    if status == "logged":
        resp["note"] = info
    return jsonify(resp)

@app.route("/api/resend-otp", methods=["POST"])
def api_resend_otp():
    data = request.json or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return jsonify({"ok": False, "error": "missing_email"}), 400

    ok_verify, verify_status, verify_raw = verify_with_emaillistverify(email)
    if not ok_verify:
        return jsonify({"ok": False, "error": "email_invalid", "verify_status": verify_status, "detail": verify_raw}), 400

    otp = generate_otp()
    try:
        store_otp(email, otp)
        body = f"Your verification code is: {otp}\nIt will expire in 5 minutes."
        status, info = send_email(email, "Your verification code (resend)", body)
    except Exception as e:
        app.logger.exception("Failed to resend OTP (unexpected)")
        return jsonify({"ok": False, "error": "otp_failed", "message": str(e)}), 500

    resp = {"ok": True, "otp_sent": True, "verify_status": verify_status}
    if status == "logged":
        resp["note"] = info
    return jsonify(resp)

@app.route("/api/verify-otp", methods=["POST"])
def api_verify_otp():
    data = request.json or {}
    email = (data.get("email") or "").strip().lower()
    otp_try = (data.get("otp") or "").strip()
    if not email or not otp_try:
        return jsonify({"ok": False, "error": "missing"}), 400
    ok, reason = verify_otp_value(email, otp_try)
    if not ok:
        return jsonify({"ok": False, "error": reason}), 400

    try:
        conn = get_conn(); c = conn.cursor()
        c.execute("UPDATE users SET verified = 1 WHERE email = ?", (email,))
        conn.commit(); conn.close()
    except Exception:
        pass

    token = create_token({"email": email})
    return jsonify({"ok": True, "token": token})

@app.route("/api/profile", methods=["GET", "POST"])
def api_profile():
    if request.method == "GET":
        token = request.headers.get("Authorization")
        if not token:
            return jsonify({"ok": False, "error": "missing_token"}), 401
        token = token.replace("Bearer ", "")
        data = verify_token(token)
        if not data:
            return jsonify({"ok": False, "error": "invalid_token"}), 401
        email = data.get("email")
        conn = get_conn(); c = conn.cursor()
        c.execute("SELECT data FROM profiles WHERE email = ?", (email,))
        row = c.fetchone(); conn.close()
        if not row:
            return jsonify({"ok": False, "error": "not_found"}), 404
        return jsonify({"ok": True, "profile": row[0]})
    else:
        token = request.headers.get("Authorization")
        if not token:
            return jsonify({"ok": False, "error": "missing_token"}), 401
        token = token.replace("Bearer ", "")
        data = verify_token(token)
        if not data:
            return jsonify({"ok": False, "error": "invalid_token"}), 401
        email = data.get("email")
        body = request.json or {}
        conn = get_conn(); c = conn.cursor()
        c.execute("INSERT OR REPLACE INTO profiles (email, data) VALUES (?, ?)", (email, body.get("data", "{}")))
        conn.commit(); conn.close()
        return jsonify({"ok": True})

# ---------- Startup ----------
if __name__ == "__main__":
    init_db()
    ensure_verified_column()
    print(f"Starting OTP server on http://127.0.0.1:5001 (default). CORS origin: {CORS_ORIGIN}")
    if DEV_FALLBACK_LOG_OTP:
        print("DEV_FALLBACK_LOG_OTP is enabled: SMTP failures will log OTPs to console instead of returning 500.")
    if EMAILLISTVERIFY_KEY:
        print("EmailListVerify integration enabled.")
    else:
        print("EmailListVerify key not set — skipping email validation (EMAILLISTVERIFY_KEY env var).")
    app.run(host="0.0.0.0", port=5001, debug=True)
