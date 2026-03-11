from flask import request, jsonify
from models.userModels import create_user, find_user
from werkzeug.security import check_password_hash

def register():

    data = request.json

    email = data.get("email")
    password = data.get("password")
    username = data.get("username")

    if find_user(email):
        return jsonify({"error":"user_exists"}),400

    create_user(email,password,username)

    return jsonify({"ok":True})

# Login User

def login():

    data = request.json

    email = data.get("email")
    password = data.get("password")

    user = find_user(email)

    if not user:
        return jsonify({"error":"invalid"}),401

    if not check_password_hash(user["password_hash"],password):
        return jsonify({"error":"invalid"}),401

    return jsonify({"ok":True})