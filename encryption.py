from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import os

class EncryptionManager:
    def __init__(self, key):
        self.key = base64.urlsafe_b64encode(
            PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=b'messenger_salt',
                iterations=100000,
            ).derive(key.encode())
        )
        self.fernet = Fernet(self.key)
    
    def encrypt_message(self, message):
        """Шифрование сообщения"""
        return self.fernet.encrypt(message.encode()).decode()
    
    def decrypt_message(self, encrypted_message):
        """Дешифрование сообщения"""
        return self.fernet.decrypt(encrypted_message.encode()).decode()
    
    def encrypt_file(self, file_path):
        """Шифрование файла"""
        with open(file_path, 'rb') as file:
            file_data = file.read()
        encrypted_data = self.fernet.encrypt(file_data)
        
        encrypted_path = file_path + '.enc'
        with open(encrypted_path, 'wb') as file:
            file.write(encrypted_data)
        
        return encrypted_path
    
    def decrypt_file(self, encrypted_path, output_path):
        """Дешифрование файла"""
        with open(encrypted_path, 'rb') as file:
            encrypted_data = file.read()
        decrypted_data = self.fernet.decrypt(encrypted_data)
        
        with open(output_path, 'wb') as file:
            file.write(decrypted_data)
        
        return output_path

# Создание менеджера шифрования
encryption_key = os.environ.get('ENCRYPTION_KEY') or 'default-encryption-key-change-in-production'
encryption_manager = EncryptionManager(encryption_key)