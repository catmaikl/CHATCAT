import os
from datetime import timedelta
import secrets

basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    # Генерируем безопасный секретный ключ если не задан в переменных окружения
    SECRET_KEY = os.environ.get('SECRET_KEY') or secrets.token_hex(32)
    
    # База данных
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, 'instance', 'messenger.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
    }
    
    # Настройки загрузки файлов
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    UPLOAD_FOLDER = os.path.join(basedir, 'static', 'uploads')
    
    # Настройки сессии
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)
    SESSION_COOKIE_SECURE = os.environ.get('HTTPS', 'False').lower() == 'true'
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'

    # Режим отладки
    DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    # Настройки шифрования
    ENCRYPTION_KEY = os.environ.get('ENCRYPTION_KEY') or secrets.token_hex(32)
    
    # Настройки rate limiting
    RATELIMIT_STORAGE_URL = os.environ.get('REDIS_URL', 'memory://')
    
    # Настройки безопасности
    WTF_CSRF_ENABLED = True
    WTF_CSRF_TIME_LIMIT = None
    
    # Настройки логирования
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')