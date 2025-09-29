#!/usr/bin/env python3
"""
Little Kitten Chat - Startup Script
Запуск мессенджера с автоматической настройкой
"""

import os
import sys
import subprocess
import logging
from pathlib import Path

# Настройка логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def check_python_version():
    """Проверка версии Python"""
    if sys.version_info < (3, 8):
        logger.error("Требуется Python 3.8 или выше")
        return False
    logger.info(f"Python версия: {sys.version}")
    return True

def install_requirements():
    """Установка зависимостей"""
    requirements_file = Path(__file__).parent / "requirements.txt"
    
    if not requirements_file.exists():
        logger.error("Файл requirements.txt не найден")
        return False
    
    try:
        logger.info("Установка зависимостей...")
        subprocess.check_call([
            sys.executable, "-m", "pip", "install", "-r", str(requirements_file)
        ])
        logger.info("Зависимости установлены успешно")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Ошибка установки зависимостей: {e}")
        return False

def setup_environment():
    """Настройка окружения"""
    env_file = Path(__file__).parent / ".env"
    
    if not env_file.exists():
        logger.info("Создание файла .env...")
        env_content = """SECRET_KEY=your-secret-key-here
ENCRYPTION_KEY=your-encryption-key-here
DATABASE_URL=sqlite:///instance/messenger.db
DEBUG=True
LOG_LEVEL=INFO
HTTPS=False
"""
        with open(env_file, 'w', encoding='utf-8') as f:
            f.write(env_content)
        logger.info("Файл .env создан")
    
    # Создание необходимых директорий
    directories = [
        "instance",
        "static/uploads",
        "static/uploads/avatars",
        "static/uploads/files",
        "static/images"
    ]
    
    for directory in directories:
        dir_path = Path(__file__).parent / directory
        dir_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"Дир��ктория создана: {directory}")

def create_default_images():
    """Создание заглушек для изображений"""
    images_dir = Path(__file__).parent / "static" / "images"
    
    # Создаем простые SVG заглушки
    default_avatar_svg = '''<svg width="50" height="50" xmlns="http://www.w3.org/2000/svg">
        <circle cx="25" cy="25" r="25" fill="#e0e0e0"/>
        <circle cx="25" cy="20" r="8" fill="#bdbdbd"/>
        <path d="M10 40 Q25 30 40 40" fill="#bdbdbd"/>
    </svg>'''
    
    default_chat_svg = '''<svg width="50" height="50" xmlns="http://www.w3.org/2000/svg">
        <rect width="50" height="50" rx="25" fill="#4CAF50"/>
        <text x="25" y="32" text-anchor="middle" fill="white" font-size="20">💬</text>
    </svg>'''
    
    # Сохраняем SVG файлы
    with open(images_dir / "default-avatar.svg", 'w', encoding='utf-8') as f:
        f.write(default_avatar_svg)
    
    with open(images_dir / "default-chat.svg", 'w', encoding='utf-8') as f:
        f.write(default_chat_svg)
    
    logger.info("Изображения по умолчанию созданы")

def run_application():
    """Запуск приложения"""
    try:
        logger.info("Запуск Little Kitten Chat...")
        logger.info("Приложение будет доступно по адресу: http://localhost:10000")
        logger.info("Для остановки нажмите Ctrl+C")
        
        # Импортируем и запускаем приложение
        from app import app, socketio, db
        
        # Создаем таблицы базы данных
        with app.app_context():
            db.create_all()
            logger.info("База данных инициализирована")
        
        # Запускаем сервер
        port = int(os.environ.get('PORT', 10000))
        debug_mode = os.environ.get('DEBUG', 'True').lower() == 'true'
        
        socketio.run(
            app, 
            host='0.0.0.0', 
            port=port, 
            debug=debug_mode,
            use_reloader=False  # Отключаем reloader для избежания двойного запуска
        )
        
    except KeyboardInterrupt:
        logger.info("Приложение остановлено пользователем")
    except Exception as e:
        logger.error(f"Ошибка запуска приложения: {e}")
        return False
    
    return True

def main():
    """Главная функция"""
    logger.info("=== Little Kitten Chat - Запуск ===")
    
    # Проверка версии Python
    if not check_python_version():
        return 1
    
    # Установка зависимостей
    if not install_requirements():
        logger.error("Не удалось установить зависимости")
        return 1
    
    # Настройка окружения
    setup_environment()
    
    # Создание изображений по умолчанию
    create_default_images()
    
    # Запуск приложения
    if not run_application():
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())