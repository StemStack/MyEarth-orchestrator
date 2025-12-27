/**
 * CesiumGizmo.js
 * Custom 3D Manipulation Gizmo for CesiumJS
 * Supports: Translate, Rotate, Scale modes with snapping
 * 
 * @author MyEarth Team
 * @version 1.0.0
 */

class CesiumGizmo {
    constructor(viewer, options = {}) {
        this.viewer = viewer;
        this.options = {
            size: 50,
            colors: {
                x: Cesium.Color.RED,
                y: Cesium.Color.GREEN,
                z: Cesium.Color.BLUE,
                hover: Cesium.Color.YELLOW,
                selected: Cesium.Color.WHITE
            },
            snapping: {
                translate: 1.0, // meters
                rotate: 15.0,   // degrees
                scale: 0.5      // scale factor
            },
            enabled: true,
            visible: false,
            ...options
        };
        
        this.mode = 'translate'; // translate, rotate, scale
        this.selectedEntity = null;
        this.isDragging = false;
        this.dragAxis = null;
        this.startPosition = null;
        this.startMatrix = null;
        
        // Gizmo elements
        this.gizmoPrimitives = new Cesium.PrimitiveCollection();
        this.viewer.scene.primitives.add(this.gizmoPrimitives);
        
        // Event handlers
        this.mouseHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        this.setupEventHandlers();
        
        // Keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        // Listen for model selection events
        this.viewer.canvas.addEventListener('modelSelected', (e) => {
            this.setSelectedEntity(e.detail.model);
        });
    }

    /**
     * Setup mouse event handlers
     */
    setupEventHandlers() {
        // Mouse down
        this.mouseHandler.setInputAction((event) => {
            if (!this.options.enabled || !this.options.visible || !this.selectedEntity) {
                return;
            }
            
            const pickedObject = this.viewer.scene.pick(event.position);
            if (pickedObject && pickedObject.primitive && pickedObject.primitive.gizmoPart) {
                this.startDrag(pickedObject.primitive.gizmoPart, event.position);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
        
        // Mouse move
        this.mouseHandler.setInputAction((event) => {
            if (this.isDragging && this.dragAxis) {
                this.updateDrag(event.position);
            } else if (this.options.visible) {
                this.updateHover(event.position);
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        
        // Mouse up
        this.mouseHandler.setInputAction((event) => {
            if (this.isDragging) {
                this.endDrag();
            }
        }, Cesium.ScreenSpaceEventType.LEFT_UP);
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            if (!this.options.enabled) return;
            
            switch (event.key.toLowerCase()) {
                case 't':
                    this.setMode('translate');
                    break;
                case 'r':
                    this.setMode('rotate');
                    break;
                case 's':
                    this.setMode('scale');
                    break;
                case 'escape':
                    this.disable();
                    break;
            }
        });
    }

    /**
     * Enable the gizmo
     */
    enable() {
        this.options.enabled = true;
        if (this.selectedEntity) {
            this.show();
        }
    }

    /**
     * Disable the gizmo
     */
    disable() {
        this.options.enabled = false;
        this.hide();
        this.selectedEntity = null;
    }

    /**
     * Set the selected entity
     * @param {Cesium.Entity|Cesium.Cesium3DTileset} entity - Entity to manipulate
     */
    setSelectedEntity(entity) {
        this.selectedEntity = entity;
        if (entity && this.options.enabled) {
            this.show();
        } else {
            this.hide();
        }
    }

    /**
     * Set the gizmo mode
     * @param {string} mode - Mode: 'translate', 'rotate', 'scale'
     */
    setMode(mode) {
        this.mode = mode;
        if (this.options.visible) {
            this.updateGizmo();
        }
    }

    /**
     * Show the gizmo
     */
    show() {
        this.options.visible = true;
        this.updateGizmo();
    }

    /**
     * Hide the gizmo
     */
    hide() {
        this.options.visible = false;
        this.gizmoPrimitives.removeAll();
    }

    /**
     * Update the gizmo based on current mode and entity
     */
    updateGizmo() {
        if (!this.selectedEntity || !this.options.visible) {
            return;
        }
        
        this.gizmoPrimitives.removeAll();
        
        const position = this.getEntityPosition();
        if (!position) return;
        
        switch (this.mode) {
            case 'translate':
                this.createTranslateGizmo(position);
                break;
            case 'rotate':
                this.createRotateGizmo(position);
                break;
            case 'scale':
                this.createScaleGizmo(position);
                break;
        }
    }

    /**
     * Get the position of the selected entity
     * @returns {Cesium.Cartesian3|null} - Entity position
     */
    getEntityPosition() {
        if (!this.selectedEntity) return null;
        
        if (this.selectedEntity instanceof Cesium.Entity) {
            // Ensure entity has a valid position
            if (!this.selectedEntity.position) {
                console.warn('Entity has no position property');
                return null;
            }
            
            const currentTime = this.viewer.clock.currentTime;
            const position = this.selectedEntity.position.getValue(currentTime);
            
            if (!position) {
                console.warn('Entity position.getValue() returned undefined at current time');
                return null;
            }
            
            return position;
        } else if (this.selectedEntity instanceof Cesium.Cesium3DTileset) {
            // For tilesets, use the model matrix translation
            const matrix = this.selectedEntity.modelMatrix;
            return Cesium.Matrix4.getTranslation(matrix, new Cesium.Cartesian3());
        }
        
        return null;
    }

    /**
     * Create translate gizmo (arrows)
     * @param {Cesium.Cartesian3} position - Gizmo position
     */
    createTranslateGizmo(position) {
        const size = this.options.size;
        
        // X axis (red arrow)
        this.createArrow(position, Cesium.Cartesian3.UNIT_X, this.options.colors.x, size, 'x');
        
        // Y axis (green arrow)
        this.createArrow(position, Cesium.Cartesian3.UNIT_Y, this.options.colors.y, size, 'y');
        
        // Z axis (blue arrow)
        this.createArrow(position, Cesium.Cartesian3.UNIT_Z, this.options.colors.z, size, 'z');
    }

    /**
     * Create rotate gizmo (rings)
     * @param {Cesium.Cartesian3} position - Gizmo position
     */
    createRotateGizmo(position) {
        const size = this.options.size;
        
        // X rotation ring (red)
        this.createRing(position, Cesium.Cartesian3.UNIT_X, this.options.colors.x, size, 'x');
        
        // Y rotation ring (green)
        this.createRing(position, Cesium.Cartesian3.UNIT_Y, this.options.colors.y, size, 'y');
        
        // Z rotation ring (blue)
        this.createRing(position, Cesium.Cartesian3.UNIT_Z, this.options.colors.z, size, 'z');
    }

    /**
     * Create scale gizmo (boxes)
     * @param {Cesium.Cartesian3} position - Gizmo position
     */
    createScaleGizmo(position) {
        const size = this.options.size;
        
        // X scale handle (red box)
        this.createBox(position, Cesium.Cartesian3.UNIT_X, this.options.colors.x, size, 'x');
        
        // Y scale handle (green box)
        this.createBox(position, Cesium.Cartesian3.UNIT_Y, this.options.colors.y, size, 'y');
        
        // Z scale handle (blue box)
        this.createBox(position, Cesium.Cartesian3.UNIT_Z, this.options.colors.z, size, 'z');
    }

    /**
     * Create an arrow primitive
     * @param {Cesium.Cartesian3} position - Arrow position
     * @param {Cesium.Cartesian3} direction - Arrow direction
     * @param {Cesium.Color} color - Arrow color
     * @param {number} size - Arrow size
     * @param {string} axis - Axis identifier
     */
    createArrow(position, direction, color, size, axis) {
        const arrowGeometry = new Cesium.CylinderGeometry({
            length: size * 0.8,
            topRadius: 0,
            bottomRadius: size * 0.1
        });
        
        const arrowInstance = new Cesium.GeometryInstance({
            geometry: arrowGeometry,
            modelMatrix: Cesium.Matrix4.fromTranslation(
                Cesium.Cartesian3.multiplyByScalar(direction, size * 0.4, new Cesium.Cartesian3())
            )
        });
        
        const primitive = this.gizmoPrimitives.add(new Cesium.Primitive({
            geometryInstances: arrowInstance,
            appearance: new Cesium.MaterialAppearance({
                material: Cesium.Material.fromType('Color', {
                    color: color
                })
            })
        }));
        
        primitive.gizmoPart = { type: 'arrow', axis: axis };
    }

    /**
     * Create a ring primitive
     * @param {Cesium.Cartesian3} position - Ring position
     * @param {Cesium.Cartesian3} normal - Ring normal
     * @param {Cesium.Color} color - Ring color
     * @param {number} size - Ring size
     * @param {string} axis - Axis identifier
     */
    createRing(position, normal, color, size, axis) {
        // Create a simple circle geometry for the ring
        const ringGeometry = new Cesium.CircleGeometry({
            center: position,
            radius: size * 0.5,
            perPositionHeight: true
        });
        
        const ringInstance = new Cesium.GeometryInstance({
            geometry: ringGeometry
        });
        
        const primitive = this.gizmoPrimitives.add(new Cesium.Primitive({
            geometryInstances: ringInstance,
            appearance: new Cesium.MaterialAppearance({
                material: Cesium.Material.fromType('Color', {
                    color: color.withAlpha(0.5)
                }),
                translucent: true
            })
        }));
        
        primitive.gizmoPart = { type: 'ring', axis: axis };
    }

    /**
     * Create a box primitive
     * @param {Cesium.Cartesian3} position - Box position
     * @param {Cesium.Cartesian3} direction - Box direction
     * @param {Cesium.Color} color - Box color
     * @param {number} size - Box size
     * @param {string} axis - Axis identifier
     */
    createBox(position, direction, color, size, axis) {
        const boxGeometry = new Cesium.BoxGeometry({
            dimensions: new Cesium.Cartesian3(size * 0.2, size * 0.2, size * 0.2)
        });
        
        const boxInstance = new Cesium.GeometryInstance({
            geometry: boxGeometry,
            modelMatrix: Cesium.Matrix4.fromTranslation(
                Cesium.Cartesian3.multiplyByScalar(direction, size * 0.6, new Cesium.Cartesian3())
            )
        });
        
        const primitive = this.gizmoPrimitives.add(new Cesium.Primitive({
            geometryInstances: boxInstance,
            appearance: new Cesium.MaterialAppearance({
                material: Cesium.Material.fromType('Color', {
                    color: color
                })
            })
        }));
        
        primitive.gizmoPart = { type: 'box', axis: axis };
    }

    /**
     * Start dragging operation
     * @param {Object} gizmoPart - Gizmo part being dragged
     * @param {Cesium.Cartesian2} position - Mouse position
     */
    startDrag(gizmoPart, position) {
        this.isDragging = true;
        this.dragAxis = gizmoPart.axis;
        this.startPosition = position;
        
        if (this.selectedEntity instanceof Cesium.Entity) {
            this.startMatrix = this.selectedEntity.modelMatrix || Cesium.Matrix4.IDENTITY.clone();
        } else if (this.selectedEntity instanceof Cesium.Cesium3DTileset) {
            this.startMatrix = this.selectedEntity.modelMatrix.clone();
        }
        
        // Disable camera controls during drag
        this.viewer.scene.screenSpaceCameraController.enableRotate = false;
        this.viewer.scene.screenSpaceCameraController.enableTranslate = false;
        this.viewer.scene.screenSpaceCameraController.enableZoom = false;
    }

    /**
     * Update drag operation
     * @param {Cesium.Cartesian2} position - Current mouse position
     */
    updateDrag(position) {
        if (!this.isDragging || !this.dragAxis || !this.startPosition) return;
        
        const delta = Cesium.Cartesian2.subtract(position, this.startPosition, new Cesium.Cartesian2());
        const deltaMagnitude = Cesium.Cartesian2.magnitude(delta);
        
        switch (this.mode) {
            case 'translate':
                this.updateTranslate(delta, deltaMagnitude);
                break;
            case 'rotate':
                this.updateRotate(delta, deltaMagnitude);
                break;
            case 'scale':
                this.updateScale(delta, deltaMagnitude);
                break;
        }
    }

    /**
     * Update translate operation
     * @param {Cesium.Cartesian2} delta - Mouse delta
     * @param {number} deltaMagnitude - Delta magnitude
     */
    updateTranslate(delta, deltaMagnitude) {
        if (!this.selectedEntity) return;
        
        const camera = this.viewer.camera;
        const direction = camera.direction;
        const up = camera.up;
        const right = camera.right;
        
        let translation = new Cesium.Cartesian3();
        
        // Calculate translation based on drag axis
        switch (this.dragAxis) {
            case 'x':
                translation = Cesium.Cartesian3.multiplyByScalar(right, delta.x * 0.01, translation);
                break;
            case 'y':
                translation = Cesium.Cartesian3.multiplyByScalar(up, -delta.y * 0.01, translation);
                break;
            case 'z':
                translation = Cesium.Cartesian3.multiplyByScalar(direction, delta.y * 0.01, translation);
                break;
        }
        
        // Apply snapping
        if (this.options.snapping.translate > 0) {
            const snapDistance = this.options.snapping.translate;
            translation.x = Math.round(translation.x / snapDistance) * snapDistance;
            translation.y = Math.round(translation.y / snapDistance) * snapDistance;
            translation.z = Math.round(translation.z / snapDistance) * snapDistance;
        }
        
        // Apply transformation
        this.applyTranslation(translation);
    }

    /**
     * Update rotate operation
     * @param {Cesium.Cartesian2} delta - Mouse delta
     * @param {number} deltaMagnitude - Delta magnitude
     */
    updateRotate(delta, deltaMagnitude) {
        if (!this.selectedEntity) return;
        
        const rotationAngle = delta.x * 0.01; // Convert mouse movement to rotation angle
        
        // Apply snapping
        let snappedAngle = rotationAngle;
        if (this.options.snapping.rotate > 0) {
            const snapAngle = Cesium.Math.toRadians(this.options.snapping.rotate);
            snappedAngle = Math.round(rotationAngle / snapAngle) * snapAngle;
        }
        
        // Apply rotation
        this.applyRotation(snappedAngle);
    }

    /**
     * Update scale operation
     * @param {Cesium.Cartesian2} delta - Mouse delta
     * @param {number} deltaMagnitude - Delta magnitude
     */
    updateScale(delta, deltaMagnitude) {
        if (!this.selectedEntity) return;
        
        const scaleFactor = 1 + delta.y * 0.01;
        
        // Apply snapping
        let snappedScale = scaleFactor;
        if (this.options.snapping.scale > 0) {
            snappedScale = Math.round(scaleFactor / this.options.snapping.scale) * this.options.snapping.scale;
        }
        
        // Apply scaling
        this.applyScale(snappedScale);
    }

    /**
     * Apply translation to selected entity
     * @param {Cesium.Cartesian3} translation - Translation vector
     */
    applyTranslation(translation) {
        if (!this.selectedEntity || !this.startMatrix) return;
        
        const newMatrix = Cesium.Matrix4.multiplyByTranslation(
            this.startMatrix,
            translation,
            new Cesium.Matrix4()
        );
        
        if (this.selectedEntity instanceof Cesium.Entity) {
            this.selectedEntity.modelMatrix = newMatrix;
        } else if (this.selectedEntity instanceof Cesium.Cesium3DTileset) {
            this.selectedEntity.modelMatrix = newMatrix;
        }
    }

    /**
     * Apply rotation to selected entity
     * @param {number} angle - Rotation angle in radians
     */
    applyRotation(angle) {
        if (!this.selectedEntity || !this.startMatrix) return;
        
        let rotationMatrix;
        switch (this.dragAxis) {
            case 'x':
                rotationMatrix = Cesium.Matrix3.fromRotationX(angle);
                break;
            case 'y':
                rotationMatrix = Cesium.Matrix3.fromRotationY(angle);
                break;
            case 'z':
                rotationMatrix = Cesium.Matrix3.fromRotationZ(angle);
                break;
            default:
                return;
        }
        
        const rotationMatrix4 = Cesium.Matrix4.fromRotationTranslation(rotationMatrix);
        const newMatrix = Cesium.Matrix4.multiply(this.startMatrix, rotationMatrix4, new Cesium.Matrix4());
        
        if (this.selectedEntity instanceof Cesium.Entity) {
            this.selectedEntity.modelMatrix = newMatrix;
        } else if (this.selectedEntity instanceof Cesium.Cesium3DTileset) {
            this.selectedEntity.modelMatrix = newMatrix;
        }
    }

    /**
     * Apply scaling to selected entity
     * @param {number} scale - Scale factor
     */
    applyScale(scale) {
        if (!this.selectedEntity) return;
        
        // Clamp scale to reasonable values
        const clampedScale = Math.max(0.1, Math.min(10.0, scale));
        
        if (this.selectedEntity instanceof Cesium.Entity) {
            // For Entity models, use entity.model.scale (scalar property)
            if (this.selectedEntity.model) {
                // Read current scale properly (it's a Property, not a number)
                const currentTime = this.viewer.clock.currentTime;
                const sProp = this.selectedEntity.model.scale;
                const currentScaleValue = (sProp && typeof sProp.getValue === "function") 
                    ? sProp.getValue(currentTime) 
                    : (typeof sProp === 'number' ? sProp : 1.0);
                
                // Store base scale if not already stored
                if (!this.selectedEntity._baseScale) {
                    this.selectedEntity._baseScale = currentScaleValue;
                }
                
                // Calculate new scale
                const newScale = this.selectedEntity._baseScale * clampedScale;
                
                // Apply uniform scaling (set as ConstantProperty for consistency)
                this.selectedEntity.model.scale = new Cesium.ConstantProperty(newScale);
                
                console.log(`🔧 Gizmo scale: ${newScale.toFixed(2)} (base: ${this.selectedEntity._baseScale.toFixed(2)}, factor: ${clampedScale.toFixed(2)})`);
            }
        } else if (this.selectedEntity instanceof Cesium.Cesium3DTileset) {
            // For tilesets, use matrix scaling
            if (!this.startMatrix) return;
            
            let scaleVector;
            switch (this.dragAxis) {
                case 'x':
                    scaleVector = new Cesium.Cartesian3(clampedScale, 1, 1);
                    break;
                case 'y':
                    scaleVector = new Cesium.Cartesian3(1, clampedScale, 1);
                    break;
                case 'z':
                    scaleVector = new Cesium.Cartesian3(1, 1, clampedScale);
                    break;
                default:
                    return;
            }
            
            const scaleMatrix = Cesium.Matrix4.fromScale(scaleVector);
            const newMatrix = Cesium.Matrix4.multiply(this.startMatrix, scaleMatrix, new Cesium.Matrix4());
            this.selectedEntity.modelMatrix = newMatrix;
        }
    }

    /**
     * End drag operation
     */
    endDrag() {
        this.isDragging = false;
        this.dragAxis = null;
        this.startPosition = null;
        this.startMatrix = null;
        
        // Re-enable camera controls
        this.viewer.scene.screenSpaceCameraController.enableRotate = true;
        this.viewer.scene.screenSpaceCameraController.enableTranslate = true;
        this.viewer.scene.screenSpaceCameraController.enableZoom = true;
    }

    /**
     * Update hover state
     * @param {Cesium.Cartesian2} position - Mouse position
     */
    updateHover(position) {
        const pickedObject = this.viewer.scene.pick(position);
        if (pickedObject && pickedObject.primitive && pickedObject.primitive.gizmoPart) {
            // Highlight hovered gizmo part
            this.highlightGizmoPart(pickedObject.primitive.gizmoPart);
        } else {
            // Remove highlights
            this.removeHighlights();
        }
    }

    /**
     * Highlight a gizmo part
     * @param {Object} gizmoPart - Gizmo part to highlight
     */
    highlightGizmoPart(gizmoPart) {
        // This would change the color of the gizmo part
        // Implementation depends on how you want to handle highlighting
    }

    /**
     * Remove all highlights
     */
    removeHighlights() {
        // Remove all highlights
    }

    /**
     * Get the current mode
     * @returns {string} - Current mode
     */
    getMode() {
        return this.mode;
    }

    /**
     * Get the selected entity
     * @returns {Cesium.Entity|Cesium.Cesium3DTileset|null} - Selected entity
     */
    getSelectedEntity() {
        return this.selectedEntity;
    }

    /**
     * Check if gizmo is enabled
     * @returns {boolean} - True if enabled
     */
    isEnabled() {
        return this.options.enabled;
    }

    /**
     * Check if gizmo is visible
     * @returns {boolean} - True if visible
     */
    isVisible() {
        return this.options.visible;
    }

    /**
     * Destroy the gizmo
     */
    destroy() {
        this.disable();
        this.mouseHandler.destroy();
        this.gizmoPrimitives.destroy();
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CesiumGizmo;
} 