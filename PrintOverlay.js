/**
 * PrintOverlay.js
 * Map.geo.admin.ch-style print overlay system for CesiumJS
 * 
 * Features:
 * - Full-screen overlay frame matching paper size/orientation
 * - Interactive map with pan/zoom while in print mode
 * - Live scale and paper size labels on frame edges
 * - Compact floating settings panel
 * - High-quality PDF export at 300 DPI
 * 
 * @author MyEarth Team
 * @version 2.0.0
 */

class PrintOverlay {
    constructor(viewer, options = {}) {
        this.viewer = viewer;
        this.options = {
            dpi: 300,
            defaultPaperSize: 'A4',
            defaultOrientation: 'portrait',
            defaultScale: '1:1\'500\'000',
            includeLegend: true,
            includeGrid: false,
            includeTitle: true,
            includeCopyright: true,
            ...options
        };
        
        this.isActive = false;
        this.isUpdatingCamera = false; // Flag to prevent infinite recursion
        this.currentSettings = {
            paperSize: this.options.defaultPaperSize,
            orientation: this.options.defaultOrientation,
            scale: this.options.defaultScale,
            includeLegend: this.options.includeLegend,
            includeGrid: this.options.includeGrid,
            includeTitle: this.options.includeTitle,
            includeCopyright: this.options.includeCopyright,
            titleText: ''
        };
        
        // Paper size definitions (mm)
        this.paperSizes = {
            'A4': { width: 210, height: 297 },
            'A3': { width: 297, height: 420 },
            'A2': { width: 420, height: 594 },
            'A1': { width: 594, height: 841 },
            'A0': { width: 841, height: 1189 }
        };
        
        // Scale presets - Swiss mapping standards
        this.scalePresets = [
            '1:2\'500\'000',
            '1:1\'500\'000',
            '1:1\'000\'000',
            '1:500\'000',
            '1:300\'000',
            '1:200\'000',
            '1:100\'000',
            '1:50\'000',
            '1:25\'000',
            '1:20\'000',
            '1:10\'000',
            '1:5\'000',
            '1:2\'500',
            '1:1\'000',
            '1:500'
        ];
        
        this.init();
    }

    /**
     * Initialize the print overlay system
     */
    init() {
        // Load required libraries
        this.loadLibraries();
        
        // Create print button
        this.createPrintButton();
        
        // Create overlay elements
        this.createOverlayElements();
        
        // Create settings panel
        this.createSettingsPanel();
        
        // Bind events
        this.bindEvents();
        
        // Setup camera handling
        this.setupCameraHandling();
        
        console.log('✅ PrintOverlay initialized successfully');
    }

    /**
     * Load required libraries (html2canvas, jsPDF)
     */
    async loadLibraries() {
        try {
            // Load html2canvas
            if (typeof html2canvas === 'undefined') {
                await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
            }
            
            // Load jsPDF
            if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
                await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
                
                // Wait a bit for jsPDF to initialize
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Check if jsPDF is available globally
                if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
                    console.warn('⚠️ jsPDF not available globally, trying alternative loading...');
                    // Try alternative CDN
                    await this.loadScript('https://unpkg.com/jspdf@latest/dist/jspdf.umd.min.js');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            console.log('✅ Print libraries loaded successfully');
            console.log('📚 jsPDF available:', typeof jsPDF !== 'undefined' || typeof window.jspdf !== 'undefined');
            console.log('📚 html2canvas available:', typeof html2canvas !== 'undefined');
        } catch (error) {
            console.error('❌ Failed to load print libraries:', error);
        }
    }

    /**
     * Load a script dynamically
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Create print button and integrate into existing UI
     */
    createPrintButton() {
        // Print button is now created in the main index.html file
        // This method is kept for compatibility but doesn't create a button
        console.log('ℹ️ Print button creation handled in main index.html');
    }

    /**
     * Create overlay elements
     */
    createOverlayElements() {
        // Create overlay container
        this.overlayContainer = document.createElement('div');
        this.overlayContainer.className = 'print-overlay-container';
        this.overlayContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1000;
            display: none;
            user-select: none;
        `;
        
        // Create darkened area overlay (full screen dark overlay)
        this.darkenedOverlay = document.createElement('div');
        this.darkenedOverlay.className = 'print-darkened-overlay';
        this.darkenedOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            pointer-events: none;
            z-index: 1001;
        `;
        
        // Create print frame (transparent hole in the darkened overlay)
        this.printFrame = document.createElement('div');
        this.printFrame.className = 'print-frame';
        this.printFrame.style.cssText = `
            position: absolute;
            border: none;
            background: transparent;
            pointer-events: none;
            box-shadow: none;
            z-index: 1002;
        `;
        
        // Create frame labels
        this.createFrameLabels();
        
        // Add elements to container
        this.overlayContainer.appendChild(this.darkenedOverlay);
        this.overlayContainer.appendChild(this.printFrame);
        document.body.appendChild(this.overlayContainer);
    }

    /**
     * Create frame labels
     */
    createFrameLabels() {
        // Top label
        this.topLabel = document.createElement('div');
        this.topLabel.className = 'print-frame-label top-label';
        this.topLabel.style.cssText = `
            position: absolute;
            top: -30px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            white-space: nowrap;
            pointer-events: none;
        `;
        
        // Bottom label
        this.bottomLabel = document.createElement('div');
        this.bottomLabel.className = 'print-frame-label bottom-label';
        this.bottomLabel.style.cssText = `
            position: absolute;
            bottom: -30px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            white-space: nowrap;
            pointer-events: none;
        `;
        
        // Left label
        this.leftLabel = document.createElement('div');
        this.leftLabel.className = 'print-frame-label left-label';
        this.leftLabel.style.cssText = `
            position: absolute;
            left: -10px;
            top: 50%;
            transform: translateY(-50%) rotate(-90deg);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            white-space: nowrap;
            pointer-events: none;
        `;
        
        // Right label
        this.rightLabel = document.createElement('div');
        this.rightLabel.className = 'print-frame-label right-label';
        this.rightLabel.style.cssText = `
            position: absolute;
            right: -10px;
            top: 50%;
            transform: translateY(-50%) rotate(90deg);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            white-space: nowrap;
            pointer-events: none;
        `;
        
        this.printFrame.appendChild(this.topLabel);
        this.printFrame.appendChild(this.bottomLabel);
        this.printFrame.appendChild(this.leftLabel);
        this.printFrame.appendChild(this.rightLabel);
    }

    /**
     * Create settings panel
     */
    createSettingsPanel() {
        this.settingsPanel = document.createElement('div');
        this.settingsPanel.className = 'print-settings-panel';
        this.settingsPanel.innerHTML = this.getSettingsPanelHTML();
        this.settingsPanel.style.cssText = `
            position: fixed;
            top: 8px;
            right: 8px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 8px;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
            z-index: 2000;
            display: none;
            min-width: 180px;
            max-width: 220px;
            font-size: 11px;
        `;
        
        document.body.appendChild(this.settingsPanel);
        this.initializeSettingsControls();
    }

    /**
     * Get settings panel HTML
     */
    getSettingsPanelHTML() {
        return `
            <div class="print-settings-header" style="margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 13px;">🖨️ Print</h3>
                <button class="print-close-btn" onclick="printOverlay.exitPrintMode()" style="background: none; border: none; color: white; cursor: pointer; font-size: 14px;">✕</button>
            </div>
            
            <div class="print-settings-content" style="font-size: 10px;">
                <div class="print-setting-group" style="margin-bottom: 4px;">
                    <label style="display: block; margin-bottom: 1px;">Size:</label>
                    <select id="overlayPaperSize" style="width: 100%; padding: 1px; font-size: 10px;">
                        <option value="A4">A4</option>
                        <option value="A3">A3</option>
                        <option value="A2">A2</option>
                        <option value="A1">A1</option>
                        <option value="A0">A0</option>
                    </select>
                </div>
                
                <div class="print-setting-group" style="margin-bottom: 4px;">
                    <label style="display: block; margin-bottom: 1px;">Orientation:</label>
                    <div class="orientation-buttons" style="display: flex; gap: 3px;">
                        <button class="orientation-btn active" data-orientation="portrait" style="flex: 1; padding: 3px; font-size: 9px; background: #4CAF50; border: none; color: white; border-radius: 2px;">Portrait</button>
                        <button class="orientation-btn" data-orientation="landscape" style="flex: 1; padding: 3px; font-size: 9px; background: #666; border: none; color: white; border-radius: 2px;">Landscape</button>
                    </div>
                </div>
                
                <div class="print-setting-group" style="margin-bottom: 4px;">
                    <label style="display: block; margin-bottom: 1px;">Scale:</label>
                    <select id="overlayMapScale" style="width: 100%; padding: 1px; font-size: 10px;">
                        ${this.scalePresets.map(scale => `<option value="${scale}">${scale}</option>`).join('')}
                        <option value="custom">Custom...</option>
                    </select>
                </div>
                
                <div class="print-setting-group" id="customScaleContainer" style="display: none; margin-bottom: 4px;">
                    <label style="display: block; margin-bottom: 1px;">Custom Scale:</label>
                    <input type="text" id="customScaleInput" placeholder="1:1'500'000" style="width: 100%; padding: 1px; font-size: 10px;">
                </div>
                
                <div class="print-setting-group" style="margin-bottom: 3px;">
                    <label style="display: flex; align-items: center; gap: 3px; font-size: 9px;">
                        <input type="checkbox" id="overlayIncludeTitle" checked style="margin: 0;">
                        Title
                    </label>
                    <input type="text" id="overlayTitleText" placeholder="Enter title" style="margin-top: 3px; width: 100%; padding: 2px; font-size: 10px; display: none;" />
                </div>
                
                <div class="print-setting-group" style="margin-bottom: 3px;">
                    <label style="display: flex; align-items: center; gap: 3px; font-size: 9px;">
                        <input type="checkbox" id="overlayIncludeLegend" checked style="margin: 0;">
                        Legend
                    </label>
                </div>
                
                <div class="print-setting-group" style="margin-bottom: 6px;">
                    <label style="display: flex; align-items: center; gap: 3px; font-size: 9px;">
                        <input type="checkbox" id="overlayIncludeGrid" style="margin: 0;">
                        Grid
                    </label>
                </div>
                
                <div class="print-actions">
                    <button class="print-generate-btn" onclick="printOverlay.generatePDF()" style="width: 100%; padding: 5px; background: #4CAF50; border: none; color: white; border-radius: 3px; font-size: 11px; cursor: pointer;">
                        📄 Generate PDF
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Initialize settings controls
     */
    initializeSettingsControls() {
        // Paper size
        const paperSizeSelect = document.getElementById('overlayPaperSize');
        paperSizeSelect.value = this.currentSettings.paperSize;
        paperSizeSelect.onchange = (e) => {
            this.currentSettings.paperSize = e.target.value;
            this.updatePrintFrame();
        };
        
        // Orientation
        const orientationBtns = document.querySelectorAll('.orientation-btn');
        orientationBtns.forEach(btn => {
            btn.onclick = (e) => {
                orientationBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentSettings.orientation = e.target.dataset.orientation;
                this.updatePrintFrame();
            };
        });
        
        // Scale
        const mapScaleSelect = document.getElementById('overlayMapScale');
        mapScaleSelect.value = this.currentSettings.scale;
        mapScaleSelect.onchange = (e) => {
            this.currentSettings.scale = e.target.value;
            if (e.target.value === 'custom') {
                document.getElementById('customScaleContainer').style.display = 'block';
            } else {
                document.getElementById('customScaleContainer').style.display = 'none';
            }
            this.updatePrintFrame();
        };
        
        // Custom scale
        const customScaleInput = document.getElementById('customScaleInput');
        customScaleInput.onchange = (e) => {
            const formattedScale = this.formatScale(e.target.value);
            this.currentSettings.scale = formattedScale;
            e.target.value = formattedScale;
            this.updatePrintFrame();
        };
        
        // Content options (copyright is always included by default)
        const checkboxMap = {
            overlayIncludeTitle: 'includeTitle',
            overlayIncludeLegend: 'includeLegend',
            overlayIncludeGrid: 'includeGrid'
        };
        Object.entries(checkboxMap).forEach(([id, key]) => {
            const checkbox = document.getElementById(id);
            if (!checkbox) return;
            checkbox.checked = !!this.currentSettings[key];
            checkbox.onchange = (e) => {
                this.currentSettings[key] = e.target.checked;
                if (id === 'overlayIncludeTitle') {
                    const titleInput = document.getElementById('overlayTitleText');
                    if (titleInput) {
                        titleInput.style.display = e.target.checked ? 'block' : 'none';
                    }
                }
            };
        });

        // Title text input handling
        const titleInput = document.getElementById('overlayTitleText');
        if (titleInput) {
            titleInput.value = this.currentSettings.titleText || '';
            // Show input if title checkbox is enabled
            titleInput.style.display = this.currentSettings.includeTitle ? 'block' : 'none';
            titleInput.addEventListener('input', (e) => {
                this.currentSettings.titleText = e.target.value;
            });
        }
    }

    /**
     * Bind events
     */
    bindEvents() {
        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isActive) {
                this.exitPrintMode();
            }
        });
        
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (this.isActive && 
                !this.settingsPanel.contains(e.target) && 
                !this.printButton.contains(e.target)) {
                // Don't close if clicking on the map (for panning/zooming)
                if (!e.target.closest('.cesium-viewer')) {
                    this.exitPrintMode();
                }
            }
        });
        

    }
    
    /**
     * Enable map panning within print area
     */
    enableMapPanning() {
        // Enable Cesium camera controls for panning within the print frame
        if (this.viewer && this.viewer.scene.screenSpaceCameraController) {
            const controller = this.viewer.scene.screenSpaceCameraController;
            
            // Enable translate and rotate (needed for one-finger drag on mobile), keep tilt disabled
            controller.enableTranslate = true;
            controller.enableRotate = true;
            controller.enableTilt = false;
            if (typeof controller.enableLook !== 'undefined') {
                controller.enableLook = false;
            }
            controller.enableZoom = true;
            
            // Set panning constraints to keep the view within reasonable bounds
            controller.minimumZoomDistance = 1000;
            controller.maximumZoomDistance = 20000000;

            // Force translate to use LEFT_DRAG so single-finger/left-drag pans
            if (typeof Cesium !== 'undefined' && Cesium.CameraEventType) {
                // Allow left-drag to rotate (mobile one-finger), keep translate on right/middle drag
                controller.rotateEventTypes = [Cesium.CameraEventType.LEFT_DRAG];
                controller.translateEventTypes = [Cesium.CameraEventType.RIGHT_DRAG, Cesium.CameraEventType.MIDDLE_DRAG, Cesium.CameraEventType.PINCH];
                controller.zoomEventTypes = [Cesium.CameraEventType.WHEEL, Cesium.CameraEventType.PINCH];
                controller.tiltEventTypes = [];
                if (typeof controller.lookEventTypes !== 'undefined') {
                    controller.lookEventTypes = [];
                }
            }
            
            // Force Cesium to handle mouse events
            if (this.viewer.canvas) {
                this.viewer.canvas.style.pointerEvents = 'auto';
            }
            
            // Ensure the Cesium viewer container can receive events
            if (this.viewer.container) {
                this.viewer.container.style.pointerEvents = 'auto';
            }
            
            console.log('🎮 Camera controls updated:', {
                enableTranslate: controller.enableTranslate,
                enableRotate: controller.enableRotate,
                enableTilt: controller.enableTilt,
                enableZoom: controller.enableZoom
            });
            
            console.log('🎯 Cesium elements updated:', {
                canvasPointerEvents: this.viewer.canvas ? this.viewer.canvas.style.pointerEvents : 'N/A',
                containerPointerEvents: this.viewer.container ? this.viewer.container.style.pointerEvents : 'N/A'
            });
        } else {
            console.error('❌ Cesium viewer or camera controller not available');
        }
        
        // Add visual indication that map is draggable
        document.body.classList.add('print-mode-map-draggable');
        
        console.log('🗺️ Map panning enabled within print area');
    }
    
    /**
     * Explicitly enable Cesium interactions
     */
    enableCesiumInteractions() {
        if (!this.viewer) return;
        
        // Ensure Cesium viewer can receive events
        if (this.viewer.canvas) {
            this.viewer.canvas.style.pointerEvents = 'auto';
            this.viewer.canvas.style.userSelect = 'none';
        }
        
        if (this.viewer.container) {
            this.viewer.container.style.pointerEvents = 'auto';
            this.viewer.container.style.userSelect = 'none';
        }
        
        // Force Cesium to handle mouse events
        if (this.viewer.scene && this.viewer.scene.screenSpaceCameraController) {
            const controller = this.viewer.scene.screenSpaceCameraController;
            
            // Enable all necessary interactions
            controller.enableTranslate = true;
            controller.enableZoom = true;
            controller.enableRotate = true;
            controller.enableTilt = false;
            if (typeof controller.enableLook !== 'undefined') {
                controller.enableLook = false;
            }

            // Map event types so LEFT_DRAG pans
            if (typeof Cesium !== 'undefined' && Cesium.CameraEventType) {
                controller.rotateEventTypes = [Cesium.CameraEventType.LEFT_DRAG];
                controller.translateEventTypes = [Cesium.CameraEventType.RIGHT_DRAG, Cesium.CameraEventType.MIDDLE_DRAG, Cesium.CameraEventType.PINCH];
                controller.zoomEventTypes = [Cesium.CameraEventType.WHEEL, Cesium.CameraEventType.PINCH];
                controller.tiltEventTypes = [];
                if (typeof controller.lookEventTypes !== 'undefined') {
                    controller.lookEventTypes = [];
                }
            }
            
            // Set reasonable constraints
            controller.minimumZoomDistance = 1000;
            controller.maximumZoomDistance = 20000000;
            
            // Force Cesium to handle events properly
            if (this.viewer.scene.globe) {
                this.viewer.scene.globe.enableLighting = false;
            }
            
            // Ensure the viewer is responsive
            this.viewer.scene.requestRenderMode = false;
            this.viewer.scene.maximumRenderTimeChange = Infinity;
            
            console.log('🎯 Cesium interactions explicitly enabled');
        }
        
        // Add a small delay to ensure everything is properly initialized
        setTimeout(() => {
            if (this.viewer && this.viewer.scene && this.viewer.scene.screenSpaceCameraController) {
                const controller = this.viewer.scene.screenSpaceCameraController;
                controller.enableTranslate = true;
                controller.enableZoom = true;
                controller.enableRotate = true;
                if (typeof controller.enableLook !== 'undefined') {
                    controller.enableLook = false;
                }
                if (typeof Cesium !== 'undefined' && Cesium.CameraEventType) {
                    controller.rotateEventTypes = [Cesium.CameraEventType.LEFT_DRAG];
                    controller.translateEventTypes = [Cesium.CameraEventType.RIGHT_DRAG, Cesium.CameraEventType.MIDDLE_DRAG, Cesium.CameraEventType.PINCH];
                    controller.zoomEventTypes = [Cesium.CameraEventType.WHEEL, Cesium.CameraEventType.PINCH];
                    controller.tiltEventTypes = [];
                    if (typeof controller.lookEventTypes !== 'undefined') {
                        controller.lookEventTypes = [];
                    }
                }
                console.log('🎯 Cesium interactions re-enabled after delay');
            }
        }, 100);
    }

    /**
     * Toggle print mode
     */
    togglePrintMode() {
        if (this.isActive) {
            this.exitPrintMode();
        } else {
            this.enterPrintMode();
        }
    }

    /**
     * Enter print mode
     */
    enterPrintMode() {
        this.isActive = true;
        
        // Show overlay
        this.overlayContainer.style.display = 'block';
        this.settingsPanel.style.display = 'block';
        
        // Update frame
        this.updatePrintFrame();
        
        // Disable conflicting UI elements (this also enables panning)
        this.disableConflictingUI();
        
        // Explicitly enable map panning
        this.enableMapPanning();
        
        // Explicitly enable Cesium interactions
        this.enableCesiumInteractions();
        
        // Add print mode class to body
        document.body.classList.add('print-mode-active');
        
        // Add active class to print button
        const printButton = document.querySelector('.cesium-viewer-toolbar .cesium-button[title="Print to PDF"]');
        if (printButton) {
            printButton.classList.add('print-active');
        }
        
        console.log('🖨️ Print mode activated');
    }

    /**
     * Exit print mode
     */
    exitPrintMode() {
        this.isActive = false;
        
        // Hide overlay
        this.overlayContainer.style.display = 'none';
        this.settingsPanel.style.display = 'none';
        
        // Re-enable conflicting UI elements
        this.enableConflictingUI();
        
        // Remove print mode class
        document.body.classList.remove('print-mode-active');
        
        // Remove active class from print button
        const printButton = document.querySelector('.cesium-viewer-toolbar .cesium-button[title="Print to PDF"]');
        if (printButton) {
            printButton.classList.remove('print-active');
        }
        
        console.log('🖨️ Print mode deactivated');
    }

    /**
     * Update print frame with correct scale calculation
     */
    updatePrintFrame() {
        if (!this.isActive) return;
        
        const paperSize = this.paperSizes[this.currentSettings.paperSize];
        const isLandscape = this.currentSettings.orientation === 'landscape';
        
        // Calculate paper dimensions in mm
        const paperWidth = isLandscape ? Math.max(paperSize.width, paperSize.height) : Math.min(paperSize.width, paperSize.height);
        const paperHeight = isLandscape ? Math.min(paperSize.width, paperSize.height) : Math.max(paperSize.width, paperSize.height);
        
        // Parse scale ratio (e.g., "1:1'000'000" -> 1000000)
        const scaleRatio = this.parseScaleRatio(this.currentSettings.scale);
        
        // Calculate real-world dimensions in meters
        // Formula: real_world_meters = paper_width_mm * scale_ratio / 1000
        const realWorldWidthMeters = (paperWidth * scaleRatio) / 1000;
        const realWorldHeightMeters = (paperHeight * scaleRatio) / 1000;
        
        // Calculate frame size on screen (maintain aspect ratio)
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const maxFrameWidth = screenWidth * 0.8;
        const maxFrameHeight = screenHeight * 0.8;
        
        const aspectRatio = paperWidth / paperHeight;
        let frameWidth, frameHeight;
        
        if (aspectRatio > 1) {
            // Landscape
            frameWidth = Math.min(maxFrameWidth, maxFrameHeight * aspectRatio);
            frameHeight = frameWidth / aspectRatio;
        } else {
            // Portrait
            frameHeight = Math.min(maxFrameHeight, maxFrameWidth / aspectRatio);
            frameWidth = frameHeight * aspectRatio;
        }
        
        // Position frame in center
        const frameLeft = (screenWidth - frameWidth) / 2;
        const frameTop = (screenHeight - frameHeight) / 2;
        
        // Update frame
        this.printFrame.style.width = `${frameWidth}px`;
        this.printFrame.style.height = `${frameHeight}px`;
        this.printFrame.style.left = `${frameLeft}px`;
        this.printFrame.style.top = `${frameTop}px`;
        
        // Update darkened overlay to create transparent hole for print frame
        // Use CSS clip-path to create a transparent hole in the darkened overlay
        const clipPath = `polygon(
            0% 0%, 
            0% 100%, 
            ${frameLeft}px 100%, 
            ${frameLeft}px ${frameTop}px, 
            ${frameLeft + frameWidth}px ${frameTop}px, 
            ${frameLeft + frameWidth}px ${frameTop + frameHeight}px, 
            ${frameLeft}px ${frameTop + frameHeight}px, 
            ${frameLeft}px 100%, 
            100% 100%, 
            100% 0%
        )`;
        
        this.darkenedOverlay.style.clipPath = clipPath;
        

        
        // Only update camera if we're not already updating it (prevents infinite loop)
        if (!this.isUpdatingCamera) {
            this.updateCameraForScale(realWorldWidthMeters, realWorldHeightMeters);
        }
        
        // Update labels with real-world information
        this.updateFrameLabels(frameWidth, frameHeight, realWorldWidthMeters, realWorldHeightMeters);
        
        // Ensure map panning is enabled after frame update
        if (this.isActive) {
            this.enableMapPanning();
        }
    }

    /**
     * Parse scale ratio from string (e.g., "1:1'000'000" -> 1000000)
     */
    parseScaleRatio(scaleString) {
        const cleanScale = scaleString.replace(/['\s]/g, '');
        const match = cleanScale.match(/1:(\d+)/);
        if (match) {
            return parseInt(match[1]);
        }
        return 1000000; // Default fallback
    }

    /**
     * Update camera to match the selected scale
     */
    updateCameraForScale(realWorldWidthMeters, realWorldHeightMeters) {
        if (!this.viewer || !this.viewer.camera) return;
        
        // Prevent infinite recursion by checking if we're already updating
        if (this.isUpdatingCamera) return;
        this.isUpdatingCamera = true;
        
        try {
            // Get current camera position
            const camera = this.viewer.camera;
            const currentPosition = camera.positionCartographic;
            
            // Calculate the required distance to show the real-world extent
            // Use the smaller dimension to ensure the frame fits
            const realWorldExtent = Math.min(realWorldWidthMeters, realWorldHeightMeters);
            
            // Calculate camera height based on field of view and real-world extent
            // Formula: height = extent / (2 * tan(fov/2))
            const fov = camera.frustum.fov; // Field of view in radians
            const requiredHeight = realWorldExtent / (2 * Math.tan(fov / 2));
            
            // Set camera to new height while maintaining current position
            const newPosition = Cesium.Cartesian3.fromRadians(
                currentPosition.longitude,
                currentPosition.latitude,
                requiredHeight
            );
            
            // Set camera position directly instead of flying to prevent event loops
            camera.setView({
                destination: newPosition
            });
            
            // Force a render after camera movement
            this.viewer.scene.render();
            
        } catch (error) {
            console.error('Error updating camera for scale:', error);
        } finally {
            // Reset the flag after a short delay
            setTimeout(() => {
                this.isUpdatingCamera = false;
            }, 100);
        }
    }

    /**
     * Update frame labels with real-world information
     */
    updateFrameLabels(frameWidth, frameHeight, realWorldWidthMeters, realWorldHeightMeters) {
        const paperSize = this.paperSizes[this.currentSettings.paperSize];
        const isLandscape = this.currentSettings.orientation === 'landscape';
        
        const paperWidth = isLandscape ? Math.max(paperSize.width, paperSize.height) : Math.min(paperSize.width, paperSize.height);
        const paperHeight = isLandscape ? Math.min(paperSize.width, paperSize.height) : Math.max(paperSize.width, paperSize.height);
        
        // Format real-world dimensions
        const formatDistance = (meters) => {
            if (meters >= 1000) {
                return `${(meters / 1000).toFixed(1)} km`;
            } else {
                return `${Math.round(meters)} m`;
            }
        };
        
        const labelText = `${this.currentSettings.paperSize} ${this.currentSettings.orientation} | ${this.currentSettings.scale}`;
        const realWorldText = `${formatDistance(realWorldWidthMeters)} × ${formatDistance(realWorldHeightMeters)}`;
        
        this.topLabel.textContent = labelText;
        this.bottomLabel.textContent = realWorldText;
        this.leftLabel.textContent = '';
        this.rightLabel.textContent = '';
    }

    /**
     * Disable conflicting UI elements
     */
    disableConflictingUI() {
        // Disable gizmo if it exists and has disable method
        if (window.gizmo && typeof window.gizmo.disable === 'function') {
            try {
                window.gizmo.disable();
            } catch (error) {
                console.warn('⚠️ Could not disable gizmo:', error);
            }
        }
        
        // Disable model importer if it exists
        if (window.modelImporter && typeof window.modelImporter.disable === 'function') {
            try {
                window.modelImporter.disable();
            } catch (error) {
                console.warn('⚠️ Could not disable model importer:', error);
            }
        }
        
        // Disable measurement tools if they exist
        const measureButtons = document.querySelectorAll('[title*="measure"], [title*="Measure"]');
        measureButtons.forEach(btn => {
            btn.style.opacity = '0.3';
            btn.style.pointerEvents = 'none';
        });
        
        // Add visual indication
        document.body.classList.add('print-mode-ui-disabled');
        
        // Configure Cesium navigation controls for print mode
        if (this.viewer && this.viewer.scene.screenSpaceCameraController) {
            // Enable panning for map movement within print frame
            this.viewer.scene.screenSpaceCameraController.enableTranslate = true;
            this.viewer.scene.screenSpaceCameraController.enableRotate = true;
            this.viewer.scene.screenSpaceCameraController.enableTilt = false;
            this.viewer.scene.screenSpaceCameraController.enableZoom = true;
            if (typeof this.viewer.scene.screenSpaceCameraController.enableLook !== 'undefined') {
                this.viewer.scene.screenSpaceCameraController.enableLook = false;
            }
            if (typeof Cesium !== 'undefined' && Cesium.CameraEventType) {
                const controller = this.viewer.scene.screenSpaceCameraController;
                controller.rotateEventTypes = [Cesium.CameraEventType.LEFT_DRAG];
                controller.translateEventTypes = [Cesium.CameraEventType.RIGHT_DRAG, Cesium.CameraEventType.MIDDLE_DRAG, Cesium.CameraEventType.PINCH];
                controller.zoomEventTypes = [Cesium.CameraEventType.WHEEL, Cesium.CameraEventType.PINCH];
                controller.tiltEventTypes = [];
                if (typeof controller.lookEventTypes !== 'undefined') {
                    controller.lookEventTypes = [];
                }
            }
        }
    }

    /**
     * Enable conflicting UI elements
     */
    enableConflictingUI() {
        // Re-enable gizmo if it exists and has enable method
        if (window.gizmo && typeof window.gizmo.enable === 'function') {
            try {
                window.gizmo.enable();
            } catch (error) {
                console.warn('⚠️ Could not enable gizmo:', error);
            }
        }
        
        // Re-enable model importer if it exists
        if (window.modelImporter && typeof window.modelImporter.enable === 'function') {
            try {
                window.modelImporter.enable();
            } catch (error) {
                console.warn('⚠️ Could not enable model importer:', error);
            }
        }
        
        // Re-enable measurement tools
        const measureButtons = document.querySelectorAll('[title*="measure"], [title*="Measure"]');
        measureButtons.forEach(btn => {
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
        });
        
        // Remove visual indication
        document.body.classList.remove('print-mode-ui-disabled');
        
        // Re-enable Cesium navigation controls
        if (this.viewer && this.viewer.scene.screenSpaceCameraController) {
            this.viewer.scene.screenSpaceCameraController.enableRotate = true;
            this.viewer.scene.screenSpaceCameraController.enableTilt = true;
        }
    }

    /**
     * Generate PDF
     */
    async generatePDF() {
        if (!this.isActive) return;
        
        try {
            console.log('🔄 Generating PDF...');
            
            // Check if jsPDF is available
            let jsPDFLib = null;
            
            // Try different ways jsPDF might be available
            if (typeof window.jspdf !== 'undefined') {
                jsPDFLib = window.jspdf.jsPDF;
            } else if (typeof jsPDF !== 'undefined') {
                jsPDFLib = jsPDF;
            } else if (typeof window.jsPDF !== 'undefined') {
                jsPDFLib = window.jsPDF;
            }
            
            if (typeof jsPDFLib === 'undefined') {
                console.log('⚠️ jsPDF not found, attempting to load...');
                // Try to load jsPDF again
                await this.loadLibraries();
                
                // Check again after loading
                if (typeof window.jspdf !== 'undefined') {
                    jsPDFLib = window.jspdf.jsPDF;
                } else if (typeof jsPDF !== 'undefined') {
                    jsPDFLib = jsPDF;
                } else if (typeof window.jsPDF !== 'undefined') {
                    jsPDFLib = window.jsPDF;
                }
                
                if (typeof jsPDFLib === 'undefined') {
                    throw new Error('jsPDF library could not be loaded. Please check your internet connection and refresh the page.');
                }
            }
            
            console.log('📚 jsPDF available:', typeof jsPDFLib);
            
            // Show loading state
            const generateBtn = document.querySelector('.print-generate-btn');
            const originalText = generateBtn.textContent;
            generateBtn.textContent = '🔄 Generating...';
            generateBtn.disabled = true;
            
            // Get frame dimensions
            const frameRect = this.printFrame.getBoundingClientRect();
            
            // Create PDF
            const pdf = new jsPDFLib({
                orientation: this.currentSettings.orientation,
                unit: 'mm',
                format: this.currentSettings.paperSize
            });
            
            // Capture the frame area
            const imageData = await this.captureFrameArea(frameRect);
            
            // Add image to PDF (high resolution)
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 5;
            const imageWidth = pageWidth - (2 * margin);
            const imageHeight = (imageData.height / imageData.width) * imageWidth;
            
            // Add the optimized image with JPEG compression for smaller file size
            pdf.addImage(imageData.dataUrl, 'JPEG', margin, margin, imageWidth, imageHeight, undefined, 'FAST');
            
            // Note: Title, scale bar, north arrow, legend, and copyright are now drawn directly on the canvas
            // No need to add them separately to avoid duplication
            
            // Save PDF
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            pdf.save(`myearth-print-${timestamp}.pdf`);
            
            console.log('✅ PDF generated successfully');
            
            // Show success message
            this.showMessage('✅ PDF generated successfully!', 'success');
            
            // Exit print mode
            this.exitPrintMode();
            
        } catch (error) {
            console.error('❌ PDF generation failed:', error);
            this.showMessage('❌ PDF generation failed: ' + error.message, 'error');
        } finally {
            // Restore button
            const generateBtn = document.querySelector('.print-generate-btn');
            generateBtn.textContent = '📄 Generate PDF';
            generateBtn.disabled = false;
        }
    }

        /**
     * Capture frame area with optimized resolution and compression
     */
    async captureFrameArea(frameRect) {
        // Create a temporary canvas for the frame area
        const canvas = this.viewer.canvas;
        
        // Force a render
        this.viewer.scene.render();
        
        // Create a temporary canvas for the frame with optimized resolution (2x for balance)
        const frameCanvas = document.createElement('canvas');
        const ctx = frameCanvas.getContext('2d');
        
        // Set frame dimensions with optimized resolution (2x for good quality, smaller size)
        const scale = 2; // 2x resolution for good quality without excessive size
        frameCanvas.width = frameRect.width * scale;
        frameCanvas.height = frameRect.height * scale;
        
        // Calculate source rectangle on the Cesium canvas
        const cesiumRect = this.viewer.canvas.getBoundingClientRect();
        const sourceX = (frameRect.left - cesiumRect.left) * (canvas.width / cesiumRect.width);
        const sourceY = (frameRect.top - cesiumRect.top) * (canvas.height / cesiumRect.height);
        const sourceWidth = frameRect.width * (canvas.width / cesiumRect.width);
        const sourceHeight = frameRect.height * (canvas.height / cesiumRect.height);
        
        // Draw the frame area
        ctx.drawImage(
            canvas,
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, frameCanvas.width, frameCanvas.height
        );
        
        // Scale context for high resolution
        ctx.scale(scale, scale);
        
        // Add title if requested (only once, clean positioning)
        if (this.currentSettings.includeTitle && this.currentSettings.titleText && this.currentSettings.titleText.trim().length > 0) {
            ctx.fillStyle = 'white';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'left';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            ctx.fillText(this.currentSettings.titleText.trim(), 10, 20);
        }
        
        // Add scale bar at bottom center (clean positioning)
        this.drawScaleBar(ctx, frameRect.width, frameRect.height);
        
        // Add north arrow at top right (proper positioning)
        this.drawNorthArrow(ctx, frameRect.width, frameRect.height);
        
        // Add legend if requested (clean, bottom-left, no overlap)
        if (this.currentSettings.includeLegend) {
            this.drawLegend(ctx, frameRect.width, frameRect.height);
        }

        // Add grid if requested
        if (this.currentSettings.includeGrid) {
            this.drawGridOnCanvas(ctx, frameRect.width, frameRect.height);
        }
        
        // Add copyright (always included by default)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '9px Arial';
        ctx.textAlign = 'right';
        ctx.shadowBlur = 1;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillText('© MyEarth Team', frameRect.width - 10, frameRect.height - 15);
        ctx.fillText('Map data © OpenStreetMap contributors', frameRect.width - 10, frameRect.height - 8);
        
        // Add MyEarth.app logo at bottom right
        this.drawLogo(ctx, frameRect.width, frameRect.height);
        
        // Return compressed JPEG data for smaller file size
        return {
            dataUrl: frameCanvas.toDataURL('image/jpeg', 0.8), // JPEG with 0.8 quality for compression
            width: frameCanvas.width,
            height: frameCanvas.height
        };
    }

    /**
     * Draw scale bar with improved positioning
     */
    drawScaleBar(ctx, width, height) {
        const scaleRatio = this.parseScaleRatio(this.currentSettings.scale);
        const paperWidth = this.paperSizes[this.currentSettings.paperSize].width;
        const realWorldWidthMeters = (paperWidth * scaleRatio) / 1000;
        
        // Calculate scale bar length (aim for ~80px on screen for better fit)
        const scaleBarLength = 80;
        const realWorldDistance = (scaleBarLength / width) * realWorldWidthMeters;
        
        // Round to nice values
        const niceDistance = this.roundToNiceValue(realWorldDistance);
        const actualBarLength = (niceDistance / realWorldWidthMeters) * width;
        
        // Position at bottom center with proper spacing
        const barX = width / 2 - actualBarLength / 2;
        const barY = height - 35; // Moved up slightly to avoid overlap
        
        // Draw scale bar background for better visibility
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(barX - 5, barY - 8, actualBarLength + 10, 25);
        
        // Draw scale bar
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        
        // Main bar
        ctx.beginPath();
        ctx.moveTo(barX, barY);
        ctx.lineTo(barX + actualBarLength, barY);
        ctx.stroke();
        
        // Tick marks (every 20% of the bar)
        const tickCount = 5;
        for (let i = 0; i <= tickCount; i++) {
            const x = barX + (actualBarLength / tickCount) * i;
            ctx.beginPath();
            ctx.moveTo(x, barY - 4);
            ctx.lineTo(x, barY + 4);
            ctx.stroke();
        }
        
        // Labels
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 1;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        ctx.fillText('0', barX, barY + 15);
        ctx.fillText(this.formatDistance(niceDistance), barX + actualBarLength, barY + 15);
        
        // Scale text (smaller, positioned above bar)
        ctx.font = '9px Arial';
        ctx.fillText(`Scale: ${this.currentSettings.scale}`, width / 2, barY - 5);
    }

    /**
     * Draw north arrow with improved positioning
     */
    drawNorthArrow(ctx, width, height) {
        const arrowX = width - 25;
        const arrowY = 25;
        const arrowSize = 16;
        
        // Draw arrow background with subtle border
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillRect(arrowX - 12, arrowY - 12, 24, 24);
        
        // Draw arrow border
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(arrowX - 12, arrowY - 12, 24, 24);
        
        // Draw arrow
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY - arrowSize / 2);
        ctx.lineTo(arrowX - arrowSize / 3, arrowY + arrowSize / 2);
        ctx.lineTo(arrowX + arrowSize / 3, arrowY + arrowSize / 2);
        ctx.closePath();
        ctx.fill();
        
        // Draw "N" label
        ctx.fillStyle = 'black';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('N', arrowX, arrowY + arrowSize / 2 + 12);
    }

    /**
     * Draw clean legend with improved positioning
     */
    drawLegend(ctx, width, height) {
        const legendX = 10;
        const legendY = height - 70; // Moved up to avoid overlap with scale bar
        const legendWidth = 100;
        const legendHeight = 50;
        
        // Draw legend background with subtle border
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillRect(legendX, legendY, legendWidth, legendHeight);
        
        // Draw legend border
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);
        
        // Legend title
        ctx.fillStyle = 'black';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'left';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillText('Legend', legendX + 5, legendY + 12);
        
        // Legend items (compact layout)
        const legendItems = [
            { color: '#4CAF50', label: 'Terrain' },
            { color: '#2196F3', label: 'Water' },
            { color: '#FF9800', label: '3D Models' }
        ];
        
        let yOffset = legendY + 20;
        legendItems.forEach(item => {
            // Color box
            ctx.fillStyle = item.color;
            ctx.fillRect(legendX + 5, yOffset - 6, 6, 6);
            
            // Label
            ctx.fillStyle = 'black';
            ctx.font = '9px Arial';
            ctx.fillText(item.label, legendX + 15, yOffset);
            
            yOffset += 10;
        });
    }

    /**
     * Round distance to nice values
     */
    roundToNiceValue(distance) {
        const niceValues = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000];
        const magnitude = Math.pow(10, Math.floor(Math.log10(distance)));
        const normalized = distance / magnitude;
        
        for (const nice of niceValues) {
            if (nice >= normalized) {
                return nice * magnitude;
            }
        }
        return niceValues[niceValues.length - 1] * magnitude;
    }

    /**
     * Format distance for display
     */
    formatDistance(meters) {
        if (meters >= 1000) {
            return `${meters / 1000} km`;
        } else {
            return `${meters} m`;
        }
    }

    /**
     * Add legend to PDF
     */
    addLegendToPDF(pdf, pageWidth, pageHeight, margin) {
        const legendY = pageHeight - 40;
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Legend', margin, legendY);
        
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        
        const legendItems = [
            { color: '#4CAF50', label: 'Terrain' },
            { color: '#2196F3', label: 'Water' },
            { color: '#FF9800', label: '3D Models' }
        ];
        
        let yOffset = legendY + 3;
        legendItems.forEach(item => {
            pdf.setFillColor(item.color);
            pdf.rect(margin, yOffset, 3, 3, 'F');
            pdf.text(item.label, margin + 6, yOffset + 2);
            yOffset += 6;
        });
    }

    /**
     * Add coordinate grid to PDF
     */
    addGridToPDF(pdf, pageWidth, pageHeight, margin) {
        const gridSpacing = 15;
        const gridColor = [200, 200, 200];
        
        pdf.setDrawColor(...gridColor);
        pdf.setLineWidth(0.1);
        
        // Vertical lines
        for (let x = margin; x <= pageWidth - margin; x += gridSpacing) {
            pdf.line(x, margin, x, pageHeight - margin);
        }
        
        // Horizontal lines
        for (let y = margin; y <= pageHeight - margin; y += gridSpacing) {
            pdf.line(margin, y, pageWidth - margin, y);
        }
    }

    /**
     * Format scale number with Swiss-style apostrophes
     */
    formatScale(scale) {
        if (typeof scale === 'string') {
            const cleanScale = scale.replace(/['\s]/g, '');
            const match = cleanScale.match(/1:(\d+)/);
            if (match) {
                const number = parseInt(match[1]);
                return `1:${number.toLocaleString('de-CH').replace(/\./g, "'")}`;
            }
        }
        return scale;
    }

    /**
     * Show message
     */
    showMessage(message, type = 'info') {
        // Disabled popup messages - do nothing
        return;
    }

    /**
     * Setup camera movement handling
     */
    setupCameraHandling() {
        if (!this.viewer) return;
        
        // Update frame when camera moves in print mode
        this.viewer.camera.moveEnd.addEventListener(() => {
            if (this.isActive && !this.isUpdatingCamera) {
                // In print mode, update the frame to match current camera
                // But only if we're not currently updating the camera ourselves
                this.updatePrintFrame();
            }
        });
    }

    /**
     * Destroy the print overlay
     */
    destroy() {
        if (this.printButton && this.printButton.parentNode) {
            this.printButton.parentNode.removeChild(this.printButton);
        }
        if (this.overlayContainer && this.overlayContainer.parentNode) {
            this.overlayContainer.parentNode.removeChild(this.overlayContainer);
        }
        if (this.settingsPanel && this.settingsPanel.parentNode) {
            this.settingsPanel.parentNode.removeChild(this.settingsPanel);
        }
    }

    /**
     * Draw coordinate grid on the canvas (baked into captured image)
     */
    drawGridOnCanvas(ctx, width, height) {
        const gridSpacing = 40; // pixels
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 0.5;
        // Vertical lines
        for (let x = 0; x <= width; x += gridSpacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        // Horizontal lines
        for (let y = 0; y <= height; y += gridSpacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        ctx.restore();
    }

    /**
     * Draw MyEarth.app logo at bottom right of the canvas
     */
    drawLogo(ctx, width, height) {
        ctx.save();
        
        // Position at bottom right with padding
        const logoX = width - 80;
        const logoY = height - 25;
        
        // Background for better visibility
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(logoX - 5, logoY - 15, 75, 20);
        
        // Logo text styling
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'right';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 1;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        // Draw "My" on first line
        ctx.fillText('My', logoX + 70, logoY - 2);
        
        // Draw "Earth.app" on second line
        ctx.font = 'bold 10px Arial';
        ctx.fillText('Earth.app', logoX + 70, logoY + 8);
        
        ctx.restore();
    }
}

// Export for global access
window.PrintOverlay = PrintOverlay; 