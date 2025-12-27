# MyEarth – Setup & Run Guide

## Local Development Setup

### Prerequisites
- Python 3.9 or higher
- PostgreSQL database (optional, app will start without it)
- Virtual environment located at `../_venv_MyEarth` (outside the repository)

### Setup Steps

1. **Clone the Repository**
```bash
git clone https://github.com/StemStack/MyEarth.git
cd MyEarth
```

2. **Create or Recreate Virtual Environment** (if needed)
```bash
python3 -m venv ../_venv_MyEarth
```

3. **Activate Virtual Environment**
```bash
source ../_venv_MyEarth/bin/activate
```

4. **Install Dependencies**
```bash
python3 -m pip install -r requirements.txt
```

5. **Start the Application**
```bash
python3 -m uvicorn main:app --reload --port 5001
```

The application will be available at `http://localhost:5001`

**Note:** Using `python3 -m pip` and `python3 -m uvicorn` ensures these commands work even if `pip` or `uvicorn` are not on your PATH.

### Optional: Database Setup

If you want to use the database features, configure your PostgreSQL connection in a `.env` file:

```bash
DB_NAME=myearth
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
```

Then initialize the database:
```bash
python init_db.py
```

## 3D Asset Pipeline (GLB)

MyEarth supports uploading and visualizing 3D models in various formats, with first-class support for glTF/GLB files.

### Supported Formats
- **glTF/GLB** (`.gltf`, `.glb`) - Recommended, direct CesiumJS support
- **3D Tiles** (`.json`, `.b3dm`, `.cmpt`, `.pnts`)
- **Traditional formats** (`.obj`, `.fbx`, `.dae`, `.stl`) - Auto-converted to GLB
- **Point clouds** (`.las`, `.laz`)

### Quick Start

**1. Test with Known-Good Model**

Open the test page to verify the viewer works:
```
http://localhost:5001/frontend/model-test.html
```

This page loads a public GLB model and provides upload testing.

**2. Upload a Model**

Via API:
```bash
curl -X POST http://localhost:5001/api/upload-model \
  -F "file=@your_model.glb"
```

Response:
```json
{
  "success": true,
  "filename": "gltf_1234567890_your_model.glb",
  "url": "/uploads/gltf_1234567890_your_model.glb",
  "size": 524288,
  "processing_type": "gltf",
  "message": "glTF file ready for CesiumJS"
}
```

**3. Verify Asset Health**

Check that assets are served correctly:
```bash
# Check specific file
python test_asset_health.py --file gltf_1234567890_your_model.glb

# Auto-discover and check all assets
python test_asset_health.py --discover

# Check default test files
python test_asset_health.py
```

The health check verifies:
- HTTP 200 status
- Correct Content-Type header (`model/gltf-binary` for GLB)
- Content-Length header present and matches actual size
- CORS headers for cross-origin access
- File is non-zero size

### Asset Serving

Assets are served from `/uploads/{filename}` with:
- **Content-Type**: Automatically set based on file extension
- **Content-Length**: File size in bytes
- **CORS headers**: `Access-Control-Allow-Origin: *`
- **Caching**: 1 year cache for immutable assets
- **No authentication required** (public access)

### Logging

Upload and serving operations are logged:
```
INFO: Upload request: model.glb | Extension: .glb | Size: 524288 bytes
INFO: Saving to: uploads/original_1234567890_model.glb
INFO: GLB/glTF ready: gltf_1234567890_model.glb | Size: 524288 bytes | URL: /uploads/gltf_1234567890_model.glb
INFO: Upload successful: gltf_1234567890_model.glb | Final URL: /uploads/gltf_1234567890_model.glb | Type: gltf
INFO: Serving asset: gltf_1234567890_model.glb | Size: 524288 bytes | Type: model/gltf-binary
```

### Troubleshooting

**Model doesn't load in viewer:**
1. Check browser console for errors
2. Verify asset is accessible: `curl -I http://localhost:5001/uploads/filename.glb`
3. Run health check: `python test_asset_health.py --file filename.glb`
4. Check server logs for upload/serving errors

**Upload fails:**
- Max file size: 500MB
- Ensure file extension is supported
- Check server logs for validation errors

**CORS errors:**
- Assets should include `Access-Control-Allow-Origin: *` header
- Run health check to verify headers

### Integration with Frontend

Load models in CesiumJS:
```javascript
// Using CesiumModelImporter
const importer = new CesiumModelImporter(viewer);
const model = await importer.loadGltf(file, position);

// Or directly with Cesium API
const entity = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(0, 0, 100),
    model: {
        uri: '/uploads/your_model.glb',
        minimumPixelSize: 128,
        scale: 1.0
    }
});
```

### Future Enhancements
- [ ] Private workspace permissions (requires authentication)
- [ ] Database schema for asset metadata
- [ ] Asset versioning and history
- [ ] Thumbnail generation
- [ ] Asset optimization pipeline
