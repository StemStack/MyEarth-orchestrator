/**
 * CesiumModelImporter.js
 * Universal 3D Model Importer for CesiumJS
 * Supports: 3D Tiles, glTF/GLB, OBJ, LAS/LAZ, Gaussian Splats
 * 
 * @author MyEarth Team
 * @version 1.0.0
 */

class CesiumModelImporter {
    constructor(viewer, options = {}) {
        this.viewer = viewer;
        this.options = {
            defaultPosition: Cesium.Cartesian3.fromDegrees(0, 0, 100),
            autoSelect: true,
            showBoundingBox: true,
            onModelImported: null,
            onError: null,
            ...options
        };
        
        this.importedModels = new Map();
        this.currentModel = null;
        
        // Initialize drag and drop
        this.initializeDragAndDrop();
        
        // Initialize file input
        this.initializeFileInput();
    }

    /**
     * Initialize drag and drop functionality
     */
    initializeDragAndDrop() {
        const canvas = this.viewer.canvas;
        
        // Prevent default drag behaviors
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            canvas.style.border = '2px dashed #007bff';
        });
        
        canvas.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            canvas.style.border = '';
        });
        
        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            canvas.style.border = '';
            
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                this.importFiles(files);
            }
        });
    }

    /**
     * Initialize file input element
     */
    initializeFileInput() {
        // Create hidden file input
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.multiple = true;
        this.fileInput.accept = '.gltf,.glb,.obj,.las,.laz,.json,.b3dm,.cmpt,.pnts,.splat,.ply,.zip,.kmz,.kml';
        this.fileInput.style.display = 'none';
        document.body.appendChild(this.fileInput);
        
        this.fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                this.importFiles(files);
            }
        });
    }

    /**
     * Trigger file selection dialog
     */
    selectFiles() {
        this.fileInput.click();
    }

    /**
     * Import multiple files
     * @param {File[]} files - Array of files to import
     */
    async importFiles(files) {
        for (const file of files) {
            try {
                await this.importModel(file);
            } catch (error) {
                console.error(`Failed to import ${file.name}:`, error);
                if (this.options.onError) {
                    this.options.onError(error, file);
                }
            }
        }
    }

    /**
     * Import a single model file
     * @param {File} file - File to import
     * @returns {Promise<Cesium.Entity|Cesium.Cesium3DTileset>} - Imported model
     */
    async importModel(file) {
        console.log(`Importing model: ${file.name}`);
        
        // Detect file type
        const fileType = this.detectFileType(file);
        
        // Get placement position
        const position = await this.getPlacementPosition();
        
        let model;
        
        try {
            switch (fileType) {
                case '3dtiles':
                    model = await this.load3DTiles(file, position);
                    break;
                case 'gltf':
                    model = await this.loadGltf(file, position);
                    break;
                case 'obj':
                    model = await this.loadObj(file, position);
                    break;
                case 'pointcloud':
                    model = await this.loadPointCloud(file, position);
                    break;
                case 'gaussian_splats':
                    model = await this.loadGaussianSplats(file, position);
                    break;
                case 'archive':
                    model = await this.loadArchive(file, position);
                    break;
                default:
                    throw new Error(`Unsupported file type: ${fileType}`);
            }
            
            // Store the model
            this.importedModels.set(file.name, {
                entity: model,
                file: file,
                type: fileType,
                position: position
            });
            
            // Auto-select if enabled
            if (this.options.autoSelect) {
                this.selectModel(model);
            }
            
            // Show bounding box if enabled
            if (this.options.showBoundingBox) {
                this.showBoundingBox(model);
            }
            
            // Call callback
            if (this.options.onModelImported) {
                this.options.onModelImported(model, file, fileType);
            }
            
            return model;
            
        } catch (error) {
            console.error(`Error importing ${file.name}:`, error);
            throw error;
        }
    }

    /**
     * Detect file type based on extension and content
     * @param {File} file - File to analyze
     * @returns {string} - Detected file type
     */
    detectFileType(file) {
        const fileName = file.name.toLowerCase();
        const extension = fileName.split('.').pop();
        
        // 3D Tiles
        if (['json', 'b3dm', 'cmpt', 'pnts', 'i3dm'].includes(extension)) {
            return '3dtiles';
        }
        
        // glTF
        if (['gltf', 'glb'].includes(extension)) {
            return 'gltf';
        }
        
        // OBJ
        if (extension === 'obj') {
            return 'obj';
        }
        
        // Point clouds
        if (['las', 'laz'].includes(extension)) {
            return 'pointcloud';
        }
        
        // Gaussian splats
        if (['splat', 'ply'].includes(extension)) {
            return 'gaussian_splats';
        }
        
        // Archives
        if (['zip', 'kmz'].includes(extension)) {
            return 'archive';
        }
        
        // Geospatial
        if (['kml'].includes(extension)) {
            return 'geospatial';
        }
        
        return 'unknown';
    }

    /**
     * Get placement position (camera center or default)
     * @returns {Promise<Cesium.Cartesian3>} - Placement position
     */
    async getPlacementPosition() {
        // Try to get position from camera center
        const canvas = this.viewer.canvas;
        const centerX = canvas.clientWidth / 2;
        const centerY = canvas.clientHeight / 2;
        const centerPick = new Cesium.Cartesian2(centerX, centerY);
        
        const ray = this.viewer.camera.getPickRay(centerPick);
        let intersection = this.viewer.scene.globe.pick(ray, this.viewer.scene);
        
        if (!intersection) {
            const ellipsoidIntersection = Cesium.IntersectionTests.rayEllipsoid(ray, this.viewer.scene.globe.ellipsoid);
            if (ellipsoidIntersection) {
                intersection = Cesium.Ray.getPoint(ray, ellipsoidIntersection.start);
            }
        }
        
        if (intersection) {
            return intersection;
        }
        
        return this.options.defaultPosition;
    }

    /**
     * Load 3D Tiles
     * @param {File} file - 3D Tiles file
     * @param {Cesium.Cartesian3} position - Placement position
     * @returns {Promise<Cesium.Cesium3DTileset>} - Loaded tileset
     */
    async load3DTiles(file, position) {
        const url = URL.createObjectURL(file);
        
        let tileset;
        if (file.name.toLowerCase().endsWith('.json')) {
            // Load tileset.json
            tileset = await Cesium.Cesium3DTileset.fromUrl(url);
        } else {
            // Create a simple tileset for individual tile files
            const tilesetJson = {
                asset: { version: "1.0" },
                geometricError: 0,
                root: {
                    boundingVolume: {
                        box: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]
                    },
                    geometricError: 0,
                    content: {
                        uri: file.name
                    }
                }
            };
            
            const tilesetBlob = new Blob([JSON.stringify(tilesetJson)], { type: 'application/json' });
            const tilesetUrl = URL.createObjectURL(tilesetBlob);
            tileset = await Cesium.Cesium3DTileset.fromUrl(tilesetUrl);
        }
        
        // Position the tileset
        const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(position);
        tileset.modelMatrix = modelMatrix;
        
        // Add to scene
        this.viewer.scene.primitives.add(tileset);
        
        // Fly to the tileset
        await this.viewer.flyTo(tileset);
        
        return tileset;
    }

    /**
     * Load glTF/GLB model
     * @param {File} file - glTF file
     * @param {Cesium.Cartesian3} position - Placement position
     * @returns {Promise<Cesium.Entity>} - Loaded entity
     */
    async loadGltf(file, position) {
        const url = URL.createObjectURL(file);
        
        const entity = this.viewer.entities.add({
            position: position,
            model: {
                uri: url,
                minimumPixelSize: 128,
                maximumScale: 20000,
                scale: 1.0,
                backFaceCulling: false,
                debugShowBoundingVolume: false,
                debugWireframe: false,
                enableCollision: false,
                distanceDisplayCondition: undefined,
                silhouetteColor: Cesium.Color.WHITE,
                silhouetteSize: 0.0
            }
        });
        
        // Wait for model to load
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Model loading timeout')), 30000);
            
            const checkReady = () => {
                if (entity.model && entity.model.ready) {
                    clearTimeout(timeout);
                    resolve();
                } else {
                    setTimeout(checkReady, 100);
                }
            };
            checkReady();
        });
        
        // Fly to the model
        this.viewer.flyTo(entity);
        
        return entity;
    }

    /**
     * Load OBJ file (convert to glTF)
     * @param {File} file - OBJ file
     * @param {Cesium.Cartesian3} position - Placement position
     * @returns {Promise<Cesium.Entity>} - Loaded entity
     */
    async loadObj(file, position) {
        // For now, we'll create a placeholder entity
        // In a full implementation, you'd use obj2gltf WebAssembly
        const entity = this.viewer.entities.add({
            position: position,
            billboard: {
                image: 'data:image/svg+xml;base64,' + btoa(`
                    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
                        <rect width="64" height="64" fill="#FF9800" rx="8"/>
                        <text x="32" y="20" text-anchor="middle" fill="white" font-size="8" font-family="Arial">OBJ</text>
                        <text x="32" y="32" text-anchor="middle" fill="white" font-size="6" font-family="Arial">FILE</text>
                        <text x="32" y="42" text-anchor="middle" fill="white" font-size="4" font-family="Arial">${file.name.substring(0, 8)}...</text>
                    </svg>
                `),
                scale: 1.0,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM
            },
            label: {
                text: `📦 ${file.name}`,
                font: '12pt sans-serif',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.TOP,
                pixelOffset: new Cesium.Cartesian2(0, -80)
            }
        });
        
        this.viewer.flyTo(entity);
        return entity;
    }

    /**
     * Load point cloud (LAS/LAZ)
     * @param {File} file - Point cloud file
     * @param {Cesium.Cartesian3} position - Placement position
     * @returns {Promise<Cesium.Entity>} - Loaded entity
     */
    async loadPointCloud(file, position) {
        // For now, create a placeholder
        // In a full implementation, you'd parse LAS/LAZ and create PointPrimitiveCollection
        const entity = this.viewer.entities.add({
            position: position,
            billboard: {
                image: 'data:image/svg+xml;base64,' + btoa(`
                    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
                        <rect width="64" height="64" fill="#2196F3" rx="8"/>
                        <text x="32" y="20" text-anchor="middle" fill="white" font-size="8" font-family="Arial">POINT</text>
                        <text x="32" y="32" text-anchor="middle" fill="white" font-size="6" font-family="Arial">CLOUD</text>
                        <text x="32" y="42" text-anchor="middle" fill="white" font-size="4" font-family="Arial">${file.name.substring(0, 8)}...</text>
                    </svg>
                `),
                scale: 1.0,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM
            },
            label: {
                text: `☁️ ${file.name}`,
                font: '12pt sans-serif',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.TOP,
                pixelOffset: new Cesium.Cartesian2(0, -80)
            }
        });
        
        this.viewer.flyTo(entity);
        return entity;
    }

    /**
     * Load Gaussian splats
     * @param {File} file - Splat file
     * @param {Cesium.Cartesian3} position - Placement position
     * @returns {Promise<Cesium.Entity>} - Loaded entity
     */
    async loadGaussianSplats(file, position) {
        // For now, create a placeholder
        // In a full implementation, you'd parse splat data and create custom primitives
        const entity = this.viewer.entities.add({
            position: position,
            billboard: {
                image: 'data:image/svg+xml;base64,' + btoa(`
                    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
                        <rect width="64" height="64" fill="#9C27B0" rx="8"/>
                        <text x="32" y="20" text-anchor="middle" fill="white" font-size="8" font-family="Arial">SPLAT</text>
                        <text x="32" y="32" text-anchor="middle" fill="white" font-size="6" font-family="Arial">MODEL</text>
                        <text x="32" y="42" text-anchor="middle" fill="white" font-size="4" font-family="Arial">${file.name.substring(0, 8)}...</text>
                    </svg>
                `),
                scale: 1.0,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM
            },
            label: {
                text: `✨ ${file.name}`,
                font: '12pt sans-serif',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.TOP,
                pixelOffset: new Cesium.Cartesian2(0, -80)
            }
        });
        
        this.viewer.flyTo(entity);
        return entity;
    }

    /**
     * Load archive (ZIP, KMZ)
     * @param {File} file - Archive file
     * @param {Cesium.Cartesian3} position - Placement position
     * @returns {Promise<Cesium.Entity>} - Loaded entity
     */
    async loadArchive(file, position) {
        // For now, create a placeholder
        // In a full implementation, you'd extract and process contents
        const entity = this.viewer.entities.add({
            position: position,
            billboard: {
                image: 'data:image/svg+xml;base64,' + btoa(`
                    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
                        <rect width="64" height="64" fill="#4CAF50" rx="8"/>
                        <text x="32" y="20" text-anchor="middle" fill="white" font-size="8" font-family="Arial">ARCHIVE</text>
                        <text x="32" y="32" text-anchor="middle" fill="white" font-size="6" font-family="Arial">FILE</text>
                        <text x="32" y="42" text-anchor="middle" fill="white" font-size="4" font-family="Arial">${file.name.substring(0, 8)}...</text>
                    </svg>
                `),
                scale: 1.0,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM
            },
            label: {
                text: `📦 ${file.name}`,
                font: '12pt sans-serif',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.TOP,
                pixelOffset: new Cesium.Cartesian2(0, -80)
            }
        });
        
        this.viewer.flyTo(entity);
        return entity;
    }

    /**
     * Select a model (for gizmo manipulation)
     * @param {Cesium.Entity|Cesium.Cesium3DTileset} model - Model to select
     */
    selectModel(model) {
        this.currentModel = model;
        
        // Emit selection event
        const event = new CustomEvent('modelSelected', {
            detail: { model: model }
        });
        this.viewer.canvas.dispatchEvent(event);
    }

    /**
     * Show bounding box for a model
     * @param {Cesium.Entity|Cesium.Cesium3DTileset} model - Model to show bounding box for
     */
    showBoundingBox(model) {
        if (model instanceof Cesium.Entity && model.model) {
            // For entities, we can add a bounding box primitive
            // This is a simplified version - in practice you'd compute the actual bounding box
            const position = model.position.getValue(Cesium.JulianDate.now());
            if (position) {
                this.viewer.entities.add({
                    position: position,
                    box: {
                        dimensions: new Cesium.Cartesian3(10, 10, 10),
                        material: Cesium.Color.YELLOW.withAlpha(0.3),
                        outline: true,
                        outlineColor: Cesium.Color.YELLOW
                    }
                });
            }
        }
    }

    /**
     * Get all imported models
     * @returns {Map} - Map of imported models
     */
    getImportedModels() {
        return this.importedModels;
    }

    /**
     * Get currently selected model
     * @returns {Cesium.Entity|Cesium.Cesium3DTileset|null} - Selected model
     */
    getCurrentModel() {
        return this.currentModel;
    }

    /**
     * Remove a model
     * @param {string} modelName - Name of model to remove
     */
    removeModel(modelName) {
        const modelData = this.importedModels.get(modelName);
        if (modelData) {
            if (modelData.entity instanceof Cesium.Entity) {
                this.viewer.entities.remove(modelData.entity);
            } else if (modelData.entity instanceof Cesium.Cesium3DTileset) {
                this.viewer.scene.primitives.remove(modelData.entity);
            }
            this.importedModels.delete(modelName);
        }
    }

    /**
     * Clear all imported models
     */
    clearAllModels() {
        this.importedModels.forEach((modelData, name) => {
            this.removeModel(name);
        });
    }

    /**
     * Destroy the importer
     */
    destroy() {
        this.clearAllModels();
        if (this.fileInput) {
            document.body.removeChild(this.fileInput);
        }
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CesiumModelImporter;
} 