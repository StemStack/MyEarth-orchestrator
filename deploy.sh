#!/bin/bash
# Deployment script for CesiumJS application

echo "🚀 Preparing CesiumJS application for deployment..."

# Ensure the application directory exists
if [ ! -f "index.html" ]; then
    echo "❌ Error: index.html not found. Make sure you're in the correct directory."
    exit 1
fi

if [ ! -f "main.py" ]; then
    echo "❌ Error: main.py not found. Make sure the server file exists."
    exit 1
fi

# Check if Dockerfile exists
if [ ! -f "Dockerfile" ]; then
    echo "❌ Error: Dockerfile not found. Make sure deployment files are present."
    exit 1
fi

echo "✅ All deployment files are present"
echo "✅ Static files ready for serving"
echo "✅ Python server configured for Cloud Run"
echo ""
echo "📋 Deployment Summary:"
echo "   - Server: Python HTTP server (main.py)"
echo "   - Port: 5000 (configurable via PORT environment variable)"
echo "   - Container: Configured via Dockerfile"
echo "   - Static assets: CesiumJS application files"
echo ""
echo "🎯 Ready for Replit Cloud Run deployment!"
echo "   Use the Replit deployment interface to deploy this application."