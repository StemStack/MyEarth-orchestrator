# 🖨️ Print-to-PDF Feature for MyEarth

A comprehensive **high-quality PDF generation system** for your CesiumJS-based 3D globe viewer, inspired by map.geo.admin.ch.

## ✨ Features

### 🎯 **Professional PDF Generation**
- **High Resolution**: 300 DPI output suitable for printing
- **Multiple Paper Sizes**: A4, A3, A2, A1, A0 (portrait/landscape)
- **Scale Presets**: 1:500,000 to 1:10,000,000 + custom input
- **Content Options**: Title, legend, coordinate grid, copyright

### 🎨 **Clean, Modern UI**
- **Floating Print Button**: Top-right corner with smooth animations
- **Slide-out Panel**: Professional settings interface
- **Live Preview**: Real-time preview of PDF output
- **Responsive Design**: Mobile-friendly with touch controls

### 🔧 **Advanced Functionality**
- **Camera Lock**: Prevents accidental movement during capture
- **Layer Integration**: Captures all active layers and overlays
- **Scale Calculation**: Automatic scale based on camera height
- **Legend Generation**: Auto-generated from active layers

## 📁 File Structure

```
MyEarth/
├── printService.js      # Core print functionality
├── printStyles.css      # UI styles and animations
├── index.html           # Main application (integrated)
├── main.py              # FastAPI backend (serves files)
└── README_PRINT.md      # This documentation
```

## 🚀 Quick Start

### 1. **Access the Print Feature**
- Click the **🖨️ print button** in the top-right corner
- The print panel slides in from the right

### 2. **Configure Settings**
- **Paper Size**: Select A4, A3, A2, A1, or A0
- **Orientation**: Choose portrait or landscape
- **Scale**: Pick from presets or enter custom scale
- **Content**: Toggle title, legend, grid, copyright

### 3. **Preview & Generate**
- **Live Preview**: See how your PDF will look
- **Generate PDF**: Click "📄 Generate PDF" button
- **Download**: PDF automatically downloads with timestamp

## 🎮 **UI Controls**

### **Print Button**
- **Location**: Top-right corner of the viewer
- **Icon**: 🖨️ printer emoji
- **Tooltip**: "Print to PDF"
- **Animation**: Smooth hover effects

### **Print Panel**
- **Layout**: Slide-out sidebar (400px wide)
- **Sections**: Paper Settings, Scale, Content Options, Preview
- **Close**: Click ✕ button or press ESC
- **Responsive**: Full-width on mobile devices

### **Settings Options**

#### **📄 Paper Settings**
- **Paper Size**: A4, A3, A2, A1, A0
- **Orientation**: Portrait 📏 / Landscape 📐

#### **📏 Scale**
- **Presets**: 1:500,000, 1:1,000,000, 1:1,500,000, etc.
- **Custom**: Enter any scale (e.g., "1:2500000")

#### **🎨 Content Options**
- **Include Title**: "MyEarth - 3D Globe Viewer"
- **Include Legend**: Auto-generated from active layers
- **Include Grid**: Coordinate grid overlay
- **Include Copyright**: Attribution and licensing info

## 🔧 **Technical Implementation**

### **Core Technologies**
- **html2canvas**: High-quality canvas capture
- **jsPDF**: Professional PDF generation
- **CesiumJS**: 3D globe integration
- **CSS3**: Modern animations and styling

### **Capture Process**
1. **Temporary Container**: Creates off-screen capture area
2. **Canvas Cloning**: Copies current Cesium view
3. **High Resolution**: 2x scale for crisp output
4. **Content Addition**: Title, legend, grid as requested
5. **PDF Assembly**: Combines image with metadata

### **Scale Calculation**
```javascript
// Automatic scale based on camera height
calculateMapScale() {
    const height = camera.positionCartographic.height;
    if (height < 1000000) return '1:500000';
    if (height < 2000000) return '1:1000000';
    // ... more ranges
}
```

## 🎯 **Integration with Existing App**

### **Automatic Integration**
The print service is automatically initialized with your existing MyEarth app:

```javascript
// Already integrated in index.html
const printService = new PrintService(viewer, {
    defaultPaperSize: 'A4',
    defaultOrientation: 'portrait',
    defaultScale: '1:1000000',
    includeLegend: true,
    includeGrid: false,
    includeTitle: true,
    includeCopyright: true
});
```

### **Global Access**
```javascript
// Access from browser console
window.printService.togglePrintPanel();
window.printService.generatePDF();
```

## 📱 **Mobile Support**

### **Responsive Design**
- **Touch-friendly**: Large buttons and controls
- **Full-width panel**: On mobile devices
- **Optimized layout**: Stacked controls for small screens
- **Gesture support**: Swipe to close panel

### **Mobile Features**
- **Portrait orientation**: Optimized for mobile viewing
- **Simplified controls**: Essential options only
- **Fast preview**: Optimized for mobile performance

## 🎨 **Design System**

### **Color Scheme**
- **Primary**: #4CAF50 (Green)
- **Background**: rgba(0, 0, 0, 0.95) (Dark)
- **Text**: White with proper contrast
- **Accents**: Subtle transparency effects

### **Typography**
- **Headers**: 18px, 600 weight
- **Labels**: 13px, 500 weight
- **Body**: 13px, normal weight
- **Info**: 11px, muted color

### **Animations**
- **Slide transitions**: 0.3s ease
- **Hover effects**: Scale and color changes
- **Loading states**: Smooth transitions
- **Reduced motion**: Respects user preferences

## 🔧 **Customization**

### **Modify Default Settings**
```javascript
const printService = new PrintService(viewer, {
    defaultPaperSize: 'A3',           // Change default paper
    defaultOrientation: 'landscape',   // Change default orientation
    defaultScale: '1:500000',         // Change default scale
    includeLegend: false,              // Disable legend by default
    includeGrid: true,                 // Enable grid by default
    dpi: 300                          // Set output resolution
});
```

### **Custom Legend Items**
```javascript
// In printService.js, modify addLegendToPDF method
const legendItems = [
    { color: '#4CAF50', label: 'Terrain' },
    { color: '#2196F3', label: 'Water' },
    { color: '#FF9800', label: '3D Models' },
    // Add your custom items here
];
```

### **Custom Paper Sizes**
```javascript
// Add custom paper sizes
this.paperSizes = {
    'A4': { width: 210, height: 297 },
    'A3': { width: 297, height: 420 },
    'Custom': { width: 300, height: 400 }, // Add custom size
    // ... more sizes
};
```

## 🧪 **Testing**

### **Test Scenarios**
1. **Empty View**: Globe with no additional content
2. **3D Models**: With imported Polycam GLB files
3. **Multiple Layers**: Terrain, imagery, overlays
4. **Heavy Content**: Large models and complex scenes
5. **Mobile Devices**: Touch interaction and responsive layout

### **Performance Testing**
- **Memory Usage**: Monitor for leaks during capture
- **File Size**: Check PDF output sizes
- **Generation Time**: Measure PDF creation speed
- **Browser Compatibility**: Test across different browsers

### **Quality Assurance**
- **Resolution**: Verify 300 DPI output
- **Scale Accuracy**: Confirm scale calculations
- **Content Fidelity**: Ensure all elements are captured
- **Print Quality**: Test actual printing

## 🐛 **Troubleshooting**

### **Common Issues**

#### **PDF Generation Fails**
```javascript
// Check browser console for errors
// Ensure html2canvas and jsPDF are loaded
console.log('html2canvas:', typeof html2canvas);
console.log('jsPDF:', typeof jsPDF);
```

#### **Preview Not Updating**
```javascript
// Force preview update
printService.updatePreview();
```

#### **Large File Sizes**
```javascript
// Reduce capture resolution
const canvasData = await html2canvas(tempContainer, {
    scale: 1, // Reduce from 2 to 1
    // ... other options
});
```

#### **Missing Content**
```javascript
// Check if layers are visible
console.log('Active layers:', viewer.imageryLayers.length);
console.log('Active entities:', viewer.entities.values.length);
```

### **Debug Mode**
```javascript
// Enable debug logging
printService.debug = true;
```

## 📈 **Performance Optimization**

### **Memory Management**
- **Temporary containers**: Properly cleaned up after capture
- **Canvas disposal**: Release memory after PDF generation
- **Image optimization**: Compress large captures

### **Speed Improvements**
- **Lazy loading**: Libraries loaded on demand
- **Preview caching**: Store preview images temporarily
- **Background processing**: Non-blocking PDF generation

### **Mobile Optimization**
- **Reduced resolution**: Lower quality for mobile devices
- **Simplified preview**: Faster preview generation
- **Touch optimization**: Larger touch targets

## 🔮 **Future Enhancements**

### **Planned Features**
- **Batch Export**: Multiple PDFs at once
- **Template System**: Custom PDF layouts
- **Watermarking**: Add custom watermarks
- **Metadata Export**: Include camera position, layers info
- **Cloud Storage**: Direct upload to cloud services

### **Advanced Options**
- **Vector Export**: SVG/PDF vector format
- **Animation Export**: Multi-frame PDFs
- **Interactive PDFs**: Clickable elements in PDF
- **Custom Styling**: User-defined themes

## 📄 **License & Attribution**

### **Open Source Libraries**
- **html2canvas**: MIT License
- **jsPDF**: MIT License
- **CesiumJS**: Apache 2.0 License

### **Attribution**
- **Map Data**: © OpenStreetMap contributors
- **MyEarth**: © MyEarth Team
- **Generated with**: CesiumJS

## 🤝 **Support**

### **Getting Help**
1. **Check Console**: Browser developer tools for errors
2. **Test Basic**: Try with simple view first
3. **Check Network**: Ensure all files are loading
4. **Browser Support**: Test in different browsers

### **Reporting Issues**
- **Error Messages**: Include full error text
- **Steps to Reproduce**: Detailed reproduction steps
- **Browser Info**: Version and platform
- **Console Logs**: Any relevant error messages

---

**🎉 Enjoy professional-quality PDF exports from your MyEarth 3D globe viewer!** 