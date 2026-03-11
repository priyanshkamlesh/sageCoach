from utils.db import users_collection
from werkzeug.security import generate_password_hash


def create_user(email, password, username):

    password_hash = generate_password_hash(password)

    users_collection.insert_one({
        "email": email.lower(),
        "password_hash": password_hash,
        "username": username,
        "provider": "local",
        "email_verified": False,
        "profile": {}
    })


def find_user(email):

    user = users_collection.find_one({
        "email": email.lower()
    })

    return user