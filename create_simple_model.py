#!/usr/bin/env python3
"""
Create a simple, CesiumJS-compatible GLTF model for testing
"""

import json
import base64

def create_simple_cube_gltf():
    """Create a simple cube GLTF that should work with CesiumJS"""
    
    # Simple cube vertices (8 vertices)
    vertices = [
        # Front face
        -0.5, -0.5,  0.5,  # 0
         0.5, -0.5,  0.5,  # 1
         0.5,  0.5,  0.5,  # 2
        -0.5,  0.5,  0.5,  # 3
        # Back face
        -0.5, -0.5, -0.5,  # 4
         0.5, -0.5, -0.5,  # 5
         0.5,  0.5, -0.5,  # 6
        -0.5,  0.5, -0.5,  # 7
    ]
    
    # Indices for 6 faces (12 triangles)
    indices = [
        # Front
        0, 1, 2, 2, 3, 0,
        # Back
        5, 4, 7, 7, 6, 5,
        # Top
        3, 2, 6, 6, 7, 3,
        # Bottom
        4, 5, 1, 1, 0, 4,
        # Right
        1, 5, 6, 6, 2, 1,
        # Left
        4, 0, 3, 3, 7, 4,
    ]
    
    # Convert to bytes (proper float encoding)
    import struct
    vertex_bytes = struct.pack('<%df' % len(vertices), *vertices)
    index_bytes = struct.pack('<%dH' % len(indices), *indices)
    
    # Base64 encode
    vertex_b64 = base64.b64encode(vertex_bytes).decode('ascii')
    index_b64 = base64.b64encode(index_bytes).decode('ascii')
    
    # Create GLTF structure
    gltf = {
        "asset": {
            "version": "2.0",
            "generator": "Simple Cube Generator"
        },
        "scene": 0,
        "scenes": [
            {
                "nodes": [0]
            }
        ],
        "nodes": [
            {
                "mesh": 0
            }
        ],
        "meshes": [
            {
                "primitives": [
                    {
                        "attributes": {
                            "POSITION": 1
                        },
                        "indices": 2
                    }
                ]
            }
        ],
        "accessors": [
            {
                "bufferView": 0,
                "componentType": 5126,  # FLOAT
                "count": 8,
                "type": "VEC3",
                "max": [0.5, 0.5, 0.5],
                "min": [-0.5, -0.5, -0.5]
            },
            {
                "bufferView": 1,
                "componentType": 5126,  # FLOAT
                "count": 8,
                "type": "VEC3",
                "max": [0.5, 0.5, 0.5],
                "min": [-0.5, -0.5, -0.5]
            },
            {
                "bufferView": 2,
                "componentType": 5123,  # UNSIGNED_SHORT
                "count": 36,
                "type": "SCALAR"
            }
        ],
        "bufferViews": [
            {
                "buffer": 0,
                "byteOffset": 0,
                "byteLength": len(vertex_bytes),
                "target": 34962  # ARRAY_BUFFER
            },
            {
                "buffer": 0,
                "byteOffset": len(vertex_bytes),
                "byteLength": len(vertex_bytes),
                "target": 34962  # ARRAY_BUFFER
            },
            {
                "buffer": 0,
                "byteOffset": len(vertex_bytes) * 2,
                "byteLength": len(index_bytes),
                "target": 34963  # ELEMENT_ARRAY_BUFFER
            }
        ],
        "buffers": [
            {
                "uri": f"data:application/octet-stream;base64,{vertex_b64}{vertex_b64}{index_b64}",
                "byteLength": len(vertex_bytes) * 2 + len(index_bytes)
            }
        ]
    }
    
    return gltf

if __name__ == "__main__":
    # Create simple cube
    cube_gltf = create_simple_cube_gltf()
    
    # Save to file
    with open("simple_cube.gltf", "w") as f:
        json.dump(cube_gltf, f, indent=2)
    
    print("✅ Created simple_cube.gltf - This should work with CesiumJS!")
    print("📁 File size:", len(json.dumps(cube_gltf)), "bytes")
    print("🧪 Test this file in your upload system") 