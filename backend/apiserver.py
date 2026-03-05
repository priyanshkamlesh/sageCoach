import os
import json
import sqlite3
import secrets
import smtplib
import base64
import math
from io import BytesIO
from email.message import EmailMessage
from datetime import datetime, timedelta

import numpy as np
import cv2
from PIL import Image, ImageDraw
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

# ---------- BASIC PATHS ----------
HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(HERE, "users.db")

# ---------- LOAD key.env MANUALLY ----------
# (no python-dotenv required)
env_file = os.path.join(HERE, "key.env")
if os.path.exists(env_file):
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip()
                if k and v:
                    os.environ.setdefault(k, v)

# ---------- GEMINI (GOOGLE GENERATIVE AI) ----------
try:
    import google.generativeai as genai
except ImportError:
    genai = None

# read API key from key.env or environment
GEMINI_API_KEY = (
    os.getenv("GEMINI_API_KEY")
    or os.getenv("GOOGLE_API_KEY")
    or os.getenv("API_KEY")
)

# Use Gemini 2.5 Flash for text (tips, reasoning)
GEMINI_TEXT_MODEL = os.getenv("GEMINI_TEXT_MODEL", "gemini-2.5-flash")

# Keep an image model ready if you later want AI-generated images
GEMINI_IMAGE_MODEL = os.getenv("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")

if genai is not None and GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# ---------- MEDIAPIPE (POSE) ----------
try:
    import mediapipe as mp
    mp_pose = mp.solutions.pose
except ImportError:
    mp = None
    mp_pose = None

# ---------- EMAIL / OTP CONFIG ----------
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")

OTP_LENGTH = int(os.environ.get("OTP_LENGTH", 6))
OTP_EXPIRY_MINUTES = int(os.environ.get("OTP_EXPIRY_MINUTES", 10))
OTP_MAX_ATTEMPTS = int(os.environ.get("OTP_MAX_ATTEMPTS", 5))
OTP_COOLDOWN_SECONDS = int(os.environ.get("OTP_COOLDOWN_SECONDS", 30))

app = Flask(__name__)
CORS(
    app,
    origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    supports_credentials=True,
)

# ---------- DB HELPERS ----------
def get_db():
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(
            DB_PATH,
            detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES,
        )
        db.row_factory = sqlite3.Row
    return db


def init_db():
    db = get_db()
    db.executescript(
        """
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        provider TEXT DEFAULT 'local',
        username TEXT,
        email_verified INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        profile_json TEXT
    );

    CREATE TABLE IF NOT EXISTS otps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        otp_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        verified INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT,
        score REAL,
        meta_json TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);
    """
    )
    db.commit()


@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()


with app.app_context():
    init_db()

# ---------- EMAIL / OTP HELPERS ----------
def _generate_otp_code(length=OTP_LENGTH):
    return "".join(secrets.choice("0123456789") for _ in range(length))


def _dev_print_otp(to_email, subject, body_text):
    print("\n" + "=" * 40)
    print("[DEV OTP] Email NOT sent via SMTP (fallback).")
    print("To:", to_email)
    print("Subject:", subject)
    print("Body:")
    print(body_text)
    print("=" * 40 + "\n")


def _send_email_smtp(to_email, subject, body_text, body_html=None):
    if not SMTP_USER or not SMTP_PASS:
        _dev_print_otp(to_email, subject, body_text)
        return True

    msg = EmailMessage()
    msg["From"] = SMTP_USER
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body_text)
    if body_html:
        msg.add_alternative(body_html, subtype="html")

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
            s.starttls()
            s.login(SMTP_USER, SMTP_PASS)
            s.send_message(msg)
        return True
    except Exception as e:
        print("SMTP error:", e)
        _dev_print_otp(to_email, subject, body_text)
        return True


def save_otp_for_email(email, otp_plain):
    db = get_db()
    otp_hash = generate_password_hash(otp_plain)
    expires_at = (datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)).isoformat()
    db.execute(
        "INSERT INTO otps (email, otp_hash, expires_at, attempts, verified) VALUES (?, ?, ?, ?, ?)",
        (email.lower(), otp_hash, expires_at, 0, 0),
    )
    db.commit()


def get_latest_otp_record(email):
    db = get_db()
    cur = db.execute(
        "SELECT * FROM otps WHERE email=? ORDER BY created_at DESC LIMIT 1",
        (email.lower(),),
    )
    return cur.fetchone()

# ---------- USER HELPERS ----------
def create_user(email, password=None, provider="local", username=""):
    db = get_db()
    password_hash = None
    if provider == "local":
        if not password or len(password) < 6:
            raise ValueError("password required (min 6 chars)")
        password_hash = generate_password_hash(password)

    db.execute(
        "INSERT INTO users (email, password_hash, provider, username, profile_json) VALUES (?, ?, ?, ?, ?)",
        (email.lower(), password_hash, provider, username, json.dumps({})),
    )
    db.commit()


def find_user_by_email(email):
    db = get_db()
    cur = db.execute("SELECT * FROM users WHERE email=?", (email.lower(),))
    return cur.fetchone()


def update_user_profile(email, username=None, profile=None, email_verified=None):
    db = get_db()
    if username is not None:
        db.execute("UPDATE users SET username=? WHERE email=?", (username, email.lower()))
    if profile is not None:
        db.execute(
            "UPDATE users SET profile_json=? WHERE email=?",
            (json.dumps(profile), email.lower()),
        )
    if email_verified is not None:
        db.execute(
            "UPDATE users SET email_verified=? WHERE email=?",
            (1 if email_verified else 0, email.lower()),
        )
    db.commit()

# ---------- AUTH ----------
@app.post("/api/register")
def api_register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()
    username = (data.get("username") or "").strip()

    if not email or not password:
        return jsonify({"error": "email and password required"}), 400

    existing = find_user_by_email(email)
    if existing:
        return jsonify({"error": "user_exists"}), 400

    try:
        create_user(email, password=password, provider="local", username=username)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    otp_plain = _generate_otp_code()
    save_otp_for_email(email, otp_plain)
    subject = "Your SageCoach verification code"
    text = f"Your verification code is: {otp_plain}\nValid for {OTP_EXPIRY_MINUTES} minutes."
    html = f"<p>Your verification code is: <b>{otp_plain}</b></p><p>Valid for {OTP_EXPIRY_MINUTES} minutes.</p>"

    _send_email_smtp(email, subject, text, html)
    return jsonify({"ok": True}), 200


@app.post("/api/login")
def api_login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()
    if not email or not password:
        return jsonify({"error": "email and password required"}), 400

    user = find_user_by_email(email)
    if not user or not user["password_hash"]:
        return jsonify({"error": "invalid_credentials"}), 401

    if not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "invalid_credentials"}), 401

    try:
        profile = json.loads(user["profile_json"] or "{}")
    except Exception:
        profile = {}

    return jsonify(
        {
            "ok": True,
            "user": {
                "email": user["email"],
                "username": user["username"],
                "provider": user["provider"],
                "email_verified": bool(user["email_verified"]),
                "profile": profile,
            },
        }
    ), 200


@app.post("/api/send_otp")
def api_send_otp():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "email required"}), 400

    otp_plain = _generate_otp_code()
    save_otp_for_email(email, otp_plain)
    subject = "Your SageCoach verification code"
    text = f"Your verification code is: {otp_plain}\nValid for {OTP_EXPIRY_MINUTES} minutes."
    html = f"<p>Your verification code is: <b>{otp_plain}</b></p><p>Valid for {OTP_EXPIRY_MINUTES} minutes.</p>"

    _send_email_smtp(email, subject, text, html)
    return jsonify({"ok": True}), 200


@app.post("/api/verify_otp")
def api_verify_otp():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    otp = (data.get("otp") or "").strip()
    if not email or not otp:
        return jsonify({"error": "email and otp required"}), 400

    row = get_latest_otp_record(email)
    if not row:
        return jsonify({"error": "no otp found"}), 404

    if row["verified"]:
        return jsonify({"error": "already_verified"}), 400

    try:
        expires_at = datetime.fromisoformat(row["expires_at"])
    except Exception:
        return jsonify({"error": "invalid otp record"}), 500

    if datetime.utcnow() > expires_at:
        return jsonify({"error": "otp_expired"}), 400

    attempts = row["attempts"] or 0
    if attempts >= OTP_MAX_ATTEMPTS:
        return jsonify({"error": "too_many_attempts"}), 403

    db = get_db()
    if check_password_hash(row["otp_hash"], otp):
        db.execute("UPDATE otps SET verified=1 WHERE id=?", (row["id"],))
        db.commit()
        user = find_user_by_email(email)
        if user:
            update_user_profile(email, email_verified=True)
        return jsonify({"ok": True}), 200
    else:
        db.execute(
            "UPDATE otps SET attempts = attempts + 1 WHERE id=?", (row["id"],)
        )
        db.commit()
        return jsonify(
            {
                "error": "invalid_otp",
                "attempts_left": OTP_MAX_ATTEMPTS - (attempts + 1),
            }
        ), 400

# ---------- SCORES (including /scores for Dashboard) ----------
@app.post("/api/scores")
def api_save_score():
    data = request.get_json(silent=True) or {}
    score = data.get("score")
    email = (data.get("email") or "").strip().lower() or None
    meta = data.get("meta") or {}
    if score is None:
        return jsonify({"error": "score required"}), 400

    db = get_db()
    try:
        db.execute(
            "INSERT INTO scores (email, score, meta_json) VALUES (?, ?, ?)",
            (email, float(score), json.dumps(meta)),
        )
        db.commit()
    except Exception as e:
        print("save score error:", e)
        return jsonify({"error": "db error"}), 500

    return jsonify({"ok": True}), 201


@app.get("/api/scores")
def api_get_scores():
    # optional ?email=... filter
    email = (request.args.get("email") or "").strip().lower()
    db = get_db()
    if email:
        cur = db.execute(
            "SELECT * FROM scores WHERE email=? ORDER BY id DESC", (email,)
        )
    else:
        cur = db.execute("SELECT * FROM scores ORDER BY id DESC LIMIT 100")
    rows = [dict(r) for r in cur.fetchall()]
    for r in rows:
        try:
            r["meta"] = json.loads(r.get("meta_json") or "{}")
        except Exception:
            r["meta"] = {}
        r.pop("meta_json", None)
    return jsonify(rows), 200


@app.post("/scores")
def scores_alias_save():
    return api_save_score()


@app.get("/scores")
def scores_alias_get():
    # simple list of scores (for charts)
    db = get_db()
    cur = db.execute("SELECT score FROM scores ORDER BY id ASC")
    scores = [float(row["score"]) for row in cur.fetchall()]
    return jsonify(scores), 200


@app.delete("/scores")
def scores_alias_delete_all():
    db = get_db()
    db.execute("DELETE FROM scores")
    db.commit()
    return jsonify({"ok": True, "message": "all scores deleted"}), 200

# ---------- POSTURE ANALYSIS ----------
def _pil_to_base64(img: Image.Image) -> str:
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def analyze_posture_image(image_bgr: np.ndarray):
    """
    MediaPipe-based posture analysis.
    Returns:
      - score (0–100)
      - feedback list
      - annotated_b64 (actual skeleton, error = red, ok = green)
      - ideal_b64 (ideal / corrected skeleton, green)
    """
    if mp_pose is None:
        raise RuntimeError(
            "mediapipe not installed. Run: pip install mediapipe opencv-python pillow numpy"
        )

    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    h, w, _ = image_rgb.shape

    with mp_pose.Pose(
        static_image_mode=True,
        model_complexity=1,
        enable_segmentation=False,
        min_detection_confidence=0.5,
    ) as pose:
        results = pose.process(image_rgb)

    if not results.pose_landmarks:
        raise ValueError("Could not detect a human pose in the image.")

    landmarks = results.pose_landmarks.landmark

    def get_point(name):
        enum_val = mp_pose.PoseLandmark[name]
        lm = landmarks[enum_val.value]
        return np.array([lm.x * w, lm.y * h], dtype=float)

    nose = get_point("NOSE")
    l_sh = get_point("LEFT_SHOULDER")
    r_sh = get_point("RIGHT_SHOULDER")
    l_hip = get_point("LEFT_HIP")
    r_hip = get_point("RIGHT_HIP")

    mid_hip = (l_hip + r_hip) / 2.0
    mid_shoulder = (l_sh + r_sh) / 2.0

    spine_vec = mid_shoulder - mid_hip
    spine_angle_deg = abs(math.degrees(math.atan2(spine_vec[0], spine_vec[1] + 1e-6)))

    shoulders_level = abs(l_sh[1] - r_sh[1]) / float(h)
    hips_level = abs(l_hip[1] - r_hip[1]) / float(h)
    head_forward = abs(nose[0] - mid_hip[0]) / float(w)

    # --- More lenient scoring (so not always 0) ---
    spine_norm = min(spine_angle_deg / 25.0, 1.0)        # 0–25° sideways
    shoulders_norm = min(shoulders_level / 0.10, 1.0)    # up to 10% of height
    hips_norm = min(hips_level / 0.10, 1.0)
    head_norm = min(head_forward / 0.15, 1.0)            # up to 15% width

    deviation = (
        0.4 * spine_norm
        + 0.25 * shoulders_norm
        + 0.2 * hips_norm
        + 0.15 * head_norm
    )
    deviation = max(0.0, min(1.0, deviation))

    quality = 1.0 - deviation
    score = max(0.0, min(100.0, quality * 100.0))

    # If pose is detected but score extremely low, clamp a bit
    if score < 5.0:
        score = 5.0

    # thresholds for "error angles" (inspired by your angle CSV)
    spine_thresh = 5.0        # degrees
    shoulder_thresh = 0.02    # 2% height
    hip_thresh = 0.02
    head_thresh = 0.03        # 3% width

    issues = {
        "spine": spine_angle_deg > spine_thresh,
        "shoulders": shoulders_level > shoulder_thresh,
        "hips": hips_level > hip_thresh,
        "head": head_forward > head_thresh,
    }

    feedback = []
    if issues["spine"]:
        feedback.append({
            "joint": "Spine alignment",
            "tip": "Your spine is leaning sideways. Try to stack ears, shoulders and hips in one vertical line.",
        })
    if issues["shoulders"]:
        feedback.append({
            "joint": "Shoulders",
            "tip": "Your shoulders are uneven. Relax them and gently draw them down and away from your ears.",
        })
    if issues["hips"]:
        feedback.append({
            "joint": "Hips & pelvis",
            "tip": "Your hips are not level. Distribute your weight evenly and avoid leaning to one side.",
        })
    if issues["head"]:
        feedback.append({
            "joint": "Head & neck",
            "tip": "Your head is drifting forward. Tuck your chin slightly and imagine a string pulling the crown upward.",
        })

    if not feedback:
        feedback.append({
            "joint": "Overall posture",
            "tip": "Great job! Your alignment looks balanced. Maintain this form during long sessions.",
        })

    # ---- Draw detected skeleton (errors red, others green) ----
    image_pil = Image.fromarray(image_rgb)
    ann_img = image_pil.copy()
    draw = ImageDraw.Draw(ann_img)

    l_elbow = get_point("LEFT_ELBOW")
    r_elbow = get_point("RIGHT_ELBOW")
    l_wrist = get_point("LEFT_WRIST")
    r_wrist = get_point("RIGHT_WRIST")
    l_knee = get_point("LEFT_KNEE")
    r_knee = get_point("RIGHT_KNEE")
    l_ankle = get_point("LEFT_ANKLE")
    r_ankle = get_point("RIGHT_ANKLE")

    joints = {
        "nose": nose,
        "l_sh": l_sh,
        "r_sh": r_sh,
        "l_elbow": l_elbow,
        "r_elbow": r_elbow,
        "l_wrist": l_wrist,
        "r_wrist": r_wrist,
        "l_hip": l_hip,
        "r_hip": r_hip,
        "l_knee": l_knee,
        "r_knee": r_knee,
        "l_ankle": l_ankle,
        "r_ankle": r_ankle,
    }

    segments = [
        ("l_ankle", "l_knee"),
        ("l_knee", "l_hip"),
        ("r_ankle", "r_knee"),
        ("r_knee", "r_hip"),
        ("l_hip", "r_hip"),
        ("l_sh", "r_sh"),
        ("l_hip", "l_sh"),
        ("r_hip", "r_sh"),
        ("l_sh", "l_elbow"),
        ("l_elbow", "l_wrist"),
        ("r_sh", "r_elbow"),
        ("r_elbow", "r_wrist"),
        ("nose", "l_sh"),
        ("nose", "r_sh"),
    ]

    def segment_issue(name_a, name_b):
        # spine: hips <-> shoulders / nose
        if {name_a, name_b} & {"l_hip", "r_hip"} and {name_a, name_b} & {"l_sh", "r_sh", "nose"}:
            return issues["spine"]
        # shoulders & arms
        if {name_a, name_b} <= {"l_sh", "r_sh", "l_elbow", "r_elbow", "l_wrist", "r_wrist"}:
            return issues["shoulders"]
        # hips & legs
        if {name_a, name_b} <= {"l_hip", "r_hip", "l_knee", "r_knee", "l_ankle", "r_ankle"}:
            return issues["hips"]
        # head / neck via nose
        if "nose" in (name_a, name_b):
            return issues["head"]
        return False

    error_segments = []
    ok_segments = []
    for a, b in segments:
        if segment_issue(a, b):
            error_segments.append((a, b))
        else:
            ok_segments.append((a, b))

    def draw_line(p1, p2, color, width=4):
        draw.line((p1[0], p1[1], p2[0], p2[1]), fill=color, width=width)

    def draw_point(p, color, r=4):
        x, y = p
        draw.ellipse((x - r, y - r, x + r, y + r), fill=color)

    # OK segments green, error segments red
    for a, b in ok_segments:
        draw_line(joints[a], joints[b], color=(0, 255, 0), width=4)
    for a, b in error_segments:
        draw_line(joints[a], joints[b], color=(255, 0, 0), width=5)

    # joints colored based on related issues
    for name, p in joints.items():
        color = (0, 255, 0)
        if name in {"l_sh", "r_sh", "l_elbow", "r_elbow", "l_wrist", "r_wrist"} and issues["shoulders"]:
            color = (255, 0, 0)
        if name in {"l_hip", "r_hip", "l_knee", "r_knee", "l_ankle", "r_ankle"} and issues["hips"]:
            color = (255, 0, 0)
        if name in {"nose"} and issues["head"]:
            color = (255, 0, 0)
        draw_point(p, color=color, r=4)

    # ---------- Ideal / corrected skeleton (all green) ----------
    ideal_img = image_pil.copy()
    draw2 = ImageDraw.Draw(ideal_img)
    ideal = {k: v.copy() for k, v in joints.items()}

    # shoulders level
    avg_sh_y = (ideal["l_sh"][1] + ideal["r_sh"][1]) / 2.0
    ideal["l_sh"][1] = avg_sh_y
    ideal["r_sh"][1] = avg_sh_y

    # hips level
    avg_hip_y = (ideal["l_hip"][1] + ideal["r_hip"][1]) / 2.0
    ideal["l_hip"][1] = avg_hip_y
    ideal["r_hip"][1] = avg_hip_y

    # spine more vertical: align shoulders center with hip center
    mid_hip_x = (ideal["l_hip"][0] + ideal["r_hip"][0]) / 2.0
    sh_mid_x = (ideal["l_sh"][0] + ideal["r_sh"][0]) / 2.0
    shift = mid_hip_x - sh_mid_x
    ideal["l_sh"][0] += shift
    ideal["r_sh"][0] += shift

    ideal["nose"][0] = mid_hip_x

    def draw_line2(p1, p2, color=(0, 255, 0), width=4):
        draw2.line((p1[0], p1[1], p2[0], p2[1]), fill=color, width=width)

    def draw_point2(p, color=(0, 255, 0), r=4):
        x, y = p
        draw2.ellipse((x - r, y - r, x + r, y + r), fill=color)

    for a, b in segments:
        draw_line2(ideal[a], ideal[b])
    for p in ideal.values():
        draw_point2(p)

    return {
        "score": float(score),
        "feedback": feedback,
        "annotated_b64": _pil_to_base64(ann_img),
        "ideal_b64": _pil_to_base64(ideal_img),
    }

# ---------- /analyze ----------
@app.post("/analyze")
def api_analyze():
    if mp_pose is None:
        return jsonify({
            "error": "mediapipe not installed. Run: pip install mediapipe opencv-python pillow numpy"
        }), 500

    if "file" not in request.files:
        return jsonify({"error": "No file part in request. Use 'file' field."}), 400

    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify({"error": "Empty file upload."}), 400

    try:
        file_bytes = np.frombuffer(file.read(), np.uint8)
        if file_bytes.size == 0:
            return jsonify({"error": "Uploaded file is empty."}), 400

        img_bgr = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        if img_bgr is None:
            return jsonify({"error": "Could not decode image."}), 400

        analysis = analyze_posture_image(img_bgr)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print("analyze error:", e)
        return jsonify({"error": "Failed to analyze posture."}), 500

    return jsonify(
        {
            "ok": True,
            "posture_score": analysis["score"],
            "feedback": analysis["feedback"],
            "annotated_image_base64": analysis["annotated_b64"],
            "corrected_skeleton_image_base64": analysis["ideal_b64"],
        }
    ), 200

# ---------- /generate_tips (Gemini 2.5 Flash) ----------
@app.post("/generate_tips")
def api_generate_tips():
    if genai is None or not GEMINI_API_KEY:
        return jsonify({
            "error": "Gemini not configured. Install google-generativeai and set GEMINI_API_KEY / GOOGLE_API_KEY / API_KEY in key.env."
        }), 500

    data = request.get_json(silent=True) or {}
    activity = (data.get("activity") or "posture").strip()
    posture_data = data.get("posture_data") or {}
    score = posture_data.get("score")
    feedback_list = posture_data.get("feedback") or []
    if not isinstance(feedback_list, list):
        feedback_list = []

    user_prompt = f"""
You are an expert posture and movement coach.

The user has just uploaded an image/video. A posture analysis model has produced:
- Activity / context: {activity}
- Overall alignment score (0–100, higher is better): {score}

Per-joint feedback in JSON:
{json.dumps(feedback_list, ensure_ascii=False, indent=2)}

Based on this information, write practical, concise improvement tips for the user.

Requirements:
- Address the user directly in second person ("you").
- Start with 1–2 short sentences summarizing how their posture looks overall.
- Then give 4–8 specific bullet points with corrections and cues.
- If the activity suggests yoga or exercise, you may mention breath, control, and avoiding pain.
- Keep language simple, friendly, and motivational.
- Answer in markdown. Do NOT wrap the response in backticks.
""".strip()

    try:
        # ✅ Use Gemini 2.5 Flash for text
        model = genai.GenerativeModel(GEMINI_TEXT_MODEL)
        response = model.generate_content(user_prompt)
        tips_text = (response.text or "").strip()
        if not tips_text:
            return jsonify({"error": "Gemini returned empty tips."}), 500

        return jsonify({"tips": tips_text}), 200
    except Exception as e:
        print("Gemini generate_tips error:", repr(e))
        return jsonify({"error": "Failed to generate tips with Gemini."}), 500

# ---------- DEBUG ----------
@app.get("/api/all_users")
def api_all_users():
    db = get_db()
    cur = db.execute(
        "SELECT id, email, username, provider, email_verified, created_at FROM users ORDER BY id DESC"
    )
    return jsonify([dict(row) for row in cur.fetchall()]), 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting apiserver on http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
