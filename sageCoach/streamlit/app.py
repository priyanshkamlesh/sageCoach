import streamlit as st
import cv2
import mediapipe as mp
import numpy as np
import tempfile
import requests
from PIL import Image 
import os

# ---------------------------------
# Configuration
# ---------------------------------
API_URL = "http://127.0.0.1:5000"  # Flask backend

st.set_page_config(page_title="Posture Correction AI", layout="wide")
st.title("🏋️‍♂️ Posture Analysis & Correction Model")

# Mediapipe setup
mp_pose = mp.solutions.pose
pose = mp_pose.Pose(static_image_mode=True, min_detection_confidence=0.5)
mp_drawing = mp.solutions.drawing_utils


# ---------------------------------
# Helper Functions
# ---------------------------------
def calculate_angle(a, b, c):
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)
    radians = np.arctan2(c[1] - b[1], c[0] - b[0]) - np.arctan2(a[1] - b[1], a[0] - b[0])
    angle = np.abs(radians * 180.0 / np.pi)
    if angle > 180.0:
        angle = 360 - angle
    return angle


def analyze_pose(image):
    results = pose.process(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    if not results.pose_landmarks:
        return image, [], 0

    h, w, _ = image.shape
    landmarks = results.pose_landmarks.landmark

    joints = {
        "Left Elbow": [mp_pose.PoseLandmark.LEFT_SHOULDER.value,
                       mp_pose.PoseLandmark.LEFT_ELBOW.value,
                       mp_pose.PoseLandmark.LEFT_WRIST.value],
        "Right Elbow": [mp_pose.PoseLandmark.RIGHT_SHOULDER.value,
                        mp_pose.PoseLandmark.RIGHT_ELBOW.value,
                        mp_pose.PoseLandmark.RIGHT_WRIST.value],
        "Left Knee": [mp_pose.PoseLandmark.LEFT_HIP.value,
                      mp_pose.PoseLandmark.LEFT_KNEE.value,
                      mp_pose.PoseLandmark.LEFT_ANKLE.value],
        "Right Knee": [mp_pose.PoseLandmark.RIGHT_HIP.value,
                       mp_pose.PoseLandmark.RIGHT_KNEE.value,
                       mp_pose.PoseLandmark.RIGHT_ANKLE.value],
        "Left Shoulder": [mp_pose.PoseLandmark.LEFT_ELBOW.value,
                          mp_pose.PoseLandmark.LEFT_SHOULDER.value,
                          mp_pose.PoseLandmark.LEFT_HIP.value],
        "Right Shoulder": [mp_pose.PoseLandmark.RIGHT_ELBOW.value,
                           mp_pose.PoseLandmark.RIGHT_SHOULDER.value,
                           mp_pose.PoseLandmark.RIGHT_HIP.value]
    }

    IDEAL_RANGES = {
        "Left Elbow": (150, 180),
        "Right Elbow": (150, 180),
        "Left Knee": (160, 180),
        "Right Knee": (160, 180),
        "Left Shoulder": (70, 110),
        "Right Shoulder": (70, 110)
    }

    incorrect_joints = []
    correct_count = 0

    for joint, (a, b, c) in joints.items():
        angle = calculate_angle(
            [landmarks[a].x * w, landmarks[a].y * h],
            [landmarks[b].x * w, landmarks[b].y * h],
            [landmarks[c].x * w, landmarks[c].y * h]
        )
        min_angle, max_angle = IDEAL_RANGES[joint]
        if min_angle <= angle <= max_angle:
            color = (0, 255, 0)
            correct_count += 1
        else:
            color = (0, 0, 255)
            incorrect_joints.append(joint)

        cv2.putText(image, joint, (int(landmarks[b].x * w), int(landmarks[b].y * h)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1, cv2.LINE_AA)
        mp_drawing.draw_landmarks(image, results.pose_landmarks, mp_pose.POSE_CONNECTIONS)

    posture_score = (correct_count / len(IDEAL_RANGES)) * 100
    return image, incorrect_joints, posture_score


# ---------------------------------
# Sidebar User Input
# ---------------------------------
with st.sidebar:
    st.header("👤 User Information")
    name = st.text_input("Enter your name:")
    gender = st.selectbox("Select Gender:", ["Male", "Female"])
    age = st.number_input("Enter Age:", min_value=10, max_value=60, value=20)
    activity = st.text_input("Enter activity (e.g., Sprint Start, Long Jump):")

    st.markdown("---")
    st.info("Please confirm your details before uploading media.")
    confirm = st.button("✅ Confirm Details")

if confirm:
    st.session_state["user_info"] = {
        "name": name,
        "gender": gender,
        "age": age,
        "activity": activity
    }
    st.success("User details saved successfully!")

# ---------------------------------
# Upload Section
# ---------------------------------
frame = None
incorrect_joints = []
score = 0

if "user_info" in st.session_state:
    st.subheader("📤 Upload Image or Video for Posture Analysis")

    file = st.file_uploader("Upload your image or video", type=["jpg", "jpeg", "png", "mp4"], key="unique_uploader")

    if file is not None:
        file_type = file.type.split("/")[0]
        tfile = tempfile.NamedTemporaryFile(delete=False)
        tfile.write(file.read())
        tfile.flush()

        # Handle Image
        if file_type == "image":
            with open(tfile.name, "rb") as f:
                file_bytes = np.asarray(bytearray(f.read()), dtype=np.uint8)
            frame = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

        # Handle Video
        elif file_type == "video":
            cap = cv2.VideoCapture(tfile.name)
            success, frame = cap.read()
            cap.release()
            if not success:
                st.error("⚠️ Could not read video frame.")
                frame = None

        if frame is None or frame.size == 0:
            st.error("⚠️ Unable to read or decode the file. Please upload a valid image or video.")
        else:
            image, incorrect_joints, score = analyze_pose(frame)
            st.image(image, channels="BGR", caption=f"Detected Posture — Score: {score:.2f}%", use_container_width=True)

            # ----------- AI Feedback -----------
            if st.button("🧠 Get Improvement Tips"):
                with st.spinner("Analyzing..."):
                    response = requests.post(f"{API_URL}/generate_tips", json={
                        "name": st.session_state['user_info']['name'],
                        "gender": st.session_state['user_info']['gender'],
                        "activity": st.session_state['user_info']['activity'],
                        "posture_data": incorrect_joints
                    })
                    if response.status_code == 200:
                        feedback = response.json().get("tips", "<br>")
                        st.markdown("### 🧠 Feedback Summary")
                        st.write(feedback)
                    else:
                        st.error(f"Failed to fetch tips: {response.text}")

            # ----------- AI Ideal Posture -----------
            if st.button("🌟 Generate Ideal Posture Image"):
                with st.spinner("Generating ideal posture..."):
                    if file is not None:
                        files = {"file": open(tfile.name, "rb")}
                        response = requests.post(f"{API_URL}/generate_ideal_posture", files=files)

                        if response.status_code == 200:
                            data = response.json()
                            st.success(data.get("message", "Ideal posture generated!"))

                            if "image_path" in data and os.path.exists(data["image_path"]):
                                ideal_img = Image.open(data["image_path"])
                                st.image(ideal_img, caption="AI-Generated Ideal Posture", use_container_width=True)
                            else:
                                st.warning("⚠️ No image found in response.")
                        else:
                            st.error(f"Request failed: {response.text}")
                    else:
                        st.warning("⚠️ Please upload an image first!")

else:
    st.warning("Please confirm your details in the sidebar first.")
