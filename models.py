from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
import base64
import os

db = SQLAlchemy()

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    phone = db.Column(db.String(20))
    first_name = db.Column(db.String(50))
    last_name = db.Column(db.String(50))
    bio = db.Column(db.Text)
    avatar = db.Column(db.String(200))
    is_online = db.Column(db.Boolean, default=False)
    last_seen = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Отношения
    sent_messages = db.relationship('Message', foreign_keys='Message.sender_id', backref='message_sender', lazy='dynamic')
    received_messages = db.relationship('Message', foreign_keys='Message.receiver_id', backref='message_receiver', lazy='dynamic')
    user_contacts = db.relationship('Contact', foreign_keys='Contact.user_id', backref='owner_user', lazy='dynamic')
    chat_memberships = db.relationship('ChatMember', backref='member_user', lazy='dynamic')

class Contact(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    contact_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Отношения
    contact_user = db.relationship('User', foreign_keys=[contact_id], backref='contacted_by_users')

class Chat(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    is_group = db.Column(db.Boolean, default=False)
    avatar = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    
    # Отношения
    messages = db.relationship('Message', backref='message_chat', lazy='dynamic')
    members = db.relationship('ChatMember', backref='member_chat', lazy='dynamic')

class ChatMember(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.Integer, db.ForeignKey('chat.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    role = db.Column(db.String(20), default='member')
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.Integer, db.ForeignKey('chat.id'), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    content = db.Column(db.Text, nullable=False)
    content_type = db.Column(db.String(20), default='text')  # text, image, file, audio, video, voice
    file_path = db.Column(db.String(200))
    file_name = db.Column(db.String(200))
    file_size = db.Column(db.Integer)
    mime_type = db.Column(db.String(100))
    is_encrypted = db.Column(db.Boolean, default=True)
    is_read = db.Column(db.Boolean, default=False)
    is_edited = db.Column(db.Boolean, default=False)
    is_deleted = db.Column(db.Boolean, default=False)
    is_pinned = db.Column(db.Boolean, default=False)
    reply_to_id = db.Column(db.Integer, db.ForeignKey('message.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Отношения
    reply_to = db.relationship('Message', remote_side=[id], backref='replies')

class File(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(200), nullable=False)
    file_path = db.Column(db.String(200), nullable=False)
    file_size = db.Column(db.Integer)
    mime_type = db.Column(db.String(100))
    uploaded_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

class UserSettings(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, unique=True)
    theme = db.Column(db.String(20), default='light')  # light, dark, auto
    notifications_enabled = db.Column(db.Boolean, default=True)
    sound_enabled = db.Column(db.Boolean, default=True)
    language = db.Column(db.String(10), default='ru')
    font_size = db.Column(db.String(10), default='medium')  # small, medium, large
    auto_download_media = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Отношения
    user = db.relationship('User', backref=db.backref('settings', uselist=False))

class MessageReaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey('message.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    emoji = db.Column(db.String(10), nullable=False)  # Unicode emoji
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Отношения
    message = db.relationship('Message', backref='reactions')
    user = db.relationship('User', backref='message_reactions')
    
    # Уникальность: один пользователь - одна реакция на сообще��ие
    __table_args__ = (db.UniqueConstraint('message_id', 'user_id', name='unique_user_message_reaction'),)

class ChatSettings(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.Integer, db.ForeignKey('chat.id'), nullable=False, unique=True)
    description = db.Column(db.Text)
    invite_link = db.Column(db.String(100), unique=True)
    max_members = db.Column(db.Integer, default=200)
    is_public = db.Column(db.Boolean, default=False)
    allow_media = db.Column(db.Boolean, default=True)
    allow_links = db.Column(db.Boolean, default=True)
    slow_mode = db.Column(db.Integer, default=0)  # seconds between messages
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Отношения
    chat = db.relationship('Chat', backref=db.backref('chat_settings', uselist=False))

class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(50), default='message')  # message, system, friend_request
    is_read = db.Column(db.Boolean, default=False)
    data = db.Column(db.Text)  # JSON data for additional info
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Отношения
    user = db.relationship('User', backref='notifications')