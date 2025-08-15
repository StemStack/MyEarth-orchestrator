# OAuth Setup Guide for MyEarth.app

## Overview
To enable user authentication with Google, GitHub, and LinkedIn, you need to set up OAuth applications in each provider's developer console and configure the credentials in your `.env` file.

## Current Status
✅ **Application**: Running and accessible at https://myearth.app  
❌ **Authentication**: OAuth providers not configured (showing placeholder values)

## Setup Instructions

### 1. Google OAuth2 Setup

1. **Go to Google Cloud Console**
   - Visit: https://console.developers.google.com/
   - Sign in with your Google account

2. **Create or Select Project**
   - Create a new project or select an existing one
   - Note your Project ID

3. **Enable APIs**
   - Go to "APIs & Services" > "Library"
   - Search for and enable "Google+ API" or "Google Identity API"

4. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Web application"

5. **Configure OAuth Consent Screen**
   - App name: `MyEarth.app`
   - User support email: Your email
   - Developer contact information: Your email
   - Authorized domains: `myearth.app`

6. **Configure OAuth Client**
   - Name: `MyEarth Web Client`
   - Authorized JavaScript origins:
     ```
     https://myearth.app
     http://194.230.198.246
     ```
   - Authorized redirect URIs:
     ```
     https://myearth.app/auth/google/callback
     ```

7. **Get Credentials**
   - Copy the Client ID and Client Secret
   - Update your `.env` file:
     ```
     GOOGLE_CLIENT_ID=your_actual_client_id
     GOOGLE_CLIENT_SECRET=your_actual_client_secret
     ```

### 2. GitHub OAuth2 Setup

1. **Go to GitHub Developer Settings**
   - Visit: https://github.com/settings/developers
   - Sign in to your GitHub account

2. **Create New OAuth App**
   - Click "New OAuth App"
   - Fill in the application details:
     - Application name: `MyEarth.app`
     - Homepage URL: `https://myearth.app`
     - Application description: `3D Globe Viewer with GIS capabilities`
     - Authorization callback URL: `https://myearth.app/auth/github/callback`

3. **Register Application**
   - Click "Register application"
   - You'll be redirected to your new OAuth app

4. **Get Credentials**
   - Copy the Client ID
   - Click "Generate a new client secret" and copy it
   - Update your `.env` file:
     ```
     GITHUB_CLIENT_ID=your_actual_client_id
     GITHUB_CLIENT_SECRET=your_actual_client_secret
     ```

### 3. LinkedIn OAuth2 Setup

1. **Go to LinkedIn Developers**
   - Visit: https://www.linkedin.com/developers/
   - Sign in to your LinkedIn account

2. **Create New App**
   - Click "Create App"
   - Fill in the app details:
     - App name: `MyEarth.app`
     - LinkedIn Page: Your company page (optional)
     - App logo: Upload a logo (optional)

3. **Configure OAuth 2.0 Settings**
   - Go to "Auth" tab
   - Add OAuth 2.0 redirect URLs:
     ```
     https://myearth.app/auth/linkedin/callback
     ```
   - Requested scopes: `r_liteprofile`, `r_emailaddress`

4. **Get Credentials**
   - Copy the Client ID and Client Secret
   - Update your `.env` file:
     ```
     LINKEDIN_CLIENT_ID=your_actual_client_id
     LINKEDIN_CLIENT_SECRET=your_actual_client_secret
     ```

## Update Environment Variables

After setting up all OAuth providers, update your `.env` file on the server:

```bash
# SSH into your server
ssh jc@100.69.50.87

# Edit the .env file
nano /home/jc/MyEarth/.env

# Replace the placeholder values with your actual credentials
```

## Restart Application

After updating the credentials, restart the application:

```bash
# On the server
echo 'Project_007' | sudo -S systemctl restart myearth

# Check status
systemctl status myearth
```

## Test Authentication

1. Visit https://myearth.app
2. Click the sign-in buttons in the left sidebar
3. You should be redirected to the respective OAuth provider
4. After authorization, you should be redirected back to MyEarth.app

## Troubleshooting

### Common Issues

1. **"Invalid client_id" errors**
   - Check that your client IDs are correctly copied
   - Ensure redirect URIs match exactly

2. **"Redirect URI mismatch" errors**
   - Verify redirect URIs in OAuth provider settings
   - Check for trailing slashes or protocol mismatches

3. **"Application not found" errors**
   - Ensure OAuth apps are properly created and approved
   - Check that you're using the correct credentials

### Debug Steps

1. **Check environment variables**:
   ```bash
   ssh jc@100.69.50.87
   cd /home/jc/MyEarth
   python3 -c "import os; from dotenv import load_dotenv; load_dotenv(); print('GOOGLE_CLIENT_ID:', os.getenv('GOOGLE_CLIENT_ID'))"
   ```

2. **Check application logs**:
   ```bash
   sudo journalctl -u myearth -f
   ```

3. **Test OAuth endpoints**:
   ```bash
   curl -I https://myearth.app/auth/google
   curl -I https://myearth.app/auth/github
   curl -I https://myearth.app/auth/linkedin
   ```

## Security Notes

- Keep your client secrets secure and never commit them to version control
- Use HTTPS in production (already configured)
- Regularly rotate your client secrets
- Monitor OAuth usage in provider dashboards

## Support

If you encounter issues:
1. Check the application logs
2. Verify OAuth provider settings
3. Test with a simple OAuth flow
4. Contact the development team




