import math
import base64
from io import BytesIO

import numpy as np
import cv2
from PIL import Image, ImageDraw

try:
    import mediapipe as mp
    mp_pose = mp.solutions.pose
except ImportError:
    mp_pose = None


# ---------------------------
# Helper: PIL → Base64
# ---------------------------
def pil_to_base64(img: Image.Image) -> str:
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return base64.b64encode(buf.getvalue()).decode("ascii")


# ---------------------------
# Main posture analysis
# ---------------------------
def analyze_posture_image(image_bgr: np.ndarray):

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

    # key points
    nose = get_point("NOSE")
    l_sh = get_point("LEFT_SHOULDER")
    r_sh = get_point("RIGHT_SHOULDER")
    l_hip = get_point("LEFT_HIP")
    r_hip = get_point("RIGHT_HIP")

    mid_hip = (l_hip + r_hip) / 2
    mid_sh = (l_sh + r_sh) / 2

    # ---------------------------
    # posture measurements
    # ---------------------------

    spine_vec = mid_sh - mid_hip
    spine_angle_deg = abs(math.degrees(math.atan2(spine_vec[0], spine_vec[1] + 1e-6)))

    shoulders_level = abs(l_sh[1] - r_sh[1]) / float(h)
    hips_level = abs(l_hip[1] - r_hip[1]) / float(h)
    head_forward = abs(nose[0] - mid_hip[0]) / float(w)

    # ---------------------------
    # scoring
    # ---------------------------

    spine_norm = min(spine_angle_deg / 25.0, 1.0)
    shoulders_norm = min(shoulders_level / 0.10, 1.0)
    hips_norm = min(hips_level / 0.10, 1.0)
    head_norm = min(head_forward / 0.15, 1.0)

    deviation = (
        0.4 * spine_norm
        + 0.25 * shoulders_norm
        + 0.2 * hips_norm
        + 0.15 * head_norm
    )

    deviation = max(0.0, min(1.0, deviation))
    quality = 1.0 - deviation
    score = max(0.0, min(100.0, quality * 100.0))

    if score < 5:
        score = 5.0

    # ---------------------------
    # issue detection
    # ---------------------------

    spine_thresh = 5.0
    shoulder_thresh = 0.02
    hip_thresh = 0.02
    head_thresh = 0.03

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
            "tip": "Your spine is leaning sideways. Try stacking ears, shoulders, and hips in one vertical line."
        })

    if issues["shoulders"]:
        feedback.append({
            "joint": "Shoulders",
            "tip": "Your shoulders are uneven. Relax them and draw them slightly down."
        })

    if issues["hips"]:
        feedback.append({
            "joint": "Hips",
            "tip": "Your hips are not level. Distribute your weight evenly."
        })

    if issues["head"]:
        feedback.append({
            "joint": "Head & neck",
            "tip": "Your head is drifting forward. Tuck your chin slightly."
        })

    if not feedback:
        feedback.append({
            "joint": "Overall posture",
            "tip": "Great posture! Maintain this alignment."
        })

    # ---------------------------
    # skeleton drawing
    # ---------------------------

    image_pil = Image.fromarray(image_rgb)
    ann_img = image_pil.copy()
    draw = ImageDraw.Draw(ann_img)

    # additional joints
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

    def draw_line(p1, p2, color, width=4):
        draw.line((p1[0], p1[1], p2[0], p2[1]), fill=color, width=width)

    def draw_point(p, color, r=4):
        x, y = p
        draw.ellipse((x-r, y-r, x+r, y+r), fill=color)

    # draw skeleton
    for a, b in segments:
        draw_line(joints[a], joints[b], (0, 255, 0))

    for p in joints.values():
        draw_point(p, (0, 255, 0))

    # ---------------------------
    # ideal skeleton
    # ---------------------------

    ideal_img = image_pil.copy()
    draw2 = ImageDraw.Draw(ideal_img)
    ideal = {k: v.copy() for k, v in joints.items()}

    avg_sh = (ideal["l_sh"][1] + ideal["r_sh"][1]) / 2
    ideal["l_sh"][1] = avg_sh
    ideal["r_sh"][1] = avg_sh

    avg_hip = (ideal["l_hip"][1] + ideal["r_hip"][1]) / 2
    ideal["l_hip"][1] = avg_hip
    ideal["r_hip"][1] = avg_hip

    mid_hip_x = (ideal["l_hip"][0] + ideal["r_hip"][0]) / 2
    sh_mid_x = (ideal["l_sh"][0] + ideal["r_sh"][0]) / 2
    shift = mid_hip_x - sh_mid_x

    ideal["l_sh"][0] += shift
    ideal["r_sh"][0] += shift
    ideal["nose"][0] = mid_hip_x

    for a, b in segments:
        draw2.line(
            (ideal[a][0], ideal[a][1], ideal[b][0], ideal[b][1]),
            fill=(0,255,0),
            width=4
        )

    for p in ideal.values():
        x,y = p
        draw2.ellipse((x-4,y-4,x+4,y+4), fill=(0,255,0))

    return {
        "score": float(score),
        "feedback": feedback,
        "annotated_b64": pil_to_base64(ann_img),
        "ideal_b64": pil_to_base64(ideal_img),
    }