#!/bin/bash

# Update .env file with OAuth configuration
echo "Updating .env file with OAuth configuration..."

cat > /home/jc/MyEarth/.env << 'EOF'
# Database Configuration
DB_NAME=myearth
DB_USER=myearth_user
DB_PASSWORD=Project_007
DB_HOST=localhost
DB_PORT=5432

# JWT Configuration
JWT_SECRET_KEY=your-super-secret-jwt-key-change-this-in-production

# OAuth2 Provider Configuration
# ========================================
# You need to set up OAuth applications in each provider's developer console
# and replace these placeholder values with your actual client IDs and secrets

# Google OAuth2
# 1. Go to https://console.developers.google.com/
# 2. Create a new project or select existing
# 3. Enable Google+ API
# 4. Create OAuth 2.0 credentials
# 5. Add authorized redirect URI: https://myearth.app/auth/google/callback
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# GitHub OAuth2
# 1. Go to https://github.com/settings/developers
# 2. Click "New OAuth App"
# 3. Set Homepage URL: https://myearth.app
# 4. Set Authorization callback URL: https://myearth.app/auth/github/callback
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here

# LinkedIn OAuth2
# 1. Go to https://www.linkedin.com/developers/
# 2. Create a new app
# 3. Add OAuth 2.0 redirect URLs: https://myearth.app/auth/linkedin/callback
LINKEDIN_CLIENT_ID=your_linkedin_client_id_here
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret_here

# Application Configuration
PORT=5001
DEBUG=False
ENVIRONMENT=production

# CORS Configuration
CORS_ORIGINS=https://myearth.app,http://194.230.198.246

# File Upload Configuration
MAX_FILE_SIZE=524288000
UPLOAD_DIR=uploads
ALLOWED_EXTENSIONS=.geojson,.shp,.gpkg,.kml,.kmz,.zip
EOF

echo "✅ .env file updated successfully!"
echo ""
echo "📋 NEXT STEPS:"
echo "1. Set up OAuth applications in each provider's developer console"
echo "2. Replace the placeholder values with your actual client IDs and secrets"
echo "3. Restart the application"
echo ""
echo "🔗 OAuth Setup Links:"
echo "- Google: https://console.developers.google.com/"
echo "- GitHub: https://github.com/settings/developers"
echo "- LinkedIn: https://www.linkedin.com/developers/"



