/**
 * Layer Management module for MyEarth.app
 * Handles layer search, CRUD operations, ratings, and file uploads
 */

class LayerManager {
    constructor() {
        this.currentLayers = [];
        this.categories = [];
        this.licenses = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.searchFilters = {
            query: '',
            category: '',
            license: '',
            tags: '',
            min_rating: null,
            sort_by: 'created_at',
            sort_order: 'desc'
        };
        
        this.initializeEventListeners();
        this.loadCategoriesAndLicenses();
    }
    
    initializeEventListeners() {
        // Listen for auth changes
        document.addEventListener('authChange', (event) => {
            if (event.detail.isAuthenticated) {
                this.showLayerManagement();
                this.loadLayers();
            } else {
                this.hideLayerManagement();
            }
        });
        
        // Search and filter events
        document.addEventListener('DOMContentLoaded', () => {
            this.setupSearchAndFilters();
            this.setupLayerActions();
        });
    }
    
    setupSearchAndFilters() {
        // Search input
        const searchInput = document.getElementById('layerSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchFilters.query = e.target.value;
                this.currentPage = 1;
                this.loadLayers();
            });
        }
        
        // Category filter
        const categorySelect = document.getElementById('categoryFilter');
        if (categorySelect) {
            categorySelect.addEventListener('change', (e) => {
                this.searchFilters.category = e.target.value;
                this.currentPage = 1;
                this.loadLayers();
            });
        }
        
        // License filter
        const licenseSelect = document.getElementById('licenseFilter');
        if (licenseSelect) {
            licenseSelect.addEventListener('change', (e) => {
                this.searchFilters.license = e.target.value;
                this.currentPage = 1;
                this.loadLayers();
            });
        }
        
        // Sort options
        const sortSelect = document.getElementById('sortBy');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.searchFilters.sort_by = e.target.value;
                this.currentPage = 1;
                this.loadLayers();
            });
        }
    }
    
    setupLayerActions() {
        // Add layer button
        const addLayerBtn = document.getElementById('addLayerBtn');
        if (addLayerBtn) {
            addLayerBtn.addEventListener('click', () => {
                this.showAddLayerModal();
            });
        }
        
        // Upload file button
        const uploadFileBtn = document.getElementById('uploadFileBtn');
        if (uploadFileBtn) {
            uploadFileBtn.addEventListener('click', () => {
                this.showUploadModal();
            });
        }
    }
    
    async loadCategoriesAndLicenses() {
        try {
            // Load categories
            const categoriesResponse = await fetch('/api/layers/categories');
            if (categoriesResponse.ok) {
                this.categories = await categoriesResponse.json();
                this.populateCategoryOptions();
            }
            
            // Load licenses
            const licensesResponse = await fetch('/api/layers/licenses');
            if (licensesResponse.ok) {
                this.licenses = await licensesResponse.json();
                this.populateLicenseOptions();
            }
        } catch (error) {
            console.error('Failed to load categories and licenses:', error);
        }
    }
    
    populateCategoryOptions() {
        const categorySelect = document.getElementById('categoryFilter');
        const categoryOptions = document.getElementById('categoryOptions');
        
        if (categorySelect) {
            categorySelect.innerHTML = '<option value="">All Categories</option>';
            this.categories.forEach(category => {
                categorySelect.innerHTML += `<option value="${category.name}">${category.name}</option>`;
            });
        }
        
        if (categoryOptions) {
            categoryOptions.innerHTML = '<option value="general">General</option>';
            this.categories.forEach(category => {
                categoryOptions.innerHTML += `<option value="${category.name}">${category.name}</option>`;
            });
        }
    }
    
    populateLicenseOptions() {
        const licenseSelect = document.getElementById('licenseFilter');
        const licenseOptions = document.getElementById('licenseOptions');
        
        if (licenseSelect) {
            licenseSelect.innerHTML = '<option value="">All Licenses</option>';
            this.licenses.forEach(license => {
                licenseSelect.innerHTML += `<option value="${license.name}">${license.name}</option>`;
            });
        }
        
        if (licenseOptions) {
            licenseOptions.innerHTML = '<option value="CC BY 4.0">CC BY 4.0</option>';
            this.licenses.forEach(license => {
                licenseOptions.innerHTML += `<option value="${license.name}">${license.name}</option>`;
            });
        }
    }
    
    async loadLayers() {
        if (!authManager.isAuthenticated) return;
        
        try {
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: 20,
                ...this.searchFilters
            });
            
            const response = await fetch(`/api/layers?${params}`, {
                headers: authManager.getAuthHeaders()
            });
            
            if (response.ok) {
                const layers = await response.json();
                this.currentLayers = layers;
                this.renderLayers();
            } else {
                console.error('Failed to load layers');
            }
        } catch (error) {
            console.error('Error loading layers:', error);
        }
    }
    
    renderLayers() {
        const layersContainer = document.getElementById('layersContainer');
        if (!layersContainer) return;
        
        if (this.currentLayers.length === 0) {
            layersContainer.innerHTML = `
                <div class="no-layers">
                    <p>No layers found. Create your first layer to get started!</p>
                    <button onclick="layerManager.showAddLayerModal()" class="btn-primary">Add Layer</button>
                </div>
            `;
            return;
        }
        
        layersContainer.innerHTML = this.currentLayers.map(layer => this.renderLayerCard(layer)).join('');
    }
    
    renderLayerCard(layer) {
        const stars = this.renderStars(layer.average_rating);
        const tags = layer.tags.map(tag => `<span class="tag">${tag}</span>`).join('');
        const isOwner = authManager.user && layer.user.id === authManager.user.id;
        
        return `
            <div class="layer-card" data-layer-id="${layer.id}">
                <div class="layer-header">
                    <h3 class="layer-title">${layer.title}</h3>
                    <div class="layer-actions">
                        ${isOwner ? `
                            <button onclick="layerManager.editLayer('${layer.id}')" class="btn-icon" title="Edit">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                            <button onclick="layerManager.deleteLayer('${layer.id}')" class="btn-icon" title="Delete">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3,6 5,6 21,6"></polyline>
                                    <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                                </svg>
                            </button>
                        ` : ''}
                        <button onclick="layerManager.viewLayer('${layer.id}')" class="btn-icon" title="View">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                    </div>
                </div>
                
                <div class="layer-content">
                    <p class="layer-description">${layer.description || 'No description available'}</p>
                    <div class="layer-tags">${tags}</div>
                    
                    <div class="layer-meta">
                        <div class="layer-stats">
                            <span class="stat">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                                ${layer.view_count} views
                            </span>
                            <span class="stat">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"></polygon>
                                </svg>
                                ${layer.download_count} downloads
                            </span>
                        </div>
                        
                        <div class="layer-rating">
                            <div class="stars">${stars}</div>
                            <span class="rating-count">(${layer.rating_count} ratings)</span>
                        </div>
                    </div>
                    
                    <div class="layer-author">
                        <img src="${layer.user.avatar_url || '/static/images/default-avatar.png'}" 
                             alt="${layer.user.full_name || layer.user.username}" 
                             class="author-avatar">
                        <span class="author-name">${layer.user.full_name || layer.user.username}</span>
                        <span class="layer-date">${new Date(layer.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
                
                <div class="layer-footer">
                    <button onclick="layerManager.rateLayer('${layer.id}')" class="btn-secondary">
                        Rate this layer
                    </button>
                    <button onclick="layerManager.addToMap('${layer.id}')" class="btn-primary">
                        Add to Map
                    </button>
                </div>
            </div>
        `;
    }
    
    renderStars(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        
        let stars = '';
        for (let i = 0; i < fullStars; i++) {
            stars += '<span class="star filled">★</span>';
        }
        if (hasHalfStar) {
            stars += '<span class="star half">☆</span>';
        }
        for (let i = 0; i < emptyStars; i++) {
            stars += '<span class="star">☆</span>';
        }
        
        return stars;
    }
    
    showAddLayerModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Add New Layer</h2>
                    <button onclick="this.closest('.modal').remove()" class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="addLayerForm">
                        <div class="form-group">
                            <label for="layerTitle">Title *</label>
                            <input type="text" id="layerTitle" required>
                        </div>
                        <div class="form-group">
                            <label for="layerDescription">Description</label>
                            <textarea id="layerDescription" rows="3"></textarea>
                        </div>
                        <div class="form-group">
                            <label for="layerTags">Tags (comma-separated)</label>
                            <input type="text" id="layerTags" placeholder="biodiversity, climate, agriculture">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="categoryOptions">Category</label>
                                <select id="categoryOptions">
                                    <option value="general">General</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="licenseOptions">License</label>
                                <select id="licenseOptions">
                                    <option value="CC BY 4.0">CC BY 4.0</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="isPublic" checked>
                                Make this layer public
                            </label>
                        </div>
                        <div class="form-actions">
                            <button type="button" onclick="this.closest('.modal').remove()" class="btn-secondary">Cancel</button>
                            <button type="submit" class="btn-primary">Create Layer</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Populate options
        this.populateCategoryOptions();
        this.populateLicenseOptions();
        
        // Handle form submission
        const form = modal.querySelector('#addLayerForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.createLayer(form);
        });
    }
    
    async createLayer(form) {
        const formData = {
            title: form.querySelector('#layerTitle').value,
            description: form.querySelector('#layerDescription').value,
            tags: form.querySelector('#layerTags').value.split(',').map(tag => tag.trim()).filter(tag => tag),
            category: form.querySelector('#categoryOptions').value,
            license: form.querySelector('#licenseOptions').value,
            is_public: form.querySelector('#isPublic').checked
        };
        
        try {
            const response = await fetch('/api/layers', {
                method: 'POST',
                headers: authManager.getAuthHeaders(),
                body: JSON.stringify(formData)
            });
            
            if (response.ok) {
                const layer = await response.json();
                form.closest('.modal').remove();
                this.showSuccess('Layer created successfully!');
                this.loadLayers();
                
                // Show upload options
                this.showUploadOptions(layer.id);
            } else {
                const error = await response.json();
                this.showError(error.detail || 'Failed to create layer');
            }
        } catch (error) {
            console.error('Error creating layer:', error);
            this.showError('Failed to create layer');
        }
    }
    
    showUploadOptions(layerId) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Add Data to Layer</h2>
                    <button onclick="this.closest('.modal').remove()" class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="upload-options">
                        <div class="upload-option">
                            <h3>Upload File</h3>
                            <p>Upload a geospatial file (.geojson, .shp, .gpkg, .kml)</p>
                            <input type="file" id="layerFile" accept=".geojson,.shp,.gpkg,.kml,.kmz,.zip">
                            <button onclick="layerManager.uploadFile('${layerId}')" class="btn-primary">Upload File</button>
                        </div>
                        
                        <div class="upload-option">
                            <h3>Add via URL</h3>
                            <p>Add a layer from a remote URL (WMS, TileJSON, GeoJSON)</p>
                            <input type="url" id="layerUrl" placeholder="https://example.com/layer.geojson">
                            <button onclick="layerManager.addLayerUrl('${layerId}')" class="btn-primary">Add URL</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    async uploadFile(layerId) {
        const fileInput = document.getElementById('layerFile');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showError('Please select a file');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await fetch(`/api/layers/${layerId}/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authManager.token}`
                },
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                this.showSuccess('File uploaded successfully!');
                this.loadLayers();
                document.querySelector('.modal').remove();
            } else {
                const error = await response.json();
                this.showError(error.detail || 'Failed to upload file');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            this.showError('Failed to upload file');
        }
    }
    
    async addLayerUrl(layerId) {
        const urlInput = document.getElementById('layerUrl');
        const url = urlInput.value.trim();
        
        if (!url) {
            this.showError('Please enter a URL');
            return;
        }
        
        try {
            const response = await fetch(`/api/layers/${layerId}/add-url`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authManager.token}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `url=${encodeURIComponent(url)}`
            });
            
            if (response.ok) {
                const result = await response.json();
                this.showSuccess('URL added successfully!');
                this.loadLayers();
                document.querySelector('.modal').remove();
            } else {
                const error = await response.json();
                this.showError(error.detail || 'Failed to add URL');
            }
        } catch (error) {
            console.error('Error adding URL:', error);
            this.showError('Failed to add URL');
        }
    }
    
    async rateLayer(layerId) {
        const rating = prompt('Rate this layer (1-5 stars):');
        if (!rating || isNaN(rating) || rating < 1 || rating > 5) {
            this.showError('Please enter a valid rating between 1 and 5');
            return;
        }
        
        try {
            const response = await fetch(`/api/layers/${layerId}/rate`, {
                method: 'POST',
                headers: authManager.getAuthHeaders(),
                body: JSON.stringify({
                    rating: parseInt(rating),
                    comment: ''
                })
            });
            
            if (response.ok) {
                this.showSuccess('Rating saved successfully!');
                this.loadLayers();
            } else {
                const error = await response.json();
                this.showError(error.detail || 'Failed to save rating');
            }
        } catch (error) {
            console.error('Error rating layer:', error);
            this.showError('Failed to save rating');
        }
    }
    
    async deleteLayer(layerId) {
        if (!confirm('Are you sure you want to delete this layer? This action cannot be undone.')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/layers/${layerId}`, {
                method: 'DELETE',
                headers: authManager.getAuthHeaders()
            });
            
            if (response.ok) {
                this.showSuccess('Layer deleted successfully!');
                this.loadLayers();
            } else {
                const error = await response.json();
                this.showError(error.detail || 'Failed to delete layer');
            }
        } catch (error) {
            console.error('Error deleting layer:', error);
            this.showError('Failed to delete layer');
        }
    }
    
    addToMap(layerId) {
        // This would integrate with your existing Cesium viewer
        // You can implement this based on your current map system
        console.log('Adding layer to map:', layerId);
        this.showSuccess('Layer added to map!');
    }
    
    showLayerManagement() {
        const layerManagement = document.getElementById('layerManagement');
        if (layerManagement) {
            layerManagement.style.display = 'block';
        }
    }
    
    hideLayerManagement() {
        const layerManagement = document.getElementById('layerManagement');
        if (layerManagement) {
            layerManagement.style.display = 'none';
        }
    }
    
    toggleLayerManagement() {
        const layerManagement = document.getElementById('layerManagement');
        if (layerManagement) {
            if (layerManagement.style.display === 'none' || layerManagement.style.display === '') {
                layerManagement.style.display = 'block';
            } else {
                layerManagement.style.display = 'none';
            }
        }
    }
    
    showSuccess(message) {
        // Implement toast notification
        console.log('Success:', message);
    }
    
    showError(message) {
        // Implement toast notification
        console.error('Error:', message);
    }
}

// Initialize layer manager when DOM is loaded
let layerManager;
document.addEventListener('DOMContentLoaded', () => {
    layerManager = new LayerManager();
});

// Export for use in other modules
window.layerManager = layerManager;

// Global function for layer management toggle
window.toggleLayerManagement = function() {
    if (layerManager) {
        layerManager.toggleLayerManagement();
    }
};
