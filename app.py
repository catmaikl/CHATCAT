import eventlet
eventlet.monkey_patch()

import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO
from flask_login import LoginManager, login_required, current_user, login_user, logout_user
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-123')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///messenger.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Инициализация расширений
from models import db
db.init_app(app)

login_manager = LoginManager()
login_manager.init_app(app)

socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Модели
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    first_name = db.Column(db.String(50))
    last_name = db.Column(db.String(50))
    bio = db.Column(db.Text)
    avatar = db.Column(db.String(200))
    is_online = db.Column(db.Boolean, default=False)
    last_seen = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Chat(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    is_group = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class ChatMember(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.Integer, db.ForeignKey('chat.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.Integer, db.ForeignKey('chat.id'), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Contact(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    contact_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Аутентификация
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Создаем тестовые данные при первом запуске
def create_sample_data():
    with app.app_context():
        db.create_all()
        
        # Создаем тестовых пользователей если их нет
        if not User.query.first():
            users = [
                User(
                    username='anna', 
                    email='anna@test.com',
                    password_hash=generate_password_hash('password123'),
                    first_name='Анна',
                    last_name='Иванова'
                ),
                User(
                    username='ivan', 
                    email='ivan@test.com',
                    password_hash=generate_password_hash('password123'),
                    first_name='Иван', 
                    last_name='Петров'
                ),
                User(
                    username='maria',
                    email='maria@test.com', 
                    password_hash=generate_password_hash('password123'),
                    first_name='Мария',
                    last_name='Сидорова'
                )
            ]
            db.session.add_all(users)
            db.session.commit()
            
            # Создаем тестовые чаты
            chat1 = Chat(name='Личный чат', is_group=False)
            chat2 = Chat(name='Рабочая группа', is_group=True)
            db.session.add_all([chat1, chat2])
            db.session.commit()
            
            # Добавляем участников в чаты
            members1 = [
                ChatMember(chat_id=chat1.id, user_id=users[0].id),
                ChatMember(chat_id=chat1.id, user_id=users[1].id)
            ]
            members2 = [
                ChatMember(chat_id=chat2.id, user_id=user.id) for user in users
            ]
            db.session.add_all(members1 + members2)
            
            # Создаем тестовые сообщения
            messages = [
                Message(
                    chat_id=chat1.id,
                    sender_id=users[0].id,
                    content='Привет! Как дела?'
                ),
                Message(
                    chat_id=chat1.id, 
                    sender_id=users[1].id,
                    content='Привет! Все отлично, спасибо!'
                ),
                Message(
                    chat_id=chat2.id,
                    sender_id=users[2].id, 
                    content='Всем привет! Напоминаю о встрече завтра в 10:00'
                )
            ]
            db.session.add_all(messages)
            
            # Создаем контакты
            contacts = [
                Contact(user_id=users[0].id, contact_id=users[1].id),
                Contact(user_id=users[0].id, contact_id=users[2].id)
            ]
            db.session.add_all(contacts)
            
            db.session.commit()
            print("✅ Sample data created!")

# Маршруты аутентификации
@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.get_json()
    
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'status': 'error', 'message': 'Пользователь с таким именем уже существует'})
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'status': 'error', 'message': 'Пользователь с таким email уже существует'})
    
    user = User(
        username=data['username'],
        email=data['email'],
        password_hash=generate_password_hash(data['password']),
        first_name=data['first_name'],
        last_name=data.get('last_name')
    )
    
    db.session.add(user)
    db.session.commit()
    
    login_user(user)
    return jsonify({
        'status': 'success', 
        'user': {
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name
        }
    })

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    user = User.query.filter_by(username=data['username']).first()
    
    if user and check_password_hash(user.password_hash, data['password']):
        user.is_online = True
        user.last_seen = datetime.utcnow()
        db.session.commit()
        login_user(user)
        return jsonify({
            'status': 'success', 
            'user': {
                'id': user.id,
                'username': user.username, 
                'first_name': user.first_name
            }
        })
    
    return jsonify({'status': 'error', 'message': 'Неверные учетные данные'})

@app.route('/api/logout', methods=['POST'])
@login_required
def api_logout():
    current_user.is_online = False
    current_user.last_seen = datetime.utcnow()
    db.session.commit()
    logout_user()
    return jsonify({'status': 'success'})

# Профиль пользователя
@app.route('/api/user/profile', methods=['PUT'])
@login_required
def update_user_profile():
    data = request.get_json()
    
    current_user.first_name = data.get('first_name', current_user.first_name)
    current_user.last_name = data.get('last_name', current_user.last_name)
    current_user.bio = data.get('bio', current_user.bio)
    
    db.session.commit()
    
    return jsonify({
        'status': 'success', 
        'message': 'Профиль обновлен',
        'user': {
            'id': current_user.id,
            'username': current_user.username,
            'first_name': current_user.first_name,
            'last_name': current_user.last_name,
            'bio': current_user.bio
        }
    })

@app.route('/api/user', methods=['GET'])
@login_required
def get_user_profile():
    return jsonify({
        'status': 'success',
        'user': {
            'id': current_user.id,
            'username': current_user.username,
            'first_name': current_user.first_name,
            'last_name': current_user.last_name,
            'email': current_user.email,
            'bio': current_user.bio,
            'avatar': current_user.avatar,
            'is_online': current_user.is_online
        }
    })

# Чаты
@app.route('/api/chats', methods=['GET'])
@login_required
def get_chats():
    user_chats = Chat.query.join(ChatMember).filter(
        ChatMember.user_id == current_user.id
    ).all()
    
    chats_data = []
    for chat in user_chats:
        last_message = Message.query.filter_by(chat_id=chat.id).order_by(
            Message.created_at.desc()
        ).first()
        
        # Получаем название чата (для личных чатов - имя собеседника)
        chat_name = chat.name
        if not chat.is_group:
            other_member = ChatMember.query.filter(
                ChatMember.chat_id == chat.id,
                ChatMember.user_id != current_user.id
            ).first()
            if other_member:
                other_user = User.query.get(other_member.user_id)
                chat_name = f"{other_user.first_name} {other_user.last_name}"
        
        chats_data.append({
            'id': chat.id,
            'name': chat_name,
            'is_group': chat.is_group,
            'last_message': {
                'content': last_message.content if last_message else '',
                'sender_id': last_message.sender_id if last_message else None,
                'created_at': last_message.created_at.isoformat() if last_message else None
            },
            'unread_count': Message.query.filter_by(
                chat_id=chat.id, 
                is_read=False
            ).filter(Message.sender_id != current_user.id).count()
        })
    
    return jsonify({'status': 'success', 'chats': chats_data})

@app.route('/api/chats/<int:chat_id>/messages', methods=['GET'])
@login_required
def get_chat_messages(chat_id):
    messages = Message.query.filter_by(chat_id=chat_id).order_by(
        Message.created_at.asc()
    ).all()
    
    messages_data = []
    for message in messages:
        sender = User.query.get(message.sender_id)
        messages_data.append({
            'id': message.id,
            'content': message.content,
            'sender_id': message.sender_id,
            'sender_name': f"{sender.first_name} {sender.last_name}",
            'is_read': message.is_read,
            'created_at': message.created_at.isoformat()
        })
    
    # Помечаем сообщения как прочитанные
    Message.query.filter_by(chat_id=chat_id, is_read=False).filter(
        Message.sender_id != current_user.id
    ).update({'is_read': True})
    db.session.commit()
    
    return jsonify({'status': 'success', 'messages': messages_data})

@app.route('/api/chats/<int:chat_id>/send', methods=['POST'])
@login_required
def send_message(chat_id):
    data = request.get_json()
    content = data.get('content')
    
    if not content:
        return jsonify({'status': 'error', 'message': 'Сообщение не может быть пустым'})
    
    message = Message(
        chat_id=chat_id,
        sender_id=current_user.id,
        content=content
    )
    
    db.session.add(message)
    db.session.commit()
    
    # Отправляем через WebSocket
    socketio.emit('new_message', {
        'id': message.id,
        'content': content,
        'sender_id': current_user.id,
        'sender_name': f"{current_user.first_name} {current_user.last_name}",
        'chat_id': chat_id,
        'created_at': message.created_at.isoformat()
    }, room=f'chat_{chat_id}')
    
    return jsonify({'status': 'success', 'message_id': message.id})

# Контакты
@app.route('/api/contacts', methods=['GET'])
@login_required
def get_contacts():
    contacts = Contact.query.filter_by(user_id=current_user.id).all()
    
    contacts_data = []
    for contact in contacts:
        user = User.query.get(contact.contact_id)
        contacts_data.append({
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'is_online': user.is_online,
            'last_seen': user.last_seen.isoformat()
        })
    
    return jsonify({'status': 'success', 'contacts': contacts_data})

@app.route('/api/contacts/add', methods=['POST'])
@login_required
def add_contact():
    data = request.get_json()
    contact_username = data.get('username')
    
    contact_user = User.query.filter_by(username=contact_username).first()
    if not contact_user:
        return jsonify({'status': 'error', 'message': 'Пользователь не найден'})
    
    if contact_user.id == current_user.id:
        return jsonify({'status': 'error', 'message': 'Нельзя добавить себя в контакты'})
    
    existing_contact = Contact.query.filter_by(
        user_id=current_user.id,
        contact_id=contact_user.id
    ).first()
    
    if existing_contact:
        return jsonify({'status': 'error', 'message': 'Контакт уже добавлен'})
    
    contact = Contact(user_id=current_user.id, contact_id=contact_user.id)
    db.session.add(contact)
    
    # Создаем приватный чат
    chat = Chat(name=f"Чат с {contact_user.username}", is_group=False)
    db.session.add(chat)
    db.session.flush()
    
    # Добавляем участников
    member1 = ChatMember(chat_id=chat.id, user_id=current_user.id)
    member2 = ChatMember(chat_id=chat.id, user_id=contact_user.id)
    db.session.add_all([member1, member2])
    
    db.session.commit()
    
    return jsonify({'status': 'success', 'contact_id': contact_user.id, 'chat_id': chat.id})

@app.route('/api/chats/create', methods=['POST'])
@login_required
def create_chat():
    data = request.get_json()
    contact_id = data.get('contact_id')
    
    contact_user = User.query.get(contact_id)
    if not contact_user:
        return jsonify({'status': 'error', 'message': 'Пользователь не найден'})
    
    # Проверяем есть ли уже чат
    existing_chat = db.session.query(Chat).join(ChatMember).filter(
        ChatMember.user_id == current_user.id
    ).join(ChatMember, Chat.id == ChatMember.chat_id).filter(
        ChatMember.user_id == contact_id
    ).filter(Chat.is_group == False).first()
    
    if existing_chat:
        return jsonify({'status': 'success', 'chat_id': existing_chat.id, 'exists': True})
    
    # Создаем новый чат
    chat = Chat(name=f"Чат с {contact_user.username}", is_group=False)
    db.session.add(chat)
    db.session.flush()
    
    member1 = ChatMember(chat_id=chat.id, user_id=current_user.id)
    member2 = ChatMember(chat_id=chat.id, user_id=contact_id)
    db.session.add_all([member1, member2])
    
    db.session.commit()
    
    return jsonify({'status': 'success', 'chat_id': chat.id})

# WebSocket
@socketio.on('connect')
@login_required
def handle_connect():
    current_user.is_online = True
    db.session.commit()
    emit('user_online', {'user_id': current_user.id}, broadcast=True)

@socketio.on('disconnect')
@login_required
def handle_disconnect():
    current_user.is_online = False
    current_user.last_seen = datetime.utcnow()
    db.session.commit()
    emit('user_offline', {'user_id': current_user.id}, broadcast=True)

@socketio.on('join_chat')
@login_required
def handle_join_chat(data):
    join_room(f'chat_{data["chat_id"]}')

@socketio.on('typing_start')
@login_required
def handle_typing_start(data):
    emit('user_typing', {
        'user_id': current_user.id,
        'user_name': f"{current_user.first_name} {current_user.last_name}",
        'chat_id': data['chat_id']
    }, room=f"chat_{data['chat_id']}", include_self=False)

@socketio.on('typing_stop')
@login_required
def handle_typing_stop(data):
    emit('user_stopped_typing', {
        'user_id': current_user.id,
        'chat_id': data['chat_id']
    }, room=f"chat_{data['chat_id']}", include_self=False)

# Основные маршруты
@app.route('/')
def index():
    if current_user.is_authenticated:
        return render_template('index.html')
    return render_template('auth.html')

@app.route('/health')
def health():
    return jsonify({"status": "healthy", "database": "connected"})

# Запуск приложения
if __name__ == '__main__':
    create_sample_data()
    port = int(os.environ.get('PORT', 5000))
    print(f"🚀 Starting server on port {port}")
    socketio.run(app, host='0.0.0.0', port=port, debug=False)