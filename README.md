# My Earth - 3D Globe Visualization Application

A sophisticated web-based 3D/2D earth visualization application built with CesiumJS, featuring comprehensive geospatial capabilities, interactive tools, and a PostgreSQL/PostGIS backend for spatial data management.

![CesiumJS Globe Viewer](https://img.shields.io/badge/CesiumJS-1.111-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-green)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-PostGIS-orange)

## 🌍 Features

### Core Visualization
- **3D Globe Mode**: Full WebGL-powered 3D earth visualization with satellite imagery
- **2D Flat Earth Mode**: Equirectangular projection (EPSG:4326) for cartographic display
- **Dynamic Layer Management**: Support for WMS, TileJSON, and GeoJSON data sources
- **Real-time Coordinate Tracking**: Live lat/lon display with centimeter precision
- **Interactive Scale Bar**: Dynamic scale calculation based on current view

### Professional Tools
- **Measurement System**: Distance, area, and vertical measurements with metric/imperial units
- **Marker Placement**: Interactive point markers with customizable colors and labels
- **Print/Export Tool**: Professional map export with geo.admin.ch styling
- **Layer Management**: Comprehensive layer controls with visibility toggles
- **Search & Navigation**: Global location search with autocomplete suggestions

### Data Sources (100% Free & Open Source)
- **Base Maps**: OpenStreetMap, Humanitarian OSM, CyclOSM, OpenTopoMap, CartoDB, ESRI World Imagery
- **Protected Areas**: World Database of Protected Areas (UNEP-WCMC)
- **Terrain**: Enhanced terrain visualization with configurable exaggeration
- **No Cesium Ion**: Completely independent of paid services

### Backend Infrastructure
- **FastAPI**: Modern Python web framework with automatic OpenAPI documentation
- **PostgreSQL/PostGIS**: Spatial database for geospatial data storage and queries
- **RESTful API**: Location management and spatial search endpoints
- **CORS Support**: Proper cross-origin resource sharing for frontend-backend communication

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- PostgreSQL with PostGIS extension
- Modern web browser with WebGL support

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd my-earth-viewer
   ```

2. **Install Python dependencies**:
   ```bash
   pip install fastapi uvicorn geoalchemy2 psycopg2-binary python-dotenv sqlalchemy
   ```

3. **Set up PostgreSQL database**:
   ```bash
   # Create database and enable PostGIS
   createdb myearth
   psql myearth -c "CREATE EXTENSION postgis;"
   ```

4. **Configure environment**:
   ```bash
   # Create .env file
   echo "DATABASE_URL=postgresql://username:password@localhost/myearth" > .env
   ```

### Running the Application

1. **Start the backend server**:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

2. **Start the frontend server**:
   ```bash
   python -m http.server 5000
   ```

3. **Access the application**:
   - Frontend: http://localhost:5000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

## 🏗️ Architecture

### Frontend (Client-Side)
- **Pure HTML/CSS/JavaScript**: No build tools or frameworks required
- **CesiumJS 1.111**: 3D globe rendering and WebGL visualization
- **Responsive Design**: Mobile-friendly interface with collapsible panels
- **Swiss-Style UI**: Professional interface inspired by Swiss GIS applications

### Backend (Server-Side)
- **FastAPI Framework**: High-performance async web framework
- **SQLAlchemy ORM**: Object-relational mapping with GeoAlchemy2 for spatial types
- **Pydantic Models**: Data validation and serialization
- **PostgreSQL/PostGIS**: Spatial database with SRID 4326 coordinate system

### API Endpoints
- `POST /locations` - Create new location
- `GET /locations` - Retrieve all locations
- `GET /locations/nearby` - Spatial proximity search
- `GET /health` - Service health check

## 🎛️ User Interface

### Right Panel Tools
1. **North Arrow** - Reset view orientation to north
2. **Flat Earth Toggle** - Switch between 3D globe and 2D flat modes
3. **Home View** - Return to default Europe/North Africa view
4. **Zoom Controls** - Precise zoom in/out
5. **Search Tool** - Global location search with autocomplete
6. **Measurement Tool** - Distance, area, and vertical measurements
7. **Marker Tool** - Place and manage point markers
8. **3D Models** - Load and display 3D models
9. **Layer Manager** - Control base maps and overlay layers
10. **Capture Tool** - Take screenshots of current view
11. **Fullscreen** - Toggle fullscreen mode
12. **Settings** - Customize appearance and behavior
13. **Print/Export** - Professional map export with metadata

### Left Sidebar
- **Maps Displayed**: Base map selection and layer visibility
- **Data Services**: Load external WMS, TileJSON, and GeoJSON data
- **Measurement Controls**: Unit selection and measurement tools
- **3D Models**: Upload and manage 3D model files
- **Performance**: System performance monitoring

## 🌐 Supported Data Formats

### Imagery Layers
- **WMS Services**: Web Map Service overlays with configurable layers
- **TileJSON**: Mapbox-style raster tiles for satellite imagery and labels
- **URL Templates**: Standard {z}/{x}/{y} tile services

### Vector Data
- **GeoJSON**: Vector features from public URLs with styling
- **Markers**: Point locations with custom colors and labels
- **Measurements**: Distance and area calculations with real-time display

## 🔧 Configuration

### Environment Variables
```bash
DATABASE_URL=postgresql://user:password@host:port/database
PGHOST=localhost
PGPORT=5432
PGUSER=username
PGPASSWORD=password
PGDATABASE=myearth
```

### Camera Settings
- **Default View**: Europe/North Africa region (15°E, 45°N)
- **Initial Height**: 4,000 km altitude
- **Pitch**: -90° (straight down)
- **Heading**: 0° (north orientation)

### Layer Configuration
- **Base Map**: OpenStreetMap Standard (default)
- **Terrain**: Enhanced terrain with 1.5x exaggeration
- **Atmosphere**: Enabled for 3D mode, disabled for 2D
- **Protected Areas**: WDPA layer enabled by default

## 🐛 Troubleshooting

### Common Issues

1. **Blue overlay in flat earth mode**:
   - Fixed in latest version by simplifying layer reload process
   - Ensure Geographic projection is properly applied

2. **Tile loading errors**:
   - Check network connectivity
   - Verify WMS/tile service URLs are accessible
   - Some services may have rate limiting

3. **Database connection issues**:
   - Verify PostgreSQL is running
   - Check PostGIS extension is installed
   - Confirm DATABASE_URL environment variable

4. **Performance issues**:
   - Disable terrain for better performance on low-end devices
   - Reduce layer count for mobile devices
   - Use simplified base maps for faster loading

### Browser Compatibility
- **Recommended**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **WebGL Required**: Modern browsers with WebGL 1.0+ support
- **Mobile**: iOS Safari 14+, Android Chrome 90+

## 📝 Development Notes

### Recent Improvements
- Fixed flat earth mode blue overlay issue
- Enhanced PostgreSQL/PostGIS backend integration
- Improved panel transparency and visual effects
- Added professional map export functionality
- Implemented marker renaming and management
- Enhanced Swiss-style user interface

### Technical Decisions
- **No Cesium Ion**: Complete independence from paid services
- **Open Source Only**: All data sources are free and open
- **Geographic Projection**: EPSG:4326 for accurate 2D cartographic display
- **PostGIS Integration**: Spatial database for scalable geospatial operations

## 📄 License

This project uses open-source technologies and free data sources:
- **CesiumJS**: Apache 2.0 License
- **OpenStreetMap**: Open Database License (ODbL)
- **FastAPI**: MIT License
- **PostgreSQL/PostGIS**: PostgreSQL License

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues, questions, or feature requests:
- Email: support@myearth.app
- GitHub Issues: [Create an issue](issues)

---

**Version**: 1.0  
**Built with**: CesiumJS, FastAPI, PostgreSQL/PostGIS  
**Last Updated**: July 17, 2025