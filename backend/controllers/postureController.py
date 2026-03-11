import numpy as np
import cv2
from flask import request, jsonify
from utils.posture import analyze_posture_image


def api_analyze():

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "Empty file"}), 400

    try:

        file_bytes = np.frombuffer(file.read(), np.uint8)

        if file_bytes.size == 0:
            return jsonify({"error": "Uploaded file is empty"}), 400

        img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

        if img is None:
            return jsonify({"error": "Invalid image format"}), 400

        result = analyze_posture_image(img)

        return jsonify({
            "ok": True,
            "posture_score": result["score"],
            "feedback": result["feedback"],
            "annotated_image_base64": result["annotated_b64"],
            "corrected_skeleton_image_base64": result["ideal_b64"]
        })

    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    except Exception as e:
        print("Posture analyze error:", e)
        return jsonify({"error": "Failed to analyze posture"}), 500