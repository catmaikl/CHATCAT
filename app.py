import eventlet
eventlet.monkey_patch()

import os
import logging
from datetime import datetime
from werkzeug.utils import secure_filename
from werkzeug.exceptions import RequestEntityTooLarge
from dotenv import load_dotenv
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# ЗАГРУЖАЕМ ПЕРЕМЕННЫЕ ИЗ .env ПЕРВЫМ ДЕЛОМ
load_dotenv()

from flask import Flask, render_template, request, jsonify, session, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room, disconnect
from flask_login import LoginManager, login_required, current_user, login_user, logout_user
from models import db, User, Chat, Message, Contact, ChatMember, File
from auth import login_manager, register_user, authenticate_user, update_user_online_status
from encryption import encryption_manager
from config import Config
from flask_cors import CORS

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config.from_object(Config)

# Настройка CORS с ограниченными источниками
allowed_origins = [
    "https://chat-for-cats.onrender.com",
    "http://localhost:5000",
    "http://127.0.0.1:5000"
]

CORS(app, resources={
    r"/*": {
        "origins": allowed_origins,
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Инициализация расширений
db.init_app(app)
login_manager.init_app(app)

# Настройка rate limiting
try:
    limiter = Limiter(
        key_func=get_remote_address,
        default_limits=["200 per day", "50 per hour"],
        storage_uri=app.config.get('RATELIMIT_STORAGE_URL', 'memory://')
    )
    limiter.init_app(app)
except Exception as e:
    logger.warning(f"Rate limiting disabled due to error: {str(e)}")
    # Create a dummy limiter that doesn't actually limit
    class DummyLimiter:
        def limit(self, *args, **kwargs):
            def decorator(f):
                return f
            return decorator
    limiter = DummyLimiter()

# Настройка SocketIO с ограниченными источниками
socketio = SocketIO(app, 
                   cors_allowed_origins=allowed_origins,
                   async_mode='eventlet',
                   logger=False,
                   engineio_logger=False)

# Создание папок
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'avatars'), exist_ok=True)
os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'files'), exist_ok=True)

# Разрешенные расширения файлов
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'mp3', 'mp4', 'avi'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def validate_input(data, required_fields):
    """Валидация входных данных"""
    if not data:
        return False, "Данные не предоставлены"
    
    for field in required_fields:
        if field not in data or not data[field]:
            return False, f"Поле {field} обязательно"
    
    return True, None

@app.errorhandler(RequestEntityTooLarge)
def handle_file_too_large(e):
    return jsonify({'status': 'error', 'message': 'Файл слишком большой'}), 413

@app.errorhandler(Exception)
def handle_exception(e):
    logger.error(f"Unhandled exception: {str(e)}")
    return jsonify({'status': 'error', 'message': 'Внутренняя ошибка сервера'}), 500

@app.route('/')
def index():
    if current_user.is_authenticated:
        return render_template('index.html')
    return render_template('auth.html')

# API маршруты для аутентификации
@app.route('/api/register', methods=['POST'])
@limiter.limit("5 per minute")
def api_register():
    try:
        data = request.get_json()
        
        # Валидация входных данных
        valid, error = validate_input(data, ['username', 'email', 'password', 'first_name'])
        if not valid:
            return jsonify({'status': 'error', 'message': error}), 400
        
        # Дополнительная валидация
        if len(data['username']) < 3:
            return jsonify({'status': 'error', 'message': 'Имя пользователя должно содержать минимум 3 символа'}), 400
        
        if len(data['password']) < 6:
            return jsonify({'status': 'error', 'message': 'Пароль должен содержать минимум 6 символов'}), 400
        
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
            logger.info(f"New user registered: {result.username}")
            return jsonify({'status': 'success', 'user': {
                'id': result.id,
                'username': result.username,
                'first_name': result.first_name
            }})
        else:
            return jsonify({'status': 'error', 'message': result}), 400
            
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        db.session.rollback()
        return jsonify({'status': 'error', 'message': 'Ошибка регистрации'}), 500

@app.route('/api/login', methods=['POST'])
@limiter.limit("10 per minute")
def api_login():
    try:
        data = request.get_json()
        
        valid, error = validate_input(data, ['username', 'password'])
        if not valid:
            return jsonify({'status': 'error', 'message': error}), 400
        
        user = authenticate_user(data['username'], data['password'])
        if user:
            login_user(user)
            logger.info(f"User logged in: {user.username}")
            return jsonify({'status': 'success', 'user': {
                'id': user.id,
                'username': user.username,
                'first_name': user.first_name
            }})
        
        return jsonify({'status': 'error', 'message': 'Неверные учетные данные'}), 401
        
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Ошибка входа'}), 500

@app.route('/api/logout', methods=['POST'])
@login_required
def api_logout():
    try:
        update_user_online_status(current_user.id, False)
        logout_user()
        return jsonify({'status': 'success'})
    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Ошибка выхода'}), 500

@app.route('/api/user', methods=['GET'])
@login_required
def get_user_profile():
    """Получение профиля текущего пользователя"""
    try:
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
    except Exception as e:
        logger.error(f"Get profile error: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Ошибка получения профиля'}), 500

@app.route('/api/user/profile', methods=['PUT'])
@login_required
def update_user_profile():
    """Обновление профиля пользователя"""
    try:
        data = request.get_json()
        
        # Обновляем профиль в базе данных
        if 'first_name' in data:
            current_user.first_name = data['first_name']
        if 'last_name' in data:
            current_user.last_name = data['last_name']
        if 'bio' in data:
            current_user.bio = data['bio']
        if 'phone' in data:
            current_user.phone = data['phone']
        
        db.session.commit()
        
        logger.info(f"Profile updated for user: {current_user.username}")
        
        return jsonify({
            'status': 'success', 
            'message': 'Профиль успешно обновлен',
            'user': {
                'id': current_user.id,
                'username': current_user.username,
                'first_name': current_user.first_name,
                'last_name': current_user.last_name,
                'bio': current_user.bio,
                'phone': current_user.phone
            }
        })
    except Exception as e:
        logger.error(f"Update profile error: {str(e)}")
        db.session.rollback()
        return jsonify({'status': 'error', 'message': 'Ошибка обновления профиля'}), 500

# API маршруты для чатов
@app.route('/api/chats', methods=['GET'])
@login_required
def get_chats():
    """Получение списка чатов пользователя"""
    try:
        user_chats = Chat.query.join(ChatMember).filter(
            ChatMember.user_id == current_user.id
        ).all()
        
        chats_data = []
        for chat in user_chats:
            try:
                last_message = Message.query.filter_by(chat_id=chat.id).order_by(
                    Message.created_at.desc()
                ).first()
                
                last_message_content = ''
                if last_message:
                    try:
                        last_message_content = encryption_manager.decrypt_message(last_message.content) if last_message.is_encrypted else last_message.content
                    except Exception:
                        last_message_content = '[Зашифрованное сообщение]'
                
                chat_data = {
                    'id': chat.id,
                    'name': chat.name,
                    'is_group': chat.is_group,
                    'avatar': chat.avatar,
                    'last_message': {
                        'content': last_message_content,
                        'sender_id': last_message.sender_id if last_message else None,
                        'created_at': last_message.created_at.isoformat() if last_message else None
                    } if last_message else None,
                    'unread_count': Message.query.filter_by(
                        chat_id=chat.id, 
                        is_read=False
                    ).filter(Message.sender_id != current_user.id).count()
                }
                chats_data.append(chat_data)
            except Exception as e:
                logger.error(f"Error processing chat {chat.id}: {str(e)}")
                continue
        
        return jsonify({'status': 'success', 'chats': chats_data})
        
    except Exception as e:
        logger.error(f"Get chats error: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Ошибка получения чатов'}), 500

@app.route('/api/chats/<int:chat_id>/messages', methods=['GET'])
@login_required
def get_chat_messages(chat_id):
    """Получение сообщений чата"""
    try:
        # Проверяем, что пользователь является участником чата
        membership = ChatMember.query.filter_by(
            chat_id=chat_id, 
            user_id=current_user.id
        ).first()
        
        if not membership:
            return jsonify({'status': 'error', 'message': 'Доступ запрещен'}), 403
        
        page = request.args.get('page', 1, type=int)
        per_page = 50
        
        messages = Message.query.filter_by(chat_id=chat_id).order_by(
            Message.created_at.desc()
        ).paginate(page=page, per_page=per_page, error_out=False)
        
        messages_data = []
        for message in messages.items:
            try:
                decrypted_content = encryption_manager.decrypt_message(message.content) if message.is_encrypted else message.content
            except Exception:
                decrypted_content = '[Ошибка расшифровки]'
            
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
        
    except Exception as e:
        logger.error(f"Get messages error: {str(e)}")
        db.session.rollback()
        return jsonify({'status': 'error', 'message': 'Ошибка получения сообщений'}), 500

@app.route('/api/chats/<int:chat_id>/send', methods=['POST'])
@login_required
@limiter.limit("30 per minute")
def send_message(chat_id):
    """Отправка сообщения"""
    try:
        data = request.get_json()
        
        valid, error = validate_input(data, ['content'])
        if not valid:
            return jsonify({'status': 'error', 'message': error}), 400
        
        content = data.get('content').strip()
        content_type = data.get('content_type', 'text')
        
        if len(content) > 4000:
            return jsonify({'status': 'error', 'message': 'Сообщение слишком длинное'}), 400
        
        # Проверяем, что пользователь является участником чата
        membership = ChatMember.query.filter_by(
            chat_id=chat_id, 
            user_id=current_user.id
        ).first()
        
        if not membership:
            return jsonify({'status': 'error', 'message': 'Доступ запрещен'}), 403
        
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
            'sender_name': current_user.first_name,
            'chat_id': chat_id,
            'created_at': message.created_at.isoformat()
        }, room=f'chat_{chat_id}')
        
        logger.info(f"Message sent by {current_user.username} to chat {chat_id}")
        
        return jsonify({'status': 'success', 'message_id': message.id})
        
    except Exception as e:
        logger.error(f"Send message error: {str(e)}")
        db.session.rollback()
        return jsonify({'status': 'error', 'message': 'Ошибка отправки сообщения'}), 500

@app.route('/api/upload', methods=['POST'])
@login_required
@limiter.limit("10 per minute")
def upload_file():
    """Загрузка файла"""
    try:
        if 'file' not in request.files:
            return jsonify({'status': 'error', 'message': 'Файл не выбран'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'status': 'error', 'message': 'Файл не выбран'}), 400
        
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_')
            filename = timestamp + filename
            
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], 'files', filename)
            file.save(file_path)
            
            # Сохраняем информацию о файле в БД
            file_record = File(
                filename=filename,
                file_path=file_path,
                file_size=os.path.getsize(file_path),
                mime_type=file.content_type,
                uploaded_by=current_user.id
            )
            
            db.session.add(file_record)
            db.session.commit()
            
            logger.info(f"File uploaded by {current_user.username}: {filename}")
            
            return jsonify({
                'status': 'success',
                'file_id': file_record.id,
                'filename': filename,
                'file_path': f'/uploads/files/{filename}'
            })
        
        return jsonify({'status': 'error', 'message': 'Недопустимый тип файла'}), 400
        
    except Exception as e:
        logger.error(f"File upload error: {str(e)}")
        db.session.rollback()
        return jsonify({'status': 'error', 'message': 'Ошибка загрузки файла'}), 500

@app.route('/uploads/<path:filename>')
@login_required
def uploaded_file(filename):
    """Отдача загруженных файлов"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/contacts', methods=['GET'])
@login_required
def get_contacts():
    """Получение списка контактов"""
    try:
        contacts = Contact.query.filter_by(user_id=current_user.id).all()
        
        contacts_data = []
        for contact in contacts:
            user = User.query.get(contact.contact_id)
            if user:
                contacts_data.append({
                    'id': user.id,
                    'username': user.username,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'avatar': user.avatar,
                    'is_online': user.is_online,
                    'last_seen': user.last_seen.isoformat() if user.last_seen else None
                })
        
        return jsonify({'status': 'success', 'contacts': contacts_data})
        
    except Exception as e:
        logger.error(f"Get contacts error: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Ошибка получения контактов'}), 500

@app.route('/api/contacts/add', methods=['POST'])
@login_required
@limiter.limit("20 per hour")
def add_contact():
    """Добавление контакта"""
    try:
        data = request.get_json()
        
        valid, error = validate_input(data, ['username'])
        if not valid:
            return jsonify({'status': 'error', 'message': error}), 400
        
        contact_username = data.get('username').strip()
        
        if contact_username == current_user.username:
            return jsonify({'status': 'error', 'message': 'Нельзя добавить себя в контакты'}), 400
        
        contact_user = User.query.filter_by(username=contact_username).first()
        if not contact_user:
            return jsonify({'status': 'error', 'message': 'Пользователь не найден'}), 404
        
        # Проверяем, не добавлен ли уже контакт
        existing_contact = Contact.query.filter_by(
            user_id=current_user.id,
            contact_id=contact_user.id
        ).first()
        
        if existing_contact:
            return jsonify({'status': 'error', 'message': 'Контакт уже добавлен'}), 400
        
        contact = Contact(user_id=current_user.id, contact_id=contact_user.id)
        db.session.add(contact)
        
        # Создаем приватный чат
        chat = Chat(
            name=f"Чат с {contact_user.first_name or contact_user.username}", 
            is_group=False,
            created_by=current_user.id
        )
        db.session.add(chat)
        db.session.flush()  # Получаем ID чата
        
        # Добавляем участников
        member1 = ChatMember(chat_id=chat.id, user_id=current_user.id, role='member')
        member2 = ChatMember(chat_id=chat.id, user_id=contact_user.id, role='member')
        db.session.add_all([member1, member2])
        
        db.session.commit()
        
        logger.info(f"Contact added by {current_user.username}: {contact_user.username}")
        
        return jsonify({'status': 'success', 'contact_id': contact_user.id, 'chat_id': chat.id})
        
    except Exception as e:
        logger.error(f"Add contact error: {str(e)}")
        db.session.rollback()
        return jsonify({'status': 'error', 'message': 'Ошибка добавления контакта'}), 500

# WebSocket обработчики
@socketio.on('connect')
def handle_connect(auth):
    """Обработчик подключения WebSocket"""
    if not current_user.is_authenticated:
        logger.warning("Unauthenticated WebSocket connection attempt")
        disconnect()
        return False
    
    try:
        update_user_online_status(current_user.id, True)
        emit('user_online', {'user_id': current_user.id}, broadcast=True)
        logger.info(f"WebSocket connected: {current_user.username}")
    except Exception as e:
        logger.error(f"WebSocket connect error: {str(e)}")

@socketio.on('disconnect')
def handle_disconnect():
    """Обработчик отключения WebSocket"""
    if current_user.is_authenticated:
        try:
            update_user_online_status(current_user.id, False)
            emit('user_offline', {'user_id': current_user.id}, broadcast=True)
            logger.info(f"WebSocket disconnected: {current_user.username}")
        except Exception as e:
            logger.error(f"WebSocket disconnect error: {str(e)}")

@socketio.on('join_chat')
def handle_join_chat(data):
    """Присоединение к комнате чата"""
    if not current_user.is_authenticated:
        disconnect()
        return
    
    try:
        chat_id = data.get('chat_id')
        if not chat_id:
            return
        
        # Проверяем, что пользователь является участником чата
        membership = ChatMember.query.filter_by(
            chat_id=chat_id, 
            user_id=current_user.id
        ).first()
        
        if not membership:
            return
        
        join_room(f'chat_{chat_id}')
        emit('user_joined', {
            'user_id': current_user.id,
            'username': current_user.username,
            'chat_id': chat_id
        }, room=f'chat_{chat_id}')
        
    except Exception as e:
        logger.error(f"Join chat error: {str(e)}")

@socketio.on('leave_chat')
def handle_leave_chat(data):
    """Выход из комнаты чата"""
    if not current_user.is_authenticated:
        return
    
    try:
        chat_id = data.get('chat_id')
        if not chat_id:
            return
        
        leave_room(f'chat_{chat_id}')
        emit('user_left', {
            'user_id': current_user.id,
            'username': current_user.username,
            'chat_id': chat_id
        }, room=f'chat_{chat_id}')
        
    except Exception as e:
        logger.error(f"Leave chat error: {str(e)}")

@socketio.on('typing_start')
def handle_typing_start(data):
    """Пользователь начал печатать"""
    if not current_user.is_authenticated:
        return
    
    try:
        chat_id = data.get('chat_id')
        if not chat_id:
            return
        
        emit('user_typing', {
            'user_id': current_user.id,
            'username': current_user.first_name or current_user.username,
            'chat_id': chat_id
        }, room=f"chat_{chat_id}", include_self=False)
        
    except Exception as e:
        logger.error(f"Typing start error: {str(e)}")

@socketio.on('typing_stop')
def handle_typing_stop(data):
    """Пользователь закончил печатать"""
    if not current_user.is_authenticated:
        return
    
    try:
        chat_id = data.get('chat_id')
        if not chat_id:
            return
        
        emit('user_stopped_typing', {
            'user_id': current_user.id,
            'username': current_user.first_name or current_user.username,
            'chat_id': chat_id
        }, room=f"chat_{chat_id}", include_self=False)
        
    except Exception as e:
        logger.error(f"Typing stop error: {str(e)}")

# Health check endpoint
@app.route('/health')
def health_check():
    return jsonify({'status': 'healthy', 'message': 'Little Kitten Chat is running!'})

if __name__ == '__main__':
    with app.app_context():
        try:
            db.create_all()
            logger.info("Database tables created successfully")
        except Exception as e:
            logger.error(f"Database initialization error: {str(e)}")
    
    port = int(os.environ.get('PORT', 10000))
    debug_mode = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting Little Kitten Chat on port {port}")
    socketio.run(app, host='0.0.0.0', port=port, debug=debug_mode)