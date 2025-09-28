from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from flask import flash, redirect, url_for, request
from werkzeug.security import generate_password_hash, check_password_hash
from models import db, User
from datetime import datetime

login_manager = LoginManager()

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@login_manager.unauthorized_handler
def unauthorized():
    return redirect(url_for('login'))

def register_user(username, email, password, first_name, last_name=None, phone=None):
    """Регистрация нового пользователя"""
    if User.query.filter_by(username=username).first():
        return False, "Пользователь с таким именем уже существует"
    
    if User.query.filter_by(email=email).first():
        return False, "Пользователь с таким email уже существует"
    
    user = User(
        username=username,
        email=email,
        password_hash=generate_password_hash(password),
        first_name=first_name,
        last_name=last_name,
        phone=phone,
        is_online=True,
        last_seen=datetime.utcnow()
    )
    
    db.session.add(user)
    db.session.commit()
    
    return True, user

def authenticate_user(username, password):
    """Аутентификация пользователя"""
    user = User.query.filter_by(username=username).first()
    if user and check_password_hash(user.password_hash, password):
        user.is_online = True
        user.last_seen = datetime.utcnow()
        db.session.commit()
        return user
    return None

def update_user_online_status(user_id, is_online):
    """Обновление статуса онлайн"""
    user = User.query.get(user_id)
    if user:
        user.is_online = is_online
        user.last_seen = datetime.utcnow()
        db.session.commit()

def change_password(user_id, current_password, new_password):
    """Смена пароля"""
    user = User.query.get(user_id)
    if user and check_password_hash(user.password_hash, current_password):
        user.password_hash = generate_password_hash(new_password)
        db.session.commit()
        return True
    return False