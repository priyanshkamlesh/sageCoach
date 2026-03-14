from flask import Blueprint
from controllers.authController import register, login

auth_bp = Blueprint("auth",__name__)

auth_bp.route("/api/register",methods=["POST"])(register)
auth_bp.route("/api/login",methods=["POST"])(login)