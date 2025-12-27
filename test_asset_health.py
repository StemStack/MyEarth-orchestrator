#!/usr/bin/env python3
"""
Asset Health Check Script
Tests that 3D model assets are correctly served with proper headers.

Usage:
    python test_asset_health.py [--host http://localhost:5001] [--file filename.glb]
"""

import requests
import sys
from pathlib import Path
from typing import Dict, List, Optional
import argparse


class AssetHealthChecker:
    """Health checker for 3D model assets"""
    
    def __init__(self, base_url: str = "http://localhost:5001"):
        self.base_url = base_url.rstrip('/')
        self.results: List[Dict] = []
    
    def check_asset(self, filename: str) -> Dict:
        """
        Check a single asset and verify headers.
        
        Args:
            filename: Name of the asset file in uploads/
            
        Returns:
            Dict with check results
        """
        url = f"{self.base_url}/uploads/{filename}"
        result = {
            "filename": filename,
            "url": url,
            "success": False,
            "errors": [],
            "warnings": [],
            "headers": {},
            "size": 0
        }
        
        try:
            print(f"\n🔍 Checking: {filename}")
            print(f"   URL: {url}")
            
            # Make request
            response = requests.get(url, timeout=10)
            
            # Check status code
            if response.status_code != 200:
                result["errors"].append(f"HTTP {response.status_code}: {response.reason}")
                print(f"   ❌ Status: {response.status_code}")
                return result
            
            print(f"   ✅ Status: 200 OK")
            
            # Store headers
            result["headers"] = dict(response.headers)
            
            # Check Content-Type
            content_type = response.headers.get('Content-Type', '')
            if content_type:
                print(f"   ✅ Content-Type: {content_type}")
                
                # Verify correct content type for GLB/glTF
                if filename.endswith('.glb'):
                    if 'model/gltf-binary' not in content_type and 'application/octet-stream' not in content_type:
                        result["warnings"].append(f"Unexpected Content-Type for .glb: {content_type}")
                elif filename.endswith('.gltf'):
                    if 'model/gltf+json' not in content_type and 'application/json' not in content_type:
                        result["warnings"].append(f"Unexpected Content-Type for .gltf: {content_type}")
            else:
                result["warnings"].append("Missing Content-Type header")
                print(f"   ⚠️  Content-Type: Missing")
            
            # Check Content-Length
            content_length = response.headers.get('Content-Length')
            if content_length:
                size = int(content_length)
                result["size"] = size
                print(f"   ✅ Content-Length: {size:,} bytes ({self._format_size(size)})")
                
                if size == 0:
                    result["errors"].append("File is empty (0 bytes)")
                elif size < 100:
                    result["warnings"].append(f"File is very small ({size} bytes)")
            else:
                result["warnings"].append("Missing Content-Length header")
                print(f"   ⚠️  Content-Length: Missing")
            
            # Check CORS headers
            cors_origin = response.headers.get('Access-Control-Allow-Origin')
            if cors_origin:
                print(f"   ✅ CORS: {cors_origin}")
            else:
                result["warnings"].append("Missing CORS headers (Access-Control-Allow-Origin)")
                print(f"   ⚠️  CORS: Missing")
            
            # Verify actual content size
            actual_size = len(response.content)
            result["actual_size"] = actual_size
            
            if content_length and actual_size != int(content_length):
                result["errors"].append(
                    f"Content-Length mismatch: header={content_length}, actual={actual_size}"
                )
            
            # Success if no errors
            if not result["errors"]:
                result["success"] = True
                print(f"   ✅ Health check PASSED")
            else:
                print(f"   ❌ Health check FAILED")
            
            # Show warnings
            for warning in result["warnings"]:
                print(f"   ⚠️  {warning}")
                
        except requests.exceptions.ConnectionError:
            result["errors"].append("Connection failed - is the server running?")
            print(f"   ❌ Connection failed")
        except requests.exceptions.Timeout:
            result["errors"].append("Request timeout")
            print(f"   ❌ Timeout")
        except Exception as e:
            result["errors"].append(f"Unexpected error: {str(e)}")
            print(f"   ❌ Error: {e}")
        
        self.results.append(result)
        return result
    
    def check_multiple_assets(self, filenames: List[str]) -> Dict:
        """Check multiple assets and return summary"""
        print(f"\n{'='*60}")
        print(f"Asset Health Check")
        print(f"Base URL: {self.base_url}")
        print(f"{'='*60}")
        
        for filename in filenames:
            self.check_asset(filename)
        
        return self.get_summary()
    
    def get_summary(self) -> Dict:
        """Get summary of all checks"""
        total = len(self.results)
        passed = sum(1 for r in self.results if r["success"])
        failed = total - passed
        
        summary = {
            "total": total,
            "passed": passed,
            "failed": failed,
            "results": self.results
        }
        
        print(f"\n{'='*60}")
        print(f"Summary")
        print(f"{'='*60}")
        print(f"Total checks: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        
        if failed == 0:
            print(f"\n🎉 All health checks passed!")
        else:
            print(f"\n⚠️  Some health checks failed. See details above.")
        
        return summary
    
    @staticmethod
    def _format_size(size: int) -> str:
        """Format byte size to human readable"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} TB"


def discover_assets(uploads_dir: Path = Path("uploads")) -> List[str]:
    """Discover GLB/glTF files in uploads directory"""
    if not uploads_dir.exists():
        return []
    
    assets = []
    for pattern in ['*.glb', '*.gltf']:
        assets.extend([f.name for f in uploads_dir.glob(pattern)])
    
    return sorted(assets)


def main():
    parser = argparse.ArgumentParser(description='Check health of 3D model assets')
    parser.add_argument('--host', default='http://localhost:5001', 
                       help='Base URL of the server (default: http://localhost:5001)')
    parser.add_argument('--file', help='Specific file to check')
    parser.add_argument('--discover', action='store_true',
                       help='Auto-discover assets in uploads/ directory')
    
    args = parser.parse_args()
    
    checker = AssetHealthChecker(args.host)
    
    if args.file:
        # Check specific file
        result = checker.check_asset(args.file)
        sys.exit(0 if result["success"] else 1)
    
    elif args.discover:
        # Auto-discover and check all assets
        assets = discover_assets()
        if not assets:
            print("⚠️  No assets found in uploads/ directory")
            sys.exit(1)
        
        print(f"Found {len(assets)} assets to check")
        summary = checker.check_multiple_assets(assets)
        sys.exit(0 if summary["failed"] == 0 else 1)
    
    else:
        # Default: check a few known test files
        test_files = [
            'simple_cube.gltf',
            '31_07_2025.glb',
            'gltf_1754422800_2CylinderEngine.gltf',
        ]
        
        summary = checker.check_multiple_assets(test_files)
        sys.exit(0 if summary["failed"] == 0 else 1)


if __name__ == "__main__":
    main()


