# MyEarth.app - User Authentication & Layer Management

## 🎯 Overview

This document describes the new logged-in user functionalities for MyEarth.app, a modern web GIS platform built with CesiumJS, React, FastAPI, and PostgreSQL.

## 🔐 Authentication System

### OAuth2 Providers
- **Google**: Sign in with Google account
- **GitHub**: Sign in with GitHub account  
- **LinkedIn**: Sign in with LinkedIn account

### Features
- JWT token-based authentication
- Automatic user creation on first login
- Session management with localStorage
- Secure token validation
- User profile management

## 🔍 Layer Search & Management

### Search Capabilities
- **Keyword Search**: Search by title, description, and tags
- **Category Filter**: Filter by predefined categories (biodiversity, climate, agriculture, etc.)
- **License Filter**: Filter by license type
- **Rating Filter**: Filter by minimum rating
- **Sort Options**: Sort by date, rating, popularity, or title

### Layer Metadata
Each layer includes:
- Title and description
- Tags (array of strings)
- Category and license
- Source URL
- File information (size, format, processed format)
- Geospatial metadata (bbox, center coordinates, zoom level)
- Statistics (view count, download count)
- Rating system (average rating, number of ratings)
- Author information
- Creation and update timestamps

## ⭐ Rating System

### Features
- **1-5 Star Rating**: Users can rate any public layer
- **One Rating Per User**: Each user can only rate a layer once (can update)
- **Average Rating Display**: Shows average rating and number of votes
- **User Rating Tracking**: Shows user's own rating for each layer

### Database Schema
```sql
layer_ratings:
- id (UUID, primary key)
- layer_id (UUID, foreign key)
- user_id (UUID, foreign key)
- rating (integer, 1-5)
- comment (text, optional)
- created_at (datetime)
- updated_at (datetime)
```

## 📤 Dataset Contribution

### File Upload
**Supported Formats:**
- `.geojson` - GeoJSON files
- `.shp` - Shapefiles (with .dbf, .shx)
- `.gpkg` - GeoPackage files
- `.kml` - KML files
- `.kmz` - KMZ files
- `.zip` - Compressed files (shapefiles)

**Processing:**
- Automatic conversion to GeoJSON using GeoPandas
- Metadata extraction (bbox, center coordinates, zoom level)
- File size and format tracking
- Error handling and validation

### URL-based Addition
**Supported Services:**
- **WMS**: Web Map Service endpoints
- **TileJSON**: TileJSON specification files
- **GeoJSON API**: Direct GeoJSON URLs

**Features:**
- URL validation and accessibility checking
- Automatic metadata extraction
- Format detection and processing
- Error handling for invalid URLs

### Metadata Form
Users can input/edit:
- **Title**: Layer name
- **Description**: Detailed description
- **Tags**: Comma-separated tags (auto-suggest available)
- **Category**: Dropdown selection
- **License**: Dropdown selection
- **Source URL**: Original data source
- **Visibility**: Public or private toggle

## 🗂️ Database Schema

### Core Tables

#### Users
```sql
users:
- id (UUID, primary key)
- email (string, unique)
- username (string, unique)
- full_name (string)
- avatar_url (string)
- oauth_provider (string)
- oauth_id (string)
- is_active (boolean)
- is_admin (boolean)
- created_at (datetime)
- updated_at (datetime)
```

#### Layers
```sql
layers:
- id (UUID, primary key)
- user_id (UUID, foreign key)
- title (string)
- description (text)
- tags (array of strings)
- source_url (string)
- license (string)
- category (string)
- is_public (boolean)
- file_path (string)
- file_size (integer)
- file_format (string)
- processed_format (string)
- bbox (array of floats)
- center_lon (float)
- center_lat (float)
- zoom_level (integer)
- view_count (integer)
- download_count (integer)
- created_at (datetime)
- updated_at (datetime)
```

#### Layer Ratings
```sql
layer_ratings:
- id (UUID, primary key)
- layer_id (UUID, foreign key)
- user_id (UUID, foreign key)
- rating (integer, 1-5)
- comment (text)
- created_at (datetime)
- updated_at (datetime)
```

#### Categories & Licenses
```sql
layer_categories:
- id (UUID, primary key)
- name (string, unique)
- description (text)
- icon (string)
- color (string)
- created_at (datetime)

licenses:
- id (UUID, primary key)
- name (string, unique)
- description (text)
- url (string)
- is_open (boolean)
- created_at (datetime)
```

## 🎨 User Interface

### Authentication UI
- **Position**: Fixed top-right corner
- **Design**: Glassmorphism with backdrop blur
- **States**: Login buttons / User profile
- **Responsive**: Mobile-friendly design

### Layer Management UI
- **Position**: Fixed top-left corner
- **Features**: Search, filters, layer cards
- **Design**: Modern card-based layout
- **Responsive**: Collapsible on mobile

### Layer Cards
Each layer card displays:
- Title and description
- Tags with color coding
- Statistics (views, downloads)
- Star rating display
- Author information
- Action buttons (edit, delete, view, rate)

### Modals
- **Add Layer Modal**: Form for creating new layers
- **Upload Options Modal**: File upload or URL addition
- **Rating Modal**: Star rating interface

## 🚀 API Endpoints

### Authentication
```
POST /api/auth/google     - Google OAuth2 login
POST /api/auth/github     - GitHub OAuth2 login
POST /api/auth/linkedin   - LinkedIn OAuth2 login
GET  /api/auth/me         - Get current user info
GET  /api/auth/logout     - Logout endpoint
```

### Layer Management
```
GET    /api/layers              - Search and list layers
POST   /api/layers              - Create new layer
GET    /api/layers/{id}         - Get specific layer
PUT    /api/layers/{id}         - Update layer
DELETE /api/layers/{id}         - Delete layer
POST   /api/layers/{id}/rate    - Rate a layer
DELETE /api/layers/{id}/rate    - Remove rating
POST   /api/layers/{id}/upload  - Upload file for layer
POST   /api/layers/{id}/add-url - Add URL to layer
GET    /api/layers/categories   - Get categories
GET    /api/layers/licenses     - Get licenses
```

## 🔧 Setup Instructions

### 1. Database Setup
```bash
# Install dependencies
pip install -r requirements.txt

# Initialize database
python init_db.py
```

### 2. Environment Configuration
```bash
# Copy environment template
cp env.example .env

# Edit .env file with your credentials
nano .env
```

### 3. OAuth2 Setup

#### Google OAuth2
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth2 credentials
5. Add authorized redirect URIs
6. Copy Client ID and Secret to .env file

#### GitHub OAuth2
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create new OAuth App
3. Set callback URL
4. Copy Client ID and Secret to .env file

#### LinkedIn OAuth2
1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/)
2. Create new app
3. Configure OAuth2 settings
4. Copy Client ID and Secret to .env file

### 4. Start Application
```bash
# Start the server
python main.py

# Access the application
open http://localhost:5000
```

## 🎯 Usage Guide

### For Users

#### 1. Authentication
1. Click the authentication button in the top-right corner
2. Choose your preferred OAuth provider
3. Complete the OAuth flow
4. You're now logged in!

#### 2. Browsing Layers
1. Click "Layer Management" in the top-left corner
2. Use search and filters to find layers
3. Click on layer cards to view details
4. Rate layers you find useful

#### 3. Contributing Data
1. Click "Add Layer" button
2. Fill in layer metadata
3. Choose upload method:
   - **File Upload**: Select and upload a geospatial file
   - **URL Addition**: Provide a remote data URL
4. Your layer is now available!

#### 4. Managing Your Layers
- Edit layer metadata (title, description, tags)
- Upload new files or change URLs
- Set layer visibility (public/private)
- Delete layers you no longer need

### For Developers

#### Adding New OAuth Providers
1. Add provider configuration to `auth.py`
2. Create verification function
3. Add endpoint to `main.py`
4. Update frontend authentication UI

#### Extending Layer Types
1. Add new file format support in `layer_api.py`
2. Update processing functions
3. Add format validation
4. Update frontend file input

#### Custom Categories/Licenses
1. Add to database via `init_db.py`
2. Update frontend dropdowns
3. Add validation if needed

## 🔒 Security Features

### Authentication Security
- JWT token expiration (30 minutes)
- Secure token storage
- OAuth2 provider validation
- CSRF protection

### Data Security
- User permission checks
- Private layer protection
- File upload validation
- SQL injection prevention

### API Security
- Rate limiting
- Input validation
- Error handling
- CORS configuration

## 📊 Performance Features

### Database Optimization
- Indexed search fields
- Efficient queries
- Connection pooling
- Query optimization

### File Processing
- Asynchronous processing
- Progress tracking
- Error recovery
- Resource cleanup

### Frontend Performance
- Lazy loading
- Debounced search
- Efficient rendering
- Memory management

## 🐛 Troubleshooting

### Common Issues

#### Database Connection
```bash
# Check database status
sudo systemctl status postgresql

# Test connection
psql -h localhost -U postgres -d myearth
```

#### OAuth2 Issues
- Verify redirect URIs match exactly
- Check client ID/secret in .env
- Ensure OAuth provider is enabled
- Check browser console for errors

#### File Upload Issues
- Check file size limits
- Verify supported formats
- Check upload directory permissions
- Review server logs

#### Authentication Issues
- Clear browser localStorage
- Check JWT token expiration
- Verify OAuth provider status
- Check network connectivity

### Debug Mode
```bash
# Enable debug logging
export DEBUG=True
python main.py
```

## 📈 Future Enhancements

### Planned Features
- **Advanced Search**: Full-text search with Elasticsearch
- **Layer Collections**: Group related layers
- **Collaboration**: Shared workspaces
- **Versioning**: Layer version history
- **Analytics**: Usage statistics and insights
- **API Rate Limiting**: Per-user quotas
- **Webhooks**: Real-time notifications
- **Mobile App**: Native mobile application

### Technical Improvements
- **Caching**: Redis for performance
- **CDN**: Global content delivery
- **Microservices**: Service decomposition
- **Kubernetes**: Container orchestration
- **Monitoring**: Prometheus + Grafana
- **CI/CD**: Automated deployment

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests
5. Submit pull request

### Code Standards
- Follow PEP 8 for Python
- Use TypeScript for JavaScript
- Add docstrings and comments
- Write unit tests
- Update documentation

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

### Getting Help
- **Documentation**: Check this README
- **Issues**: GitHub Issues page
- **Discussions**: GitHub Discussions
- **Email**: support@myearth.app

### Community
- **Discord**: Join our community server
- **Twitter**: Follow for updates
- **Blog**: Technical articles and tutorials

---

**MyEarth.app** - Building the future of web GIS, one layer at a time! 🌍✨
