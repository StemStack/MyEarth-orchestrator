#!/usr/bin/env python3
"""
Simple HTTP server for serving static CesiumJS application
Optimized for Replit deployment with proper CORS headers and static file serving
"""

import http.server
import socketserver
import os
from urllib.parse import urlparse

class CesiumHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Custom HTTP request handler for CesiumJS application"""
    
    def end_headers(self):
        # Add CORS headers for cross-origin requests
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        
        # Add security headers
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('X-XSS-Protection', '1; mode=block')
        
        # Cache control for static assets
        if self.path.endswith(('.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico')):
            self.send_header('Cache-Control', 'public, max-age=3600')
        else:
            self.send_header('Cache-Control', 'no-cache')
            
        super().end_headers()
    
    def do_GET(self):
        """Handle GET requests"""
        # Default to index.html for root requests
        if self.path == '/':
            self.path = '/index.html'
        
        return super().do_GET()
    
    def do_OPTIONS(self):
        """Handle preflight OPTIONS requests"""
        self.send_response(200)
        self.end_headers()

def run_server(port=5000):
    """Start the HTTP server"""
    # Change to the directory containing the static files
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    handler = CesiumHTTPRequestHandler
    
    # Try multiple ports if the specified one is in use
    max_attempts = 5
    for attempt in range(max_attempts):
        try:
            with socketserver.TCPServer(("0.0.0.0", port), handler) as httpd:
                print(f"✓ CesiumJS server running on http://0.0.0.0:{port}")
                print(f"✓ Serving static files from: {os.getcwd()}")
                print(f"✓ Access the application at: http://localhost:{port}")
                
                try:
                    httpd.serve_forever()
                except KeyboardInterrupt:
                    print("\n✓ Server stopped gracefully")
                break
        except OSError as e:
            if e.errno == 98:  # Address already in use
                if attempt < max_attempts - 1:
                    port += 1
                    print(f"⚠ Port {port-1} is in use, trying port {port}")
                    continue
                else:
                    print(f"✗ Failed to find available port after {max_attempts} attempts")
                    raise
            else:
                raise

if __name__ == "__main__":
    import sys
    
    # Get port from environment variable or command line argument
    port = int(os.environ.get('PORT', 5000))
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print("Invalid port number. Using default port 5000.")
    
    run_server(port)