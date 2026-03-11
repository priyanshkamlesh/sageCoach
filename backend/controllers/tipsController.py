import os
import json
from flask import request, jsonify

try:
    import google.generativeai as genai
except ImportError:
    genai = None


# Load API key from environment
GEMINI_API_KEY = (
    os.getenv("GEMINI_API_KEY")
    or os.getenv("GOOGLE_API_KEY")
    or os.getenv("API_KEY")
)

GEMINI_TEXT_MODEL = os.getenv("GEMINI_TEXT_MODEL", "gemini-1.5-flash")

if genai is not None and GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


def api_generate_tips():

    if genai is None or not GEMINI_API_KEY:
        return jsonify({
            "error": "Gemini not configured. Set GEMINI_API_KEY in key.env"
        }), 500

    data = request.get_json(silent=True) or {}

    activity = (data.get("activity") or "posture").strip()

    posture_data = data.get("posture_data") or {}
    score = posture_data.get("score")

    feedback_list = posture_data.get("feedback") or []

    if not isinstance(feedback_list, list):
        feedback_list = []

    prompt = f"""
You are an expert posture and movement coach.

The user has uploaded an image and posture analysis produced:

Activity: {activity}
Posture Score: {score}

Joint Feedback:
{json.dumps(feedback_list, indent=2)}

Write practical improvement tips.

Rules:
- Address user as "you"
- Start with short posture summary
- Give 4–8 bullet points
- Keep language simple
- Use markdown
""".strip()

    try:

        model = genai.GenerativeModel(GEMINI_TEXT_MODEL)

        response = model.generate_content(prompt)

        tips = (response.text or "").strip()

        if not tips:
            return jsonify({"error": "Gemini returned empty response"}), 500

        return jsonify({"tips": tips}), 200

    except Exception as e:

        print("Gemini error:", e)

        return jsonify({
            "error": "Failed to generate tips"
        }), 500