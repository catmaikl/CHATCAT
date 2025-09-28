import os
from dotenv import load_dotenv

# ЭТА СТРОЧКА ДОЛЖНА БЫТЬ ПЕРВОЙ
load_dotenv()


from flask import Flask, render_template, request, jsonify, send_file
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_login import login_required, current_user, login_user, logout_user
from models import db, User, Chat, Message, Contact, ChatMember, File
from auth import login_manager, register_user, authenticate_user, update_user_online_status
from encryption import encryption_manager
from config import Config
from datetime import datetime
import uuid

app = Flask(__name__)
app.config.from_object(Config)

# Инициализация расширений
db.init_app(app)
login_manager.init_app(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Создание папок
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'avatars'), exist_ok=True)
os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'files'), exist_ok=True)

@app.route('/')
def index():
    if current_user.is_authenticated:
        return render_template('index.html')
    return """
            <!DOCTYPE html>
            <html>
            <head>
                <title>Little Kitten Chat</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        text-align: center; 
                        padding: 50px; 
                        background: linear-gradient(135deg, #667eea, #764ba2);
                        color: white;
                    }
                    .container {
                        background: white;
                        padding: 40px;
                        border-radius: 15px;
                        color: #333;
                        display: inline-block;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🐱 Little Kitten Chat</h1>
                    <p>Приложение запущено успешно!</p>
                    <p><a href="/api/chats" style="color: #667eea;">Перейти к API</a></p>
                </div>
            </body>
            </html>
        """

# API маршруты для аутентификации
@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.get_json()
    success, result = register_user(
        username=data['username'],
        email=data['email'],
        password=data['password'],
        first_name=data['first_name'],
        last_name=data.get('last_name'),
        phone=data.get('phone')
    )
    
    if success:
        login_user(result)
        return jsonify({'status': 'success', 'user': {
            'id': result.id,
            'username': result.username,
            'first_name': result.first_name
        }})
    else:
        return jsonify({'status': 'error', 'message': result})

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    user = authenticate_user(data['username'], data['password'])
    if user:
        login_user(user)
        return jsonify({'status': 'success', 'user': {
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name
        }})
    return jsonify({'status': 'error', 'message': 'Неверные учетные данные'})

@app.route('/api/logout', methods=['POST'])
@login_required
def api_logout():
    update_user_online_status(current_user.id, False)
    logout_user()
    return jsonify({'status': 'success'})

# API маршруты для чатов
@app.route('/api/chats', methods=['GET'])
@login_required
def get_chats():
    """Получение списка чатов пользователя"""
    user_chats = Chat.query.join(ChatMember).filter(
        ChatMember.user_id == current_user.id
    ).all()
    
    chats_data = []
    for chat in user_chats:
        last_message = Message.query.filter_by(chat_id=chat.id).order_by(
            Message.created_at.desc()
        ).first()
        
        chat_data = {
            'id': chat.id,
            'name': chat.name,
            'is_group': chat.is_group,
            'avatar': chat.avatar,
            'last_message': {
                'content': encryption_manager.decrypt_message(last_message.content) if last_message else '',
                'sender_id': last_message.sender_id if last_message else None,
                'created_at': last_message.created_at.isoformat() if last_message else None
            } if last_message else None,
            'unread_count': Message.query.filter_by(
                chat_id=chat.id, 
                is_read=False
            ).filter(Message.sender_id != current_user.id).count()
        }
        chats_data.append(chat_data)
    
    return jsonify({'status': 'success', 'chats': chats_data})

@app.route('/api/chats/<int:chat_id>/messages', methods=['GET'])
@login_required
def get_chat_messages(chat_id):
    """Получение сообщений чата"""
    page = request.args.get('page', 1, type=int)
    per_page = 50
    
    messages = Message.query.filter_by(chat_id=chat_id).order_by(
        Message.created_at.desc()
    ).paginate(page=page, per_page=per_page, error_out=False)
    
    messages_data = []
    for message in messages.items:
        decrypted_content = encryption_manager.decrypt_message(message.content) if message.is_encrypted else message.content
        
        messages_data.append({
            'id': message.id,
            'content': decrypted_content,
            'content_type': message.content_type,
            'sender_id': message.sender_id,
            'is_encrypted': message.is_encrypted,
            'is_read': message.is_read,
            'created_at': message.created_at.isoformat(),
            'file_path': message.file_path
        })
    
    # Помечаем сообщения как прочитанные
    Message.query.filter_by(chat_id=chat_id, is_read=False).filter(
        Message.sender_id != current_user.id
    ).update({'is_read': True})
    db.session.commit()
    
    return jsonify({
        'status': 'success',
        'messages': messages_data[::-1],  # Возвращаем в правильном порядке
        'has_next': messages.has_next,
        'has_prev': messages.has_prev
    })

@app.route('/api/chats/<int:chat_id>/send', methods=['POST'])
@login_required
def send_message(chat_id):
    """Отправка сообщения"""
    data = request.get_json()
    content = data.get('content')
    content_type = data.get('content_type', 'text')
    
    if not content:
        return jsonify({'status': 'error', 'message': 'Сообщение не может быть пустым'})
    
    # Шифруем сообщение
    encrypted_content = encryption_manager.encrypt_message(content)
    
    message = Message(
        chat_id=chat_id,
        sender_id=current_user.id,
        content=encrypted_content,
        content_type=content_type,
        is_encrypted=True
    )
    
    db.session.add(message)
    db.session.commit()
    
    # Отправляем через WebSocket
    socketio.emit('new_message', {
        'id': message.id,
        'content': content,
        'content_type': content_type,
        'sender_id': current_user.id,
        'chat_id': chat_id,
        'created_at': message.created_at.isoformat()
    }, room=f'chat_{chat_id}')
    
    return jsonify({'status': 'success', 'message_id': message.id})

@app.route('/api/contacts', methods=['GET'])
@login_required
def get_contacts():
    """Получение списка контактов"""
    contacts = Contact.query.filter_by(user_id=current_user.id).all()
    
    contacts_data = []
    for contact in contacts:
        user = contact.contact_user
        contacts_data.append({
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'avatar': user.avatar,
            'is_online': user.is_online,
            'last_seen': user.last_seen.isoformat()
        })
    
    return jsonify({'status': 'success', 'contacts': contacts_data})

@app.route('/api/contacts/add', methods=['POST'])
@login_required
def add_contact():
    """Добавление контакта"""
    data = request.get_json()
    contact_username = data.get('username')
    
    contact_user = User.query.filter_by(username=contact_username).first()
    if not contact_user:
        return jsonify({'status': 'error', 'message': 'Пользователь не найден'})
    
    # Проверяем, не добавлен ли уже контакт
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
    db.session.flush()  # Получаем ID чата
    
    # Добавляем участников
    member1 = ChatMember(chat_id=chat.id, user_id=current_user.id, role='member')
    member2 = ChatMember(chat_id=chat.id, user_id=contact_user.id, role='member')
    db.session.add_all([member1, member2])
    
    db.session.commit()
    
    return jsonify({'status': 'success', 'contact_id': contact_user.id})

# WebSocket обработчики
@socketio.on('connect')
@login_required
def handle_connect():
    """Обработчик подключения WebSocket"""
    update_user_online_status(current_user.id, True)
    emit('user_online', {'user_id': current_user.id}, broadcast=True)

@socketio.on('disconnect')
@login_required
def handle_disconnect():
    """Обработчик отключения WebSocket"""
    update_user_online_status(current_user.id, False)
    emit('user_offline', {'user_id': current_user.id}, broadcast=True)

@socketio.on('join_chat')
@login_required
def handle_join_chat(data):
    """Присоединение к комнате чата"""
    chat_id = data['chat_id']
    join_room(f'chat_{chat_id}')
    emit('user_joined', {
        'user_id': current_user.id,
        'chat_id': chat_id
    }, room=f'chat_{chat_id}')

@socketio.on('leave_chat')
@login_required
def handle_leave_chat(data):
    """Выход из комнаты чата"""
    chat_id = data['chat_id']
    leave_room(f'chat_{chat_id}')
    emit('user_left', {
        'user_id': current_user.id,
        'chat_id': chat_id
    }, room=f'chat_{chat_id}')

@socketio.on('typing_start')
@login_required
def handle_typing_start(data):
    """Пользователь начал печатать"""
    emit('user_typing', {
        'user_id': current_user.id,
        'chat_id': data['chat_id']
    }, room=f"chat_{data['chat_id']}", include_self=False)

@socketio.on('typing_stop')
@login_required
def handle_typing_stop(data):
    """Пользователь закончил печатать"""
    emit('user_stopped_typing', {
        'user_id': current_user.id,
        'chat_id': data['chat_id']
    }, room=f"chat_{data['chat_id']}", include_self=False)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)