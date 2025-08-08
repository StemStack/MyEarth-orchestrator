#!/usr/bin/env python3
"""
Simple startup script for MyEarth FastAPI server
This script helps debug startup issues and provides better error reporting
"""

import os
import sys
import subprocess
import time
import requests

def check_dependencies():
    """Check if all required dependencies are available"""
    required_packages = [
        'fastapi', 'uvicorn', 'psycopg2', 'sqlalchemy', 
        'pyjwt', 'geopandas', 'requests'
    ]
    
    missing = []
    for package in required_packages:
        try:
            __import__(package)
            print(f"✅ {package}")
        except ImportError:
            missing.append(package)
            print(f"❌ {package} - MISSING")
    
    if missing:
        print(f"\n❌ Missing packages: {', '.join(missing)}")
        return False
    
    print("\n✅ All dependencies available")
    return True

def check_database():
    """Check database connectivity"""
    try:
        from auth import get_db
        db = next(get_db())
        db.close()
        print("✅ Database connection successful")
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

def start_server():
    """Start the FastAPI server"""
    port = int(os.getenv('PORT', 5001))
    print(f"🚀 Starting MyEarth server on port {port}")
    
    try:
        # Start the server
        process = subprocess.Popen([
            sys.executable, 'main.py'
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        # Wait for server to start
        print("⏳ Waiting for server to start...")
        time.sleep(10)
        
        # Check if process is still running
        if process.poll() is not None:
            stdout, stderr = process.communicate()
            print(f"❌ Server failed to start")
            print(f"STDOUT: {stdout.decode()}")
            print(f"STDERR: {stderr.decode()}")
            return False
        
        # Test health endpoint
        try:
            response = requests.get(f'http://localhost:{port}/api/ping', timeout=5)
            if response.status_code == 200:
                print("✅ Server is running and responding")
                return True
            else:
                print(f"❌ Server responded with status {response.status_code}")
                return False
        except requests.exceptions.RequestException as e:
            print(f"❌ Health check failed: {e}")
            return False
            
    except Exception as e:
        print(f"❌ Failed to start server: {e}")
        return False

if __name__ == "__main__":
    print("🔍 MyEarth Server Startup Diagnostics")
    print("=" * 40)
    
    # Check dependencies
    print("\n1. Checking dependencies...")
    if not check_dependencies():
        sys.exit(1)
    
    # Check database
    print("\n2. Checking database...")
    if not check_database():
        print("⚠️  Database check failed, but continuing...")
    
    # Start server
    print("\n3. Starting server...")
    if start_server():
        print("\n🎉 Server started successfully!")
        sys.exit(0)
    else:
        print("\n💥 Server startup failed!")
        sys.exit(1)
