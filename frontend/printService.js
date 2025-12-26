/**
 * PrintService.js
 * High-quality PDF generation for CesiumJS applications
 * Inspired by map.geo.admin.ch print functionality
 * 
 * @author MyEarth Team
 * @version 1.0.0
 */

class PrintService {
    constructor(viewer, options = {}) {
        this.viewer = viewer;
        this.options = {
            dpi: 300,
            defaultPaperSize: 'A4',
            defaultOrientation: 'portrait',
            defaultScale: '1:1\'500\'000', // Swiss standard default
            includeLegend: true,
            includeGrid: false,
            includeTitle: true,
            includeCopyright: true,
            ...options
        };
        
        this.isCapturing = false;
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
        
        // Scale presets - following Swiss mapping standards (map.geo.admin.ch)
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
     * Initialize the print service
     */
    init() {
        // Load required libraries dynamically
        this.loadLibraries();
        
        // Create print panel
        this.createPrintPanel();
        
        // Bind events
        this.bindEvents();
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
            if (typeof jsPDF === 'undefined') {
                await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
            }
            
            console.log('✅ Print libraries loaded successfully');
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
     * Create the print panel UI
     */
    createPrintPanel() {
        // Create print button
        this.printButton = document.createElement('button');
        this.printButton.className = 'print-button';
        this.printButton.innerHTML = '🖨️';
        this.printButton.title = 'Print to PDF';
        this.printButton.onclick = () => this.togglePrintPanel();
        
        // Create print panel
        this.printPanel = document.createElement('div');
        this.printPanel.className = 'print-panel';
        this.printPanel.innerHTML = this.getPrintPanelHTML();
        
        // Add to DOM
        document.body.appendChild(this.printButton);
        document.body.appendChild(this.printPanel);
        
        // Initialize panel controls
        this.initializePanelControls();
    }

    /**
     * Get print panel HTML
     */
    getPrintPanelHTML() {
        return `
            <div class="print-panel-header">
                <h3>🖨️ Print to PDF</h3>
                <button class="print-close-btn" onclick="printService.closePrintPanel()">✕</button>
            </div>
            
            <div class="print-panel-content">
                <div class="print-section">
                    <h4>📄 Paper Settings</h4>
                    <div class="print-option">
                        <label>Paper Size:</label>
                        <select id="paperSize">
                            <option value="A4">A4</option>
                            <option value="A3">A3</option>
                            <option value="A2">A2</option>
                            <option value="A1">A1</option>
                            <option value="A0">A0</option>
                        </select>
                    </div>
                    <div class="print-option">
                        <label>Orientation:</label>
                        <div class="orientation-buttons">
                            <button class="orientation-btn active" data-orientation="portrait">📏 Portrait</button>
                            <button class="orientation-btn" data-orientation="landscape">📐 Landscape</button>
                        </div>
                    </div>
                </div>
                
                <div class="print-section">
                    <h4>📏 Scale</h4>
                    <div class="print-option">
                        <label>Map Scale:</label>
                        <select id="mapScale">
                            ${this.scalePresets.map(scale => `<option value="${scale}">${scale}</option>`).join('')}
                            <option value="custom">Custom...</option>
                        </select>
                    </div>
                    <div class="print-option" id="customScaleContainer" style="display: none;">
                        <label>Custom Scale:</label>
                        <input type="text" id="customScale" placeholder="1:1'500'000">
                    </div>
                </div>
                
                <div class="print-section">
                    <h4>🎨 Content Options</h4>
                    <div class="print-option">
                        <label>
                            <input type="checkbox" id="includeTitle" checked>
                            Include Title
                        </label>
                    </div>
                    <div class="print-option">
                        <label>
                            <input type="checkbox" id="includeLegend" checked>
                            Include Legend
                        </label>
                    </div>
                    <div class="print-option">
                        <label>
                            <input type="checkbox" id="includeGrid">
                            Include Coordinate Grid
                        </label>
                    </div>
                    <div class="print-option">
                        <label>
                            <input type="checkbox" id="includeCopyright" checked>
                            Include Copyright
                        </label>
                    </div>
                </div>
                
                <div class="print-section">
                    <h4>👁️ Preview</h4>
                    <div class="print-preview" id="printPreview">
                        <div class="preview-placeholder">
                            <span>🔄 Generating preview...</span>
                        </div>
                    </div>
                </div>
                
                <div class="print-actions">
                    <button class="print-generate-btn" onclick="printService.generatePDF()">
                        📄 Generate PDF
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Initialize panel controls
     */
    initializePanelControls() {
        // Paper size
        const paperSizeSelect = document.getElementById('paperSize');
        paperSizeSelect.value = this.currentSettings.paperSize;
        paperSizeSelect.onchange = (e) => {
            this.currentSettings.paperSize = e.target.value;
            this.updatePreview();
        };
        
        // Orientation
        const orientationBtns = document.querySelectorAll('.orientation-btn');
        orientationBtns.forEach(btn => {
            btn.onclick = (e) => {
                orientationBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentSettings.orientation = e.target.dataset.orientation;
                this.updatePreview();
            };
        });
        
        // Scale
        const mapScaleSelect = document.getElementById('mapScale');
        mapScaleSelect.value = this.currentSettings.scale;
        mapScaleSelect.onchange = (e) => {
            this.currentSettings.scale = e.target.value;
            if (e.target.value === 'custom') {
                document.getElementById('customScaleContainer').style.display = 'block';
            } else {
                document.getElementById('customScaleContainer').style.display = 'none';
            }
            this.updatePreview();
        };
        
        // Custom scale
        const customScaleInput = document.getElementById('customScale');
        customScaleInput.onchange = (e) => {
            const formattedScale = this.formatScale(e.target.value);
            this.currentSettings.scale = formattedScale;
            e.target.value = formattedScale;
            this.updatePreview();
        };
        
        // Content options
        const checkboxes = ['includeTitle', 'includeLegend', 'includeGrid', 'includeCopyright'];
        checkboxes.forEach(id => {
            const checkbox = document.getElementById(id);
            checkbox.checked = this.currentSettings[id];
            checkbox.onchange = (e) => {
                this.currentSettings[id] = e.target.checked;
                this.updatePreview();
            };
        });
        
        // Initial preview
        setTimeout(() => this.updatePreview(), 100);
        
        // Auto-update scale based on camera position
        this.setupAutoScaleUpdate();
    }

    /**
     * Bind events
     */
    bindEvents() {
        // Close panel on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.printPanel.classList.contains('active')) {
                this.closePrintPanel();
            }
        });
        
        // Close panel on outside click
        document.addEventListener('click', (e) => {
            if (this.printPanel.classList.contains('active') && 
                !this.printPanel.contains(e.target) && 
                !this.printButton.contains(e.target)) {
                this.closePrintPanel();
            }
        });
    }

    /**
     * Toggle print panel
     */
    togglePrintPanel() {
        this.printPanel.classList.toggle('active');
        if (this.printPanel.classList.contains('active')) {
            this.updatePreview();
        }
    }

    /**
     * Close print panel
     */
    closePrintPanel() {
        this.printPanel.classList.remove('active');
    }

    /**
     * Update preview
     */
    async updatePreview() {
        const previewContainer = document.getElementById('printPreview');
        if (!previewContainer) return;
        
        try {
            previewContainer.innerHTML = '<div class="preview-placeholder"><span>🔄 Generating preview...</span></div>';
            
            // Ensure Cesium is ready
            await this.ensureCesiumReady();
            
            // Generate preview
            const previewDataUrl = await this.generatePreview();
            
            previewContainer.innerHTML = `
                <img src="${previewDataUrl}" alt="Print Preview" class="preview-image">
                <div class="preview-info">
                    <div>Paper: ${this.currentSettings.paperSize} ${this.currentSettings.orientation}</div>
                    <div>Scale: ${this.currentSettings.scale}</div>
                </div>
            `;
        } catch (error) {
            console.error('Preview generation failed:', error);
            previewContainer.innerHTML = '<div class="preview-placeholder"><span>❌ Preview failed</span></div>';
        }
    }

    /**
     * Ensure Cesium viewer is ready for capture
     */
    async ensureCesiumReady() {
        return new Promise((resolve) => {
            // Check if viewer is ready
            if (this.viewer && this.viewer.scene && this.viewer.scene.globe) {
                // Force a render
                this.viewer.scene.render();
                
                // Wait a bit for the render to complete
                setTimeout(resolve, 100);
            } else {
                // Wait for viewer to be ready
                setTimeout(resolve, 500);
            }
        });
    }

    /**
     * Setup automatic scale updates based on camera movement
     */
    setupAutoScaleUpdate() {
        if (!this.viewer) return;
        
        // Update scale when camera moves
        this.viewer.camera.moveEnd.addEventListener(() => {
            if (this.printPanel && this.printPanel.classList.contains('active')) {
                const calculatedScale = this.calculateMapScale();
                const scaleSelect = document.getElementById('mapScale');
                if (scaleSelect && !scaleSelect.value.includes('custom')) {
                    // Only auto-update if not using custom scale
                    this.currentSettings.scale = calculatedScale;
                    scaleSelect.value = calculatedScale;
                    this.updatePreview();
                }
            }
        });
    }

    /**
     * Format scale number with Swiss-style apostrophes
     */
    formatScale(scale) {
        if (typeof scale === 'string') {
            // Remove existing formatting and add Swiss-style apostrophes
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
     * Generate preview image
     */
    async generatePreview() {
        if (this.isCapturing) return;
        
        this.isCapturing = true;
        
        try {
            // Use Cesium's built-in screenshot functionality
            const canvas = this.viewer.canvas;
            
            // Force a render to ensure the scene is up to date
            this.viewer.scene.render();
            
            // Create a temporary canvas for the preview
            const tempCanvas = document.createElement('canvas');
            const ctx = tempCanvas.getContext('2d');
            
            // Set preview dimensions
            const previewWidth = 400;
            const previewHeight = 300;
            tempCanvas.width = previewWidth;
            tempCanvas.height = previewHeight;
            
            // Draw the Cesium canvas to our temp canvas
            ctx.drawImage(canvas, 0, 0, previewWidth, previewHeight);
            
            // Add title if requested
            if (this.currentSettings.includeTitle) {
                ctx.fillStyle = 'white';
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'left';
                ctx.shadowColor = 'black';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
                ctx.fillText('MyEarth - 3D Globe Viewer', 10, 25);
            }
            
            // Add scale info
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.font = '12px Arial';
            ctx.shadowBlur = 2;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            ctx.fillText(`Scale: ${this.currentSettings.scale}`, 10, previewHeight - 20);
            ctx.fillText(`Paper: ${this.currentSettings.paperSize} ${this.currentSettings.orientation}`, 10, previewHeight - 8);
            
            return tempCanvas.toDataURL('image/png');
            
        } catch (error) {
            console.error('Preview capture failed:', error);
            
            // Fallback: create a simple preview with viewer info
            const tempCanvas = document.createElement('canvas');
            const ctx = tempCanvas.getContext('2d');
            tempCanvas.width = 400;
            tempCanvas.height = 300;
            
            // Create a gradient background
            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, '#1e3c72');
            gradient.addColorStop(1, '#2a5298');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 400, 300);
            
            // Add text
            ctx.fillStyle = 'white';
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('MyEarth - 3D Globe Viewer', 200, 120);
            
            ctx.font = '14px Arial';
            ctx.fillText('Preview not available', 200, 150);
            ctx.fillText(`Scale: ${this.currentSettings.scale}`, 200, 170);
            ctx.fillText(`Paper: ${this.currentSettings.paperSize} ${this.currentSettings.orientation}`, 200, 190);
            
            return tempCanvas.toDataURL('image/png');
        } finally {
            this.isCapturing = false;
        }
    }

    /**
     * Generate PDF
     */
    async generatePDF() {
        if (this.isCapturing) {
            console.warn('Already generating PDF...');
            return;
        }
        
        this.isCapturing = true;
        
        try {
            console.log('🔄 Generating PDF...');
            
            // Show loading state
            const generateBtn = document.querySelector('.print-generate-btn');
            const originalText = generateBtn.textContent;
            generateBtn.textContent = '🔄 Generating...';
            generateBtn.disabled = true;
            
            // Get paper dimensions
            const paperSize = this.paperSizes[this.currentSettings.paperSize];
            const isLandscape = this.currentSettings.orientation === 'landscape';
            const width = isLandscape ? Math.max(paperSize.width, paperSize.height) : Math.min(paperSize.width, paperSize.height);
            const height = isLandscape ? Math.min(paperSize.width, paperSize.height) : Math.max(paperSize.width, paperSize.height);
            
            // Create PDF
            const pdf = new jsPDF({
                orientation: this.currentSettings.orientation,
                unit: 'mm',
                format: this.currentSettings.paperSize
            });
            
            // Ensure Cesium is ready
            await this.ensureCesiumReady();
            
            // Capture the view
            const imageData = await this.captureViewForPDF();
            
            // Calculate image dimensions to fit page
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 10;
            const imageWidth = pageWidth - (2 * margin);
            const imageHeight = (imageData.height / imageData.width) * imageWidth;
            
            // Add image to PDF
            pdf.addImage(imageData.dataUrl, 'PNG', margin, margin, imageWidth, imageHeight);
            
            // Add title
            if (this.currentSettings.includeTitle) {
                pdf.setFontSize(18);
                pdf.setFont('helvetica', 'bold');
                pdf.text('MyEarth - 3D Globe Viewer', pageWidth / 2, margin + 15, { align: 'center' });
            }
            
            // Add scale
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`Scale: ${this.currentSettings.scale}`, margin, pageHeight - 30);
            
            // Add copyright
            if (this.currentSettings.includeCopyright) {
                pdf.setFontSize(10);
                pdf.text('© MyEarth Team - Generated with CesiumJS', margin, pageHeight - 20);
                pdf.text('Map data © OpenStreetMap contributors', margin, pageHeight - 15);
            }
            
            // Add legend if requested
            if (this.currentSettings.includeLegend) {
                this.addLegendToPDF(pdf, pageWidth, pageHeight, margin);
            }
            
            // Add grid if requested
            if (this.currentSettings.includeGrid) {
                this.addGridToPDF(pdf, pageWidth, pageHeight, margin);
            }
            
            // Save PDF
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            pdf.save(`myearth-print-${timestamp}.pdf`);
            
            console.log('✅ PDF generated successfully');
            
            // Show success message
            this.showMessage('✅ PDF generated successfully!', 'success');
            
        } catch (error) {
            console.error('❌ PDF generation failed:', error);
            this.showMessage('❌ PDF generation failed: ' + error.message, 'error');
        } finally {
            this.isCapturing = false;
            
            // Restore button
            const generateBtn = document.querySelector('.print-generate-btn');
            generateBtn.textContent = '📄 Generate PDF';
            generateBtn.disabled = false;
        }
    }

    /**
     * Capture view for PDF generation
     */
    async captureViewForPDF() {
        try {
            // Use Cesium's canvas directly
            const canvas = this.viewer.canvas;
            
            // Force a render to ensure the scene is up to date
            this.viewer.scene.render();
            
            // Create a high-resolution canvas for PDF
            const pdfCanvas = document.createElement('canvas');
            const ctx = pdfCanvas.getContext('2d');
            
            // Set high resolution for PDF
            const pdfWidth = 1200;
            const pdfHeight = 900;
            pdfCanvas.width = pdfWidth;
            pdfCanvas.height = pdfHeight;
            
            // Draw the Cesium canvas to our PDF canvas
            ctx.drawImage(canvas, 0, 0, pdfWidth, pdfHeight);
            
            // Add title if requested
            if (this.currentSettings.includeTitle) {
                ctx.fillStyle = 'white';
                ctx.font = 'bold 24px Arial';
                ctx.textAlign = 'left';
                ctx.shadowColor = 'black';
                ctx.shadowBlur = 6;
                ctx.shadowOffsetX = 3;
                ctx.shadowOffsetY = 3;
                ctx.fillText('MyEarth - 3D Globe Viewer', 20, 40);
            }
            
            // Add scale info
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.font = '18px Arial';
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            ctx.fillText(`Scale: ${this.currentSettings.scale}`, 20, pdfHeight - 30);
            ctx.fillText(`Generated: ${new Date().toLocaleDateString()}`, 20, pdfHeight - 10);
            
            return {
                dataUrl: pdfCanvas.toDataURL('image/png'),
                width: pdfCanvas.width,
                height: pdfCanvas.height
            };
            
        } catch (error) {
            console.error('PDF capture failed:', error);
            
            // Fallback: create a simple PDF image
            const fallbackCanvas = document.createElement('canvas');
            const ctx = fallbackCanvas.getContext('2d');
            fallbackCanvas.width = 1200;
            fallbackCanvas.height = 900;
            
            // Create a gradient background
            const gradient = ctx.createLinearGradient(0, 0, 0, 900);
            gradient.addColorStop(0, '#1e3c72');
            gradient.addColorStop(1, '#2a5298');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 1200, 900);
            
            // Add text
            ctx.fillStyle = 'white';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('MyEarth - 3D Globe Viewer', 600, 300);
            
            ctx.font = '24px Arial';
            ctx.fillText('PDF generation failed', 600, 350);
            ctx.fillText(`Scale: ${this.currentSettings.scale}`, 600, 380);
            ctx.fillText(`Paper: ${this.currentSettings.paperSize} ${this.currentSettings.orientation}`, 600, 410);
            ctx.fillText(`Generated: ${new Date().toLocaleDateString()}`, 600, 440);
            
            return {
                dataUrl: fallbackCanvas.toDataURL('image/png'),
                width: fallbackCanvas.width,
                height: fallbackCanvas.height
            };
        }
    }

    /**
     * Add legend to PDF
     */
    addLegendToPDF(pdf, pageWidth, pageHeight, margin) {
        const legendY = pageHeight - 60;
        
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Legend', margin, legendY);
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        
        // Add sample legend items (customize based on your layers)
        const legendItems = [
            { color: '#4CAF50', label: 'Terrain' },
            { color: '#2196F3', label: 'Water' },
            { color: '#FF9800', label: '3D Models' }
        ];
        
        let yOffset = legendY + 5;
        legendItems.forEach(item => {
            pdf.setFillColor(item.color);
            pdf.rect(margin, yOffset, 5, 5, 'F');
            pdf.text(item.label, margin + 8, yOffset + 4);
            yOffset += 8;
        });
    }

    /**
     * Add coordinate grid to PDF
     */
    addGridToPDF(pdf, pageWidth, pageHeight, margin) {
        const gridSpacing = 20;
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
     * Show message
     */
    showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `print-message print-message-${type}`;
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
     * Get current camera information
     */
    getCameraInfo() {
        const camera = this.viewer.camera;
        const position = camera.position;
        const cartographic = Cesium.Cartographic.fromCartesian(position);
        
        return {
            longitude: Cesium.Math.toDegrees(cartographic.longitude),
            latitude: Cesium.Math.toDegrees(cartographic.latitude),
            height: cartographic.height,
            heading: Cesium.Math.toDegrees(camera.heading),
            pitch: Cesium.Math.toDegrees(camera.pitch),
            roll: Cesium.Math.toDegrees(camera.roll)
        };
    }

    /**
     * Calculate map scale based on camera height
     */
    calculateMapScale() {
        const camera = this.viewer.camera;
        const height = camera.positionCartographic.height;
        
        // Scale calculation based on height - following Swiss mapping standards
        if (height < 500000) return '1:500\'000';
        if (height < 1000000) return '1:1\'000\'000';
        if (height < 2000000) return '1:1\'500\'000';
        if (height < 5000000) return '1:2\'500\'000';
        if (height < 10000000) return '1:5\'000\'000';
        if (height < 20000000) return '1:10\'000\'000';
        return '1:25\'000\'000';
    }

    /**
     * Destroy the print service
     */
    destroy() {
        if (this.printButton && this.printButton.parentNode) {
            this.printButton.parentNode.removeChild(this.printButton);
        }
        if (this.printPanel && this.printPanel.parentNode) {
            this.printPanel.parentNode.removeChild(this.printPanel);
        }
    }
}

// Export for global access
window.PrintService = PrintService; 