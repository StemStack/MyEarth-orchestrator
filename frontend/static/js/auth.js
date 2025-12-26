/**
 * Authentication module for MyEarth.app
 * Handles OAuth2 login, token management, and user state
 */

class AuthManager {
    constructor() {
        this.token = localStorage.getItem('myearth_token');
        this.user = JSON.parse(localStorage.getItem('myearth_user') || 'null');
        this.isAuthenticated = !!this.token;
        
        // Initialize OAuth providers
        this.initializeOAuth().then(() => {
            // Update UI based on auth state
            this.updateAuthUI();
        });
    }
    
    async initializeOAuth() {
        try {
            // Fetch OAuth configuration from backend
            const response = await fetch('/api/oauth-config');
            const config = await response.json();
            
            // Google OAuth2
            if (config.google_client_id && typeof google !== 'undefined' && google.accounts) {
                google.accounts.id.initialize({
                    client_id: config.google_client_id,
                    callback: this.handleGoogleSignIn.bind(this)
                });
            }
            
            // GitHub OAuth2
            this.githubClientId = config.github_client_id || '';
            
            // LinkedIn OAuth2
            this.linkedinClientId = config.linkedin_client_id || '';
            
            // Update UI based on OAuth availability
            this.updateOAuthUI(config.oauth_enabled);
        } catch (error) {
            console.error('Failed to load OAuth configuration:', error);
            this.updateOAuthUI(false);
        }
    }
    
    async handleGoogleSignIn(response) {
        try {
            const result = await this.authenticateWithProvider('google', response.credential);
            this.handleAuthSuccess(result);
        } catch (error) {
            console.error('Google sign-in failed:', error);
            this.showAuthError('Google sign-in failed');
        }
    }
    
    async handleGitHubSignIn() {
        if (!this.githubClientId) {
            this.showAuthError('GitHub OAuth not configured');
            return;
        }
        
        try {
            // Redirect to GitHub OAuth
            const githubUrl = `https://github.com/login/oauth/authorize?client_id=${this.githubClientId}&scope=user:email`;
            window.location.href = githubUrl;
        } catch (error) {
            console.error('GitHub sign-in failed:', error);
            this.showAuthError('GitHub sign-in failed');
        }
    }
    
    async handleLinkedInSignIn() {
        if (!this.linkedinClientId) {
            this.showAuthError('LinkedIn OAuth not configured');
            return;
        }
        
        try {
            // Redirect to LinkedIn OAuth
            const linkedinUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${this.linkedinClientId}&redirect_uri=${encodeURIComponent(window.location.origin + '/auth/linkedin/callback')}&scope=r_liteprofile%20r_emailaddress`;
            window.location.href = linkedinUrl;
        } catch (error) {
            console.error('LinkedIn sign-in failed:', error);
            this.showAuthError('LinkedIn sign-in failed');
        }
    }
    
    async authenticateWithProvider(provider, token) {
        const response = await fetch(`/api/auth/${provider}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `token=${encodeURIComponent(token)}`
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Authentication failed');
        }
        
        return await response.json();
    }
    
    handleAuthSuccess(result) {
        this.token = result.access_token;
        this.user = result.user;
        this.isAuthenticated = true;
        
        // Store in localStorage
        localStorage.setItem('myearth_token', this.token);
        localStorage.setItem('myearth_user', JSON.stringify(this.user));
        
        // Update UI
        this.updateAuthUI();
        
        // Show success message
        this.showAuthSuccess(`Welcome, ${this.user.full_name || this.user.username}!`);
        
        // Trigger auth change event
        this.triggerAuthChange();
    }
    
    async logout() {
        try {
            // Call logout endpoint
            await fetch('/api/auth/logout', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
        } catch (error) {
            console.warn('Logout request failed:', error);
        }
        
        // Clear local state
        this.token = null;
        this.user = null;
        this.isAuthenticated = false;
        
        // Clear localStorage
        localStorage.removeItem('myearth_token');
        localStorage.removeItem('myearth_user');
        
        // Update UI
        this.updateAuthUI();
        
        // Show logout message
        this.showAuthSuccess('Logged out successfully');
        
        // Trigger auth change event
        this.triggerAuthChange();
    }
    
    async getCurrentUser() {
        if (!this.token) return null;
        
        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (response.ok) {
                const user = await response.json();
                this.user = user;
                localStorage.setItem('myearth_user', JSON.stringify(user));
                return user;
            } else {
                // Token is invalid, logout
                this.logout();
                return null;
            }
        } catch (error) {
            console.error('Failed to get current user:', error);
            return null;
        }
    }
    
    updateAuthUI() {
        const userInfo = document.getElementById('userInfo');
        const loginButtons = document.getElementById('loginButtons');
        const loginTool = document.getElementById('loginTool');
        
        if (this.isAuthenticated && this.user) {
            // Show user info
            if (userInfo) {
                userInfo.innerHTML = `
                    <div class="user-profile">
                        <img src="${this.user.avatar_url || '/static/images/default-avatar.png'}" 
                             alt="${this.user.full_name || this.user.username}" 
                             class="user-avatar">
                        <div class="user-details">
                            <div class="user-name">${this.user.full_name || this.user.username}</div>
                            <div class="user-email">${this.user.email}</div>
                        </div>
                        <button onclick="authManager.logout()" class="logout-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16,17 21,12 16,7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                        </button>
                    </div>
                `;
                userInfo.style.display = 'block';
            }
            
            if (loginButtons) {
                loginButtons.style.display = 'none';
            }
            
            // Update login tool icon
            if (loginTool) {
                loginTool.classList.add('authenticated');
                loginTool.title = `Logged in as ${this.user.full_name || this.user.username}`;
            }
            
            // Show authenticated features
            this.showAuthenticatedFeatures();
            
        } else {
            // Show login buttons
            if (userInfo) {
                userInfo.style.display = 'none';
            }
            
            if (loginButtons) {
                loginButtons.innerHTML = `
                    <div class="section-header">Sign-in</div>
                    <button onclick="authManager.handleGoogleSignIn()" class="auth-btn google-btn" title="Sign in with Google">
                        <svg viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                    </button>
                    <button onclick="authManager.handleGitHubSignIn()" class="auth-btn github-btn" title="Sign in with GitHub">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                    </button>
                    <button onclick="authManager.handleLinkedInSignIn()" class="auth-btn linkedin-btn" title="Sign in with LinkedIn">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                    </button>
                `;
                loginButtons.style.display = 'block';
            }
            
            // Update login tool icon
            if (loginTool) {
                loginTool.classList.remove('authenticated');
                loginTool.title = 'Account';
            }
            
            // Hide authenticated features
            this.hideAuthenticatedFeatures();
        }
    }
    
    updateOAuthUI(oauthEnabled) {
        const loginButtons = document.getElementById('loginButtons');
        const loginTool = document.getElementById('loginTool');
        
        if (!oauthEnabled) {
            // Hide OAuth buttons if not configured
            if (loginButtons) {
                loginButtons.innerHTML = `
                    <div class="section-header">Sign-in</div>
                    <div class="oauth-disabled">
                        <p>OAuth not configured</p>
                        <small>Contact administrator to enable sign-in</small>
                    </div>
                `;
            }
            
            if (loginTool) {
                loginTool.style.opacity = '0.5';
                loginTool.title = 'Sign-in not available';
            }
        } else {
            // OAuth is enabled, buttons will be shown in updateAuthUI
            if (loginTool) {
                loginTool.style.opacity = '1';
                loginTool.title = 'Account';
            }
        }
    }
    
    showAuthenticatedFeatures() {
        // Show layer management buttons
        const layerManagementBtn = document.getElementById('layerManagementBtn');
        if (layerManagementBtn) {
            layerManagementBtn.style.display = 'block';
        }
        
        // Show user-specific content
        const userContent = document.querySelectorAll('.user-only');
        userContent.forEach(element => {
            element.style.display = 'block';
        });
    }
    
    hideAuthenticatedFeatures() {
        // Hide layer management buttons
        const layerManagementBtn = document.getElementById('layerManagementBtn');
        if (layerManagementBtn) {
            layerManagementBtn.style.display = 'none';
        }
        
        // Hide user-specific content
        const userContent = document.querySelectorAll('.user-only');
        userContent.forEach(element => {
            element.style.display = 'none';
        });
    }
    
    showAuthSuccess(message) {
        // Show success message (you can customize this)
        console.log('Auth success:', message);
        // You can implement a toast notification system here
    }
    
    showAuthError(message) {
        // Show error message (you can customize this)
        console.error('Auth error:', message);
        // You can implement a toast notification system here
    }
    
    triggerAuthChange() {
        // Dispatch custom event for other components to listen to
        const event = new CustomEvent('authChange', {
            detail: {
                isAuthenticated: this.isAuthenticated,
                user: this.user
            }
        });
        document.dispatchEvent(event);
    }
    
    // Helper method to get auth headers for API requests
    getAuthHeaders() {
        if (this.token) {
            return {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            };
        }
        return {
            'Content-Type': 'application/json'
        };
    }
}

// Initialize auth manager when DOM is loaded
let authManager;
document.addEventListener('DOMContentLoaded', () => {
    authManager = new AuthManager();
    
    // Check if user is still valid
    if (authManager.isAuthenticated) {
        authManager.getCurrentUser();
    }
});

// Export for use in other modules
window.authManager = authManager;
