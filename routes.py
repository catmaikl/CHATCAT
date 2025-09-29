from flask import jsonify, request
from flask_login import login_required, current_user
from app import app
from models import User, Message, db
from datetime import datetime

@app.route('/api/user', methods=['GET'])
@login_required
def get_current_user():
    """Get current user data"""
    try:
        return jsonify({
            'id': current_user.id,
            'username': current_user.username,
            'email': current_user.email,
            'first_name': current_user.first_name,
            'last_name': current_user.last_name,
            'phone': current_user.phone,
            'is_online': current_user.is_online,
            'last_seen': current_user.last_seen.isoformat() if current_user.last_seen else None
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/users', methods=['GET'])
@login_required
def get_users():
    """Get list of all users"""
    try:
        users = User.query.filter(User.id != current_user.id).all()
        return jsonify([{
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'is_online': user.is_online,
            'last_seen': user.last_seen.isoformat() if user.last_seen else None
        } for user in users])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/messages/<int:user_id>', methods=['GET'])
@login_required
def get_messages(user_id):
    """Get messages between current user and another user"""
    try:
        messages = Message.query.filter(
            ((Message.sender_id == current_user.id) & (Message.receiver_id == user_id)) |
            ((Message.sender_id == user_id) & (Message.receiver_id == current_user.id))
        ).order_by(Message.timestamp.asc()).all()
        
        return jsonify([{
            'id': msg.id,
            'sender_id': msg.sender_id,
            'receiver_id': msg.receiver_id,
            'content': msg.content,
            'timestamp': msg.timestamp.isoformat(),
            'is_file': msg.is_file,
            'file_path': msg.file_path
        } for msg in messages])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/messages', methods=['POST'])
@login_required
def send_message():
    """Send a new message"""
    try:
        data = request.get_json()
        receiver_id = data.get('receiver_id')
        content = data.get('content')
        
        if not receiver_id or not content:
            return jsonify({'error': 'Receiver ID and content are required'}), 400
        
        message = Message(
            sender_id=current_user.id,
            receiver_id=receiver_id,
            content=content,
            timestamp=datetime.utcnow(),
            is_file=False
        )
        
        db.session.add(message)
        db.session.commit()
        
        return jsonify({
            'id': message.id,
            'sender_id': message.sender_id,
            'receiver_id': message.receiver_id,
            'content': message.content,
            'timestamp': message.timestamp.isoformat(),
            'is_file': message.is_file
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500