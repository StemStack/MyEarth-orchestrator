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
            includeCopyright: this.options.includeCopyright
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
            border: 3px solid #4CAF50;
            background: transparent;
            pointer-events: none;
            box-shadow: 0 0 20px rgba(76, 175, 80, 0.3);
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
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
            z-index: 2000;
            display: none;
            min-width: 280px;
        `;
        
        document.body.appendChild(this.settingsPanel);
        this.initializeSettingsControls();
    }

    /**
     * Get settings panel HTML
     */
    getSettingsPanelHTML() {
        return `
            <div class="print-settings-header">
                <h3>🖨️ Print Settings</h3>
                <button class="print-close-btn" onclick="printOverlay.exitPrintMode()">✕</button>
            </div>
            
            <div class="print-settings-content">
                <div class="print-setting-group">
                    <label>Paper Size:</label>
                    <select id="overlayPaperSize">
                        <option value="A4">A4</option>
                        <option value="A3">A3</option>
                        <option value="A2">A2</option>
                        <option value="A1">A1</option>
                        <option value="A0">A0</option>
                    </select>
                </div>
                
                <div class="print-setting-group">
                    <label>Orientation:</label>
                    <div class="orientation-buttons">
                        <button class="orientation-btn active" data-orientation="portrait">📏 Portrait</button>
                        <button class="orientation-btn" data-orientation="landscape">📐 Landscape</button>
                    </div>
                </div>
                
                <div class="print-setting-group">
                    <label>Scale:</label>
                    <select id="overlayMapScale">
                        ${this.scalePresets.map(scale => `<option value="${scale}">${scale}</option>`).join('')}
                        <option value="custom">Custom...</option>
                    </select>
                </div>
                
                <div class="print-setting-group" id="customScaleContainer" style="display: none;">
                    <label>Custom Scale:</label>
                    <input type="text" id="customScaleInput" placeholder="1:1'500'000">
                </div>
                
                <div class="print-setting-group">
                    <label>
                        <input type="checkbox" id="overlayIncludeTitle" checked>
                        Include Title
                    </label>
                </div>
                
                <div class="print-setting-group">
                    <label>
                        <input type="checkbox" id="overlayIncludeLegend" checked>
                        Include Legend
                    </label>
                </div>
                
                <div class="print-setting-group">
                    <label>
                        <input type="checkbox" id="overlayIncludeGrid">
                        Include Grid
                    </label>
                </div>
                
                <div class="print-setting-group">
                    <label>
                        <input type="checkbox" id="overlayIncludeCopyright" checked>
                        Include Copyright
                    </label>
                </div>
                
                <div class="print-actions">
                    <button class="print-generate-btn" onclick="printOverlay.generatePDF()">
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
        
        // Content options
        const checkboxes = ['overlayIncludeTitle', 'overlayIncludeLegend', 'overlayIncludeGrid', 'overlayIncludeCopyright'];
        checkboxes.forEach(id => {
            const checkbox = document.getElementById(id);
            checkbox.checked = this.currentSettings[id.replace('overlay', '').toLowerCase()];
            checkbox.onchange = (e) => {
                this.currentSettings[id.replace('overlay', '').toLowerCase()] = e.target.checked;
            };
        });
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
        
        // Disable conflicting UI elements
        this.disableConflictingUI();
        
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
        this.leftLabel.textContent = `${paperWidth}mm`;
        this.rightLabel.textContent = `${paperHeight}mm`;
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
        
        // Disable Cesium navigation controls
        if (this.viewer && this.viewer.scene.screenSpaceCameraController) {
            this.viewer.scene.screenSpaceCameraController.enableRotate = false;
            this.viewer.scene.screenSpaceCameraController.enableTilt = false;
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
        if (this.currentSettings.includeTitle) {
            ctx.fillStyle = 'white';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'left';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            ctx.fillText('MyEarth - 3D Globe Viewer', 10, 20);
        }
        
        // Add scale bar at bottom center (clean positioning)
        this.drawScaleBar(ctx, frameRect.width, frameRect.height);
        
        // Add north arrow at top right (proper positioning)
        this.drawNorthArrow(ctx, frameRect.width, frameRect.height);
        
        // Add legend if requested (clean, bottom-left, no overlap)
        if (this.currentSettings.includeLegend) {
            this.drawLegend(ctx, frameRect.width, frameRect.height);
        }
        
        // Add copyright if requested (bottom-right, no overlap with scale bar)
        if (this.currentSettings.includeCopyright) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.font = '9px Arial';
            ctx.textAlign = 'right';
            ctx.shadowBlur = 1;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.fillText('© MyEarth Team', frameRect.width - 10, frameRect.height - 15);
            ctx.fillText('Map data © OpenStreetMap contributors', frameRect.width - 10, frameRect.height - 8);
        }
        
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
        const messageDiv = document.createElement('div');
        messageDiv.className = `print-overlay-message print-overlay-message-${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: bold;
            z-index: 10000;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (document.body.contains(messageDiv)) {
                    document.body.removeChild(messageDiv);
                }
            }, 300);
        }, 3000);
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
}

// Export for global access
window.PrintOverlay = PrintOverlay; 