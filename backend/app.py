from flask import Flask
from flask_cors import CORS

from routes.authRoute import auth_bp
from routes.postureRoute import posture_bp
from routes.scoreRoute import score_bp
from routes.tipsRoute import tips_bp
from routes.otpRoute import otp_bp
from dotenv import load_dotenv
load_dotenv("keys.env")

app = Flask(__name__)

CORS(app,
    origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    supports_credentials=True
)

app.register_blueprint(auth_bp)
app.register_blueprint(posture_bp)
app.register_blueprint(score_bp)
app.register_blueprint(tips_bp)
app.register_blueprint(otp_bp)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)