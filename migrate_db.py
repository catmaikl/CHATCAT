#!/usr/bin/env python3
"""
Database Migration Script for Little Kitten Chat
Fixes relationship conflicts and recreates tables
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from app import app, db
from models import User, Chat, Message, Contact, ChatMember, File

def migrate_database():
    """Migrate database to fix relationship conflicts"""
    with app.app_context():
        try:
            print("Starting database migration...")
            
            # Drop all tables to avoid conflicts
            print("Dropping existing tables...")
            db.drop_all()
            
            # Create all tables with new schema
            print("Creating new tables...")
            db.create_all()
            
            print("Database migration completed successfully!")
            print("All tables have been recreated with fixed relationships.")
            
        except Exception as e:
            print(f"Migration error: {str(e)}")
            return False
    
    return True

if __name__ == "__main__":
    if migrate_database():
        print("\n✅ Migration successful!")
        print("You can now start the application normally.")
    else:
        print("\n❌ Migration failed!")
        sys.exit(1)