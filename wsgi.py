#!/usr/bin/env python3
"""
WSGI Entry Point for Little Kitten Chat
For deployment on platforms like Render, Heroku, etc.
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

from app import app, socketio, db

# Create database tables
with app.app_context():
    try:
        db.create_all()
        print("Database tables created successfully")
    except Exception as e:
        print(f"Database initialization error: {str(e)}")

# For deployment platforms
application = app

if __name__ == "__main__":
    # For local development
    port = int(os.environ.get('PORT', 10000))
    debug_mode = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    print(f"Starting Little Kitten Chat on port {port}")
    socketio.run(app, host='0.0.0.0', port=port, debug=debug_mode)