#!/bin/bash
# Script to update the remote MyEarth server with latest changes

echo "🔄 Updating MyEarth server with latest changes..."

# Navigate to the project directory
cd /home/jc/MyEarth || exit 1

# Pull latest changes from GitHub
echo "📥 Pulling latest changes from GitHub..."
git pull origin main

# Update version
echo "🏷️ Updating version information..."
python3 update_version.py

# Restart the systemd service
echo "🔄 Restarting MyEarth service..."
sudo systemctl restart myearth

# Check service status
echo "✅ Checking service status..."
sudo systemctl status myearth --no-pager -l

# Test the application
echo "🧪 Testing application..."
sleep 2
curl -s http://localhost:5000/version.json | python3 -m json.tool

echo "🎉 Update complete! Check https://myearth.app"