#!/usr/bin/env python3
"""
Database initialization script for MyEarth.app
Creates tables and populates initial data
"""

import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, LayerCategory, License
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def init_database():
    """Initialize the database with tables and initial data"""
    
    # Database configuration
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost/myearth")
    
    print("🔧 Initializing MyEarth.app database...")
    print(f"📊 Database URL: {DATABASE_URL}")
    
    try:
        # Create engine and session
        engine = create_engine(DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        # Create all tables
        print("📋 Creating database tables...")
        Base.metadata.create_all(bind=engine)
        print("✅ Tables created successfully")
        
        # Create session for data insertion
        db = SessionLocal()
        
        # Initialize categories
        print("🏷️ Initializing layer categories...")
        init_categories(db)
        
        # Initialize licenses
        print("📜 Initializing licenses...")
        init_licenses(db)
        
        # Commit changes
        db.commit()
        print("✅ Database initialization completed successfully!")
        
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        sys.exit(1)
    finally:
        if 'db' in locals():
            db.close()

def init_categories(db):
    """Initialize layer categories"""
    categories = [
        {
            "name": "biodiversity",
            "description": "Biodiversity and wildlife data",
            "icon": "🌿",
            "color": "#27ae60"
        },
        {
            "name": "climate",
            "description": "Climate and weather data",
            "icon": "🌤️",
            "color": "#3498db"
        },
        {
            "name": "agriculture",
            "description": "Agricultural and farming data",
            "icon": "🌾",
            "color": "#f39c12"
        },
        {
            "name": "forestry",
            "description": "Forest and woodland data",
            "icon": "🌲",
            "color": "#8e44ad"
        },
        {
            "name": "water",
            "description": "Water resources and hydrology",
            "icon": "💧",
            "color": "#2980b9"
        },
        {
            "name": "urban",
            "description": "Urban and city planning data",
            "icon": "🏙️",
            "color": "#34495e"
        },
        {
            "name": "transportation",
            "description": "Transportation and infrastructure",
            "icon": "🚗",
            "color": "#e67e22"
        },
        {
            "name": "energy",
            "description": "Energy and renewable resources",
            "icon": "⚡",
            "color": "#f1c40f"
        },
        {
            "name": "geology",
            "description": "Geological and soil data",
            "icon": "🏔️",
            "color": "#95a5a6"
        },
        {
            "name": "ocean",
            "description": "Ocean and marine data",
            "icon": "🌊",
            "color": "#1abc9c"
        },
        {
            "name": "demographics",
            "description": "Population and demographic data",
            "icon": "👥",
            "color": "#e74c3c"
        },
        {
            "name": "general",
            "description": "General purpose data",
            "icon": "📊",
            "color": "#7f8c8d"
        }
    ]
    
    for cat_data in categories:
        # Check if category already exists
        existing = db.query(LayerCategory).filter(LayerCategory.name == cat_data["name"]).first()
        if not existing:
            category = LayerCategory(**cat_data)
            db.add(category)
            print(f"  ✅ Added category: {cat_data['name']}")
        else:
            print(f"  ⏭️ Category already exists: {cat_data['name']}")

def init_licenses(db):
    """Initialize licenses"""
    licenses = [
        {
            "name": "CC BY 4.0",
            "description": "Creative Commons Attribution 4.0 International",
            "url": "https://creativecommons.org/licenses/by/4.0/",
            "is_open": True
        },
        {
            "name": "CC BY-SA 4.0",
            "description": "Creative Commons Attribution-ShareAlike 4.0 International",
            "url": "https://creativecommons.org/licenses/by-sa/4.0/",
            "is_open": True
        },
        {
            "name": "CC BY-NC 4.0",
            "description": "Creative Commons Attribution-NonCommercial 4.0 International",
            "url": "https://creativecommons.org/licenses/by-nc/4.0/",
            "is_open": True
        },
        {
            "name": "CC0 1.0",
            "description": "Creative Commons Zero 1.0 Universal",
            "url": "https://creativecommons.org/publicdomain/zero/1.0/",
            "is_open": True
        },
        {
            "name": "Open Data Commons Open Database License (ODbL)",
            "description": "Open Database License for open data",
            "url": "https://opendatacommons.org/licenses/odbl/",
            "is_open": True
        },
        {
            "name": "Open Data Commons Attribution License (ODC-By)",
            "description": "Attribution License for open data",
            "url": "https://opendatacommons.org/licenses/by/",
            "is_open": True
        },
        {
            "name": "GNU General Public License v3.0",
            "description": "GNU General Public License version 3",
            "url": "https://www.gnu.org/licenses/gpl-3.0.html",
            "is_open": True
        },
        {
            "name": "MIT License",
            "description": "MIT License for software and data",
            "url": "https://opensource.org/licenses/MIT",
            "is_open": True
        },
        {
            "name": "Apache License 2.0",
            "description": "Apache License version 2.0",
            "url": "https://www.apache.org/licenses/LICENSE-2.0",
            "is_open": True
        },
        {
            "name": "Proprietary",
            "description": "Proprietary license - restricted use",
            "url": "",
            "is_open": False
        },
        {
            "name": "All Rights Reserved",
            "description": "All rights reserved - no public use",
            "url": "",
            "is_open": False
        }
    ]
    
    for lic_data in licenses:
        # Check if license already exists
        existing = db.query(License).filter(License.name == lic_data["name"]).first()
        if not existing:
            license_obj = License(**lic_data)
            db.add(license_obj)
            print(f"  ✅ Added license: {lic_data['name']}")
        else:
            print(f"  ⏭️ License already exists: {lic_data['name']}")

def create_admin_user():
    """Create an admin user (optional)"""
    print("\n👤 Would you like to create an admin user? (y/n): ", end="")
    response = input().lower().strip()
    
    if response in ['y', 'yes']:
        from models import User
        from auth import get_db
        
        print("Enter admin user details:")
        email = input("Email: ").strip()
        username = input("Username: ").strip()
        full_name = input("Full Name: ").strip()
        
        if email and username:
            try:
                db = next(get_db())
                user = User(
                    email=email,
                    username=username,
                    full_name=full_name,
                    is_admin=True,
                    is_active=True
                )
                db.add(user)
                db.commit()
                print(f"✅ Admin user created: {email}")
            except Exception as e:
                print(f"❌ Failed to create admin user: {e}")
            finally:
                db.close()

if __name__ == "__main__":
    print("🚀 MyEarth.app Database Initialization")
    print("=" * 50)
    
    init_database()
    
    # Optionally create admin user
    create_admin_user()
    
    print("\n🎉 Setup complete! You can now start the application.")
    print("💡 Don't forget to:")
    print("   - Set up your OAuth2 credentials in .env file")
    print("   - Configure your database connection")
    print("   - Run: python main.py")
