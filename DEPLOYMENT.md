# CesiumJS Application Deployment Guide

## Overview
This CesiumJS application is configured for deployment on Replit and other cloud platforms using a Python-based static file server.

## Deployment Configuration

### Files Created for Deployment
- `main.py` - Primary entry point for the application server
- `server.py` - Custom HTTP server with CORS headers and static file serving
- `DEPLOYMENT.md` - This deployment guide

### Server Features
- **Static File Serving**: Serves the CesiumJS application and all static assets
- **CORS Support**: Proper cross-origin headers for external API access
- **Security Headers**: Basic security headers for production deployment
- **Port Configuration**: Reads PORT environment variable for cloud deployment
- **Cache Control**: Optimized caching for static assets

### Deployment Process

#### For Replit Deployment
1. The application is configured to run via `python main.py`
2. Server automatically binds to `0.0.0.0:5000` 
3. Static files are served from the project root directory
4. The deployment will use the workflow configuration in `.replit`

#### For Other Cloud Platforms
The application can be deployed to any platform that supports Python:

**Heroku/Railway/Render:**
```bash
python main.py
```

**Docker:**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY . .
EXPOSE 5000
CMD ["python", "main.py"]
```

**Cloud Run/AWS Lambda:**
The server reads the `PORT` environment variable automatically.

## Application Structure

```
├── index.html          # Main CesiumJS application
├── main.py             # Application entry point
├── server.py           # HTTP server implementation
├── attached_assets/    # User-uploaded assets (models, images)
├── .replit            # Replit configuration
└── DEPLOYMENT.md      # This file
```

## Environment Variables

- `PORT` - Server port (default: 5000)

## Technical Notes

- No external dependencies required (uses Python standard library)
- CesiumJS assets loaded from official CDN
- All geospatial data from open sources (no API keys needed)
- Optimized for static file serving with proper MIME types
- Ready for production deployment with security headers

## Troubleshooting

**Port Issues:**
The server automatically detects the PORT environment variable. For local development, it defaults to port 5000.

**CORS Issues:**
The custom server includes proper CORS headers for cross-origin requests needed by CesiumJS.

**Static Assets:**
All static files are served with appropriate cache headers for optimal performance.