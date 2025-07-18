#!/usr/bin/env python3
"""
Production startup script for CesiumJS Globe Viewer
This script starts the FastAPI backend server on port 5000
"""

import uvicorn
import os
import logging

# Configure logging for production
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    # Get port from environment variable (for deployment flexibility)
    port = int(os.environ.get("PORT", 5000))
    
    logger.info(f"Starting CesiumJS Globe Viewer FastAPI server on port {port}")
    
    # Start the FastAPI application with production settings
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False,  # Disable reload for production
        workers=1,
        log_level="info",
        access_log=True
    )