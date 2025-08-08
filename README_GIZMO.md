# 🚀 MyEarth Universal 3D Model Importer with Gizmo

A comprehensive **pure JavaScript ES6 module** for CesiumJS that provides universal 3D model import capabilities and real-time 3D manipulation with a custom gizmo system.

## ✨ Features

### 🎯 Universal Model Import
- **Drag & Drop Support**: Simply drag files onto the Cesium viewer
- **30+ Format Support**: glTF, GLB, OBJ, 3D Tiles, LAS/LAZ, Gaussian Splats, and more
- **Automatic Format Detection**: Smart file type recognition
- **Real-time Processing**: Immediate model loading and placement
- **Error Handling**: Comprehensive error messages and fallbacks

### 🎮 3D Manipulation Gizmo
- **Three Modes**: Translate, Rotate, Scale
- **Keyboard Shortcuts**: T, R, S for quick mode switching
- **Snapping Support**: Grid snapping for precise positioning
- **Visual Feedback**: Hover highlights and real-time updates
- **Multi-axis Control**: X, Y, Z axis manipulation

## 📁 File Structure

```
MyEarth/
├── CesiumModelImporter.js    # Universal model importer
├── CesiumGizmo.js           # 3D manipulation gizmo
├── gizmo_demo.html          # Complete integration example
├── index.html               # Main MyEarth application
├── main.py                  # FastAPI backend
└── README_GIZMO.md         # This documentation
```

## 🚀 Quick Start

### 1. Basic Integration

```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://cesium.com/downloads/cesiumjs/releases/1.111/Build/Cesium/Cesium.js"></script>
    <link href="https://cesium.com/downloads/cesiumjs/releases/1.111/Build/Cesium/Widgets/widgets.css" rel="stylesheet">
</head>
<body>
    <div id="cesiumContainer"></div>
    
    <!-- Load our modules -->
    <script src="CesiumModelImporter.js"></script>
    <script src="CesiumGizmo.js"></script>
    
    <script>
        // Initialize Cesium Viewer
        const viewer = new Cesium.Viewer('cesiumContainer');
        
        // Initialize Model Importer
        const modelImporter = new CesiumModelImporter(viewer, {
            autoSelect: true,
            onModelImported: (model, file, fileType) => {
                console.log('Model imported:', file.name);
            }
        });
        
        // Initialize Gizmo
        const gizmo = new CesiumGizmo(viewer, {
            size: 30,
            snapping: { translate: 1.0, rotate: 15.0, scale: 0.5 }
        });
    </script>
</body>
</html>
```

### 2. Open the Demo

```bash
# Open the complete demo
open gizmo_demo.html
```

## 📋 Supported Formats

### ✅ Direct Support
- **glTF/GLB**: Native CesiumJS support
- **3D Tiles**: `.json`, `.b3dm`, `.cmpt`, `.pnts`, `.i3dm`

### 🔄 Conversion Support
- **OBJ**: Client-side conversion to glTF
- **FBX/DAE/3DS**: Traditional 3D formats
- **STL/PLY**: Point cloud and mesh formats

### ☁️ Point Clouds
- **LAS/LAZ**: LiDAR point cloud data
- **Gaussian Splats**: `.splat` format support

### 📦 Archives
- **ZIP/KMZ**: Extract and process contained models
- **KML**: Geospatial data import

### 🏗️ BIM Formats
- **IFC/RVT/DWG**: Building Information Modeling

## 🎮 Gizmo Controls

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `T` | Translate Mode |
| `R` | Rotate Mode |
| `S` | Scale Mode |
| `ESC` | Disable Gizmo |

### Mouse Controls
- **Click & Drag**: Manipulate selected axis
- **Hover**: Highlight gizmo parts
- **Multi-select**: Ctrl+Click for multiple models

### Snapping Options
- **Translate**: 1-meter grid snapping
- **Rotate**: 15°/45°/90° angle snapping
- **Scale**: 0.5x/1x/2x scale snapping

## 🔧 API Reference

### CesiumModelImporter

#### Constructor
```javascript
const importer = new CesiumModelImporter(viewer, options);
```

#### Options
```javascript
{
    defaultPosition: Cesium.Cartesian3.fromDegrees(0, 0, 100),
    autoSelect: true,
    showBoundingBox: true,
    onModelImported: (model, file, fileType) => {},
    onError: (error, file) => {}
}
```

#### Methods
```javascript
// Import files
importer.importModel(file);
importer.importFiles(files);
importer.selectFiles();

// Model management
importer.selectModel(model);
importer.getCurrentModel();
importer.getImportedModels();
importer.removeModel(modelName);
importer.clearAllModels();

// Lifecycle
importer.destroy();
```

### CesiumGizmo

#### Constructor
```javascript
const gizmo = new CesiumGizmo(viewer, options);
```

#### Options
```javascript
{
    size: 50,
    colors: {
        x: Cesium.Color.RED,
        y: Cesium.Color.GREEN,
        z: Cesium.Color.BLUE,
        hover: Cesium.Color.YELLOW,
        selected: Cesium.Color.WHITE
    },
    snapping: {
        translate: 1.0,
        rotate: 15.0,
        scale: 0.5
    },
    enabled: true,
    visible: false
}
```

#### Methods
```javascript
// Control
gizmo.enable();
gizmo.disable();
gizmo.show();
gizmo.hide();

// Entity management
gizmo.setSelectedEntity(entity);
gizmo.getSelectedEntity();

// Mode control
gizmo.setMode('translate' | 'rotate' | 'scale');
gizmo.getMode();

// State
gizmo.isEnabled();
gizmo.isVisible();

// Lifecycle
gizmo.destroy();
```

## 🎯 Advanced Features

### Custom Format Handlers

```javascript
// Extend the importer with custom format support
class CustomModelImporter extends CesiumModelImporter {
    detectFileType(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        
        if (extension === 'custom') {
            return 'custom_format';
        }
        
        return super.detectFileType(file);
    }
    
    async loadCustomFormat(file, position) {
        // Custom loading logic
        const entity = this.viewer.entities.add({
            position: position,
            // Custom entity configuration
        });
        
        return entity;
    }
}
```

### Custom Gizmo Styles

```javascript
// Customize gizmo appearance
const gizmo = new CesiumGizmo(viewer, {
    size: 75,
    colors: {
        x: Cesium.Color.CRIMSON,
        y: Cesium.Color.LIME,
        z: Cesium.Color.CYAN,
        hover: Cesium.Color.GOLD,
        selected: Cesium.Color.WHITE
    }
});
```

### Event Handling

```javascript
// Listen for model selection
viewer.canvas.addEventListener('modelSelected', (e) => {
    const model = e.detail.model;
    console.log('Model selected:', model);
});

// Custom import callbacks
const importer = new CesiumModelImporter(viewer, {
    onModelImported: (model, file, fileType) => {
        console.log(`Imported ${file.name} as ${fileType}`);
        // Auto-select for gizmo manipulation
        gizmo.setSelectedEntity(model);
    },
    onError: (error, file) => {
        console.error(`Failed to import ${file.name}:`, error);
    }
});
```

## 🔧 Integration with Existing MyEarth App

### Update index.html

```javascript
// Add to your existing index.html
<script src="CesiumModelImporter.js"></script>
<script src="CesiumGizmo.js"></script>

// Initialize after viewer creation
const modelImporter = new CesiumModelImporter(viewer, {
    autoSelect: true,
    onModelImported: (model, file, fileType) => {
        showMessage(`✅ Imported: ${file.name}`, 'success');
    }
});

const gizmo = new CesiumGizmo(viewer, {
    size: 40,
    snapping: { translate: 1.0, rotate: 15.0, scale: 0.5 }
});
```

### Replace Existing Upload System

```javascript
// Replace your existing loadModelAtCameraCenter function
async function loadModelAtCameraCenter(file) {
    try {
        const model = await modelImporter.importModel(file);
        return model;
    } catch (error) {
        showMessage(`❌ Import failed: ${error.message}`, 'error');
        throw error;
    }
}
```

## 🧪 Testing

### Test with Sample Files

1. **GLB/GLTF**: Use your Polycam GLB files
2. **OBJ**: Any standard OBJ model
3. **3D Tiles**: Cesium ion sample tilesets
4. **Point Clouds**: LAS/LAZ files from LiDAR surveys

### Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 🚀 Performance Tips

### Optimization
- Use `requestRenderMode` for large scenes
- Implement LOD (Level of Detail) for complex models
- Cache converted models to avoid re-processing
- Use Web Workers for heavy conversions

### Memory Management
- Dispose of unused models with `importer.removeModel()`
- Clean up gizmo when not in use
- Monitor memory usage with browser dev tools

## 🔮 Future Enhancements

### Planned Features
- **Undo/Redo System**: Ctrl+Z/Ctrl+Y for transformations
- **Mobile Support**: Touch gestures for mobile devices
- **Advanced Snapping**: Angle and distance constraints
- **Batch Operations**: Multi-model manipulation
- **Export Transforms**: Save/load transformation matrices

### Format Extensions
- **USD/glTF**: Universal Scene Description
- **FBX/DAE**: Enhanced conversion pipeline
- **IFC**: Building Information Modeling support
- **CityGML**: Urban modeling formats

## 🐛 Troubleshooting

### Common Issues

#### Model Not Loading
```javascript
// Check file format support
const supportedFormats = ['gltf', 'glb', 'obj', 'json', 'b3dm'];
const extension = file.name.split('.').pop().toLowerCase();
if (!supportedFormats.includes(extension)) {
    console.error('Unsupported format:', extension);
}
```

#### Gizmo Not Visible
```javascript
// Ensure gizmo is enabled and entity is selected
if (gizmo.isEnabled() && gizmo.getSelectedEntity()) {
    gizmo.show();
} else {
    console.log('Gizmo disabled or no entity selected');
}
```

#### Performance Issues
```javascript
// Enable request render mode for better performance
viewer.scene.requestRenderMode = true;
viewer.scene.maximumRenderTimeChange = Infinity;
```

## 📄 License

This project is part of the MyEarth application. The universal model importer and gizmo system are designed to work seamlessly with CesiumJS and provide a professional-grade 3D manipulation experience.

## 🤝 Contributing

To contribute to the gizmo system:

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests for new functionality
5. Submit a pull request

## 📞 Support

For issues and questions:
- Check the troubleshooting section
- Review the API documentation
- Test with the provided demo
- Open an issue with detailed information

---

**🎉 Enjoy your universal 3D model manipulation experience!** 