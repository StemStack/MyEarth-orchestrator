#!/usr/bin/env python3
"""
Test script for the universal 3D model upload system
"""

import requests
import json
import os
from pathlib import Path

def test_upload_endpoint():
    """Test the universal upload endpoint with different file types"""
    
    base_url = "http://localhost:5001"
    
    # Test 1: Check if server is running
    try:
        response = requests.get(f"{base_url}/api/ping")
        print(f"✅ Server ping: {response.json()}")
    except Exception as e:
        print(f"❌ Server not running: {e}")
        return
    
    # Test 2: Test with a simple text file (should be rejected)
    print("\n🧪 Test 2: Invalid file type")
    try:
        with open("test.txt", "w") as f:
            f.write("This is not a 3D model")
        
        with open("test.txt", "rb") as f:
            files = {"file": ("test.txt", f, "text/plain")}
            response = requests.post(f"{base_url}/api/upload-model", files=files)
        
        print(f"Response: {response.status_code}")
        if response.status_code == 400:
            print("✅ Correctly rejected invalid file type")
        else:
            print(f"❌ Unexpected response: {response.text}")
            
        os.remove("test.txt")
    except Exception as e:
        print(f"❌ Test failed: {e}")
    
    # Test 3: Test with a fake GLB file
    print("\n🧪 Test 3: Fake GLB file")
    try:
        # Create a fake GLB file (just some bytes)
        fake_glb_data = b'glTF' + b'\x00' * 100  # Fake GLB header
        
        files = {"file": ("fake_model.glb", fake_glb_data, "model/gltf-binary")}
        response = requests.post(f"{base_url}/api/upload-model", files=files)
        
        print(f"Response: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Upload successful: {result['message']}")
            print(f"   Processing type: {result['processing_type']}")
            print(f"   File size: {result['size']} bytes")
        else:
            print(f"❌ Upload failed: {response.text}")
    except Exception as e:
        print(f"❌ Test failed: {e}")
    
    # Test 4: Test with a fake OBJ file
    print("\n🧪 Test 4: Fake OBJ file")
    try:
        fake_obj_data = b"""# Fake OBJ file
v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 0.0 1.0 0.0
f 1 2 3
"""
        
        files = {"file": ("fake_model.obj", fake_obj_data, "model/obj")}
        response = requests.post(f"{base_url}/api/upload-model", files=files)
        
        print(f"Response: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Upload successful: {result['message']}")
            print(f"   Processing type: {result['processing_type']}")
            print(f"   File size: {result['size']} bytes")
        else:
            print(f"❌ Upload failed: {response.text}")
    except Exception as e:
        print(f"❌ Test failed: {e}")
    
    # Test 5: Test with a fake ZIP file
    print("\n🧪 Test 5: Fake ZIP file")
    try:
        import zipfile
        import io
        
        # Create a fake ZIP with a GLB inside
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w') as zip_file:
            zip_file.writestr('model.glb', b'glTF' + b'\x00' * 50)
        
        zip_data = zip_buffer.getvalue()
        
        files = {"file": ("fake_archive.zip", zip_data, "application/zip")}
        response = requests.post(f"{base_url}/api/upload-model", files=files)
        
        print(f"Response: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Upload successful: {result['message']}")
            print(f"   Processing type: {result['processing_type']}")
            print(f"   File size: {result['size']} bytes")
        else:
            print(f"❌ Upload failed: {response.text}")
    except Exception as e:
        print(f"❌ Test failed: {e}")

if __name__ == "__main__":
    print("🚀 Testing Universal 3D Model Upload System")
    print("=" * 50)
    test_upload_endpoint()
    print("\n✅ Test completed!") 