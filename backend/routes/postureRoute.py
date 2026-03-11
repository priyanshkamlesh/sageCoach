from flask import Blueprint
from controllers.postureController import api_analyze

posture_bp = Blueprint("posture", __name__)

posture_bp.route("/analyze", methods=["POST"])(api_analyze)