// Buildings3DController: OSM buildings via Overpass with extrusion and opacity control
// Global export: window.Buildings3DController

(function () {
	const CONTROLLER_NAME = 'osm-buildings';
	const DEBOUNCE_MS = 600;
	const MAX_VIEW_DEG = 1.0; // Increased to allow larger areas for tilted camera views
	const MAX_FEATURES = 20000; // Doubled from 10000 for better coverage
	const DEFAULT_OPACITY = 0.8;
	const COLOR_HEX = '#ff4444'; // Bright red for visibility

	let cesium = window.Cesium;
	let viewer = null;
	let enabled = false;
	let currentOpacity = DEFAULT_OPACITY;
	let debounceTimer = null;
	let currentDataSource = null;
	let currentAbortController = null;
	let cache = new Map(); // key: bbox string (rounded) -> geojson
	let osm2geoPromise = null; // legacy; not used now

	function ensureToastUI() {
		if (document.getElementById('toast-container')) return;
		const style = document.createElement('style');
		style.textContent = `
			#toast-container { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 9999; display: flex; flex-direction: column; gap: 8px; }
			.toast { background: rgba(30,30,30,0.9); color: #fff; padding: 10px 14px; border-radius: 6px; font-size: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.3); display: inline-flex; align-items: center; gap: 10px; }
			.toast button { background: #4a90e2; color: #fff; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px; }
		`;
		document.head.appendChild(style);
		const container = document.createElement('div');
		container.id = 'toast-container';
		document.body.appendChild(container);
	}

	function showToast(message, options = {}) {
		ensureToastUI();
		const { actionText, onAction, duration = 4000 } = options;
		const el = document.createElement('div');
		el.className = 'toast';
		el.textContent = message;
		if (actionText && typeof onAction === 'function') {
			const btn = document.createElement('button');
			btn.textContent = actionText;
			btn.onclick = () => { try { onAction(); } finally { el.remove(); } };
			el.appendChild(btn);
		}
		document.getElementById('toast-container').appendChild(el);
		setTimeout(() => { el.remove(); }, duration);
	}

	function roundBBox(bbox) {
		// bbox: [south, west, north, east]
		return [bbox[0], bbox[1], bbox[2], bbox[3]].map(v => Number(v).toFixed(4)).join(',');
	}

	function computeViewBBox() {
		// Use a more comprehensive approach to get the full visible area
		let rect = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
		
		// If computeViewRectangle fails, fall back to camera position and frustum
		if (!rect) {
			const camera = viewer.camera;
			const position = camera.position;
			const cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(position);
			const height = cartographic.height;
			
			// Calculate a reasonable view area based on camera height and field of view
			const fovy = camera.frustum.fovy;
			const aspect = camera.frustum.aspectRatio;
			
			// Convert to degrees and create a padded bbox
			const lat = cesium.Math.toDegrees(cartographic.latitude);
			const lon = cesium.Math.toDegrees(cartographic.longitude);
			
			// Calculate view dimensions based on height and FOV
			const latSpan = Math.atan(Math.tan(fovy / 2) * height / 6371000) * 2; // Earth radius approximation
			const lonSpan = latSpan * aspect;
			
			const latDegrees = cesium.Math.toDegrees(latSpan);
			const lonDegrees = cesium.Math.toDegrees(lonSpan);
			
			// Add padding to ensure full coverage
			const padding = 1.5; // 50% padding
			rect = {
				west: lon - (lonDegrees * padding),
				south: lat - (latDegrees * padding),
				east: lon + (lonDegrees * padding),
				north: lat + (latDegrees * padding)
			};
		}
		
		const west = cesium.Math.toDegrees(rect.west);
		const south = cesium.Math.toDegrees(rect.south);
		const east = cesium.Math.toDegrees(rect.east);
		const north = cesium.Math.toDegrees(rect.north);
		
		// Add extra padding to ensure buildings at edges are included
		const padding = 0.001; // Small padding in degrees
		return [
			south - padding,
			west - padding,
			north + padding,
			east + padding
		];
	}
	
	// Smart bbox calculation based on camera orientation
	function computePrioritizedBBox(isLargeArea = false) {
		const camera = viewer.camera;
		const position = camera.position;
		const direction = camera.direction;
		const cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(position);
		
		// Get camera's current position
		const lat = cesium.Math.toDegrees(cartographic.latitude);
		const lon = cesium.Math.toDegrees(cartographic.longitude);
		const height = cartographic.height;
		const heading = camera.heading; // 0 = north, π/2 = east
		const pitch = camera.pitch; // 0 = horizon, -π/2 = straight down
		
		// Determine if view is orthogonal (looking down) or tilted
		const isOrthogonal = pitch < -cesium.Math.PI_OVER_FOUR; // Less than -45°
		
		// Calculate base span based on height
		let baseSpan = Math.max(0.005, Math.min(0.3, height / 2000000));
		
		// If area is too large, reduce the span
		if (isLargeArea) {
			baseSpan = Math.min(baseSpan, 0.05); // Max 0.05° for large areas
		}
		
		const fovy = camera.frustum.fovy;
		const aspect = camera.frustum.aspectRatio;
		
		if (isOrthogonal) {
			// Orthogonal view: prioritize center of camera view
			const latSpan = baseSpan;
			const lonSpan = baseSpan * aspect;
			
			return [
				lat - (latSpan / 2),
				lon - (lonSpan / 2), 
				lat + (latSpan / 2),
				lon + (lonSpan / 2)
			];
		} else {
			// Tilted view: prioritize foreground
			const latSpan = baseSpan * 1.2; // Slightly wider for tilted view
			const lonSpan = baseSpan * aspect;
			
			// Calculate forward direction based on heading
			const forwardLatOffset = Math.cos(heading) * baseSpan * 0.8;
			const forwardLonOffset = Math.sin(heading) * baseSpan * 0.8;
			
			// Shift bbox toward foreground (forward direction)
			const centerLat = lat + (forwardLatOffset * 0.7); // 70% forward
			const centerLon = lon + (forwardLonOffset * 0.7);
			
			return [
				centerLat - (latSpan / 2),
				centerLon - (lonSpan / 2),
				centerLat + (latSpan / 2),
				centerLon + (lonSpan / 2)
			];
		}
	}

	function bboxTooLarge(bbox) {
		const width = Math.abs(bbox[3] - bbox[1]);
		const height = Math.abs(bbox[2] - bbox[0]);
		const tooLarge = width > MAX_VIEW_DEG || height > MAX_VIEW_DEG;
		try { console.log('Buildings3D: bbox check', { width: width.toFixed(3), height: height.toFixed(3), max: MAX_VIEW_DEG, tooLarge }); } catch(e) {}
		return tooLarge;
	}

	const OVERPASS_ENDPOINTS = [
		'https://overpass-api.de/api/interpreter',
		'https://overpass.kumi.systems/api/interpreter',
		'https://overpass.osm.ch/api/interpreter'
	];

	function buildOverpassQuery(bbox) {
		const bboxStr = `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}`; // south,west,north,east
		// Simplified query: just basic building ways with geometry
		return `[out:json][timeout:25];way["building"](${bboxStr});out body geom qt;`;
	}

	function overpassUrl(endpoint, bbox) {
		return `${endpoint}?data=${encodeURIComponent(buildOverpassQuery(bbox))}`;
	}

	function determineHeight(tags) {
		if (!tags) return 10;
		if (tags.height) {
			const h = parseFloat(String(tags.height).replace('m', '').trim());
			if (!isNaN(h) && h > 0) return h;
		}
		if (tags['building:levels']) {
			const lv = parseInt(tags['building:levels'], 10);
			if (!isNaN(lv) && lv > 0) return lv * 3;
		}
		return 10;
	}

	function loadOsmToGeoJson() { return Promise.resolve(); }

	function parseOverpassToGeoJSON_viaLib(osmJson) {
		// Minimal converter: only ways with geometry become Polygons
		const features = [];
		const els = Array.isArray(osmJson?.elements) ? osmJson.elements : [];
		for (const el of els) {
			if (el.type !== 'way') continue;
			if (!el.tags || !el.tags.building) continue;
			const g = Array.isArray(el.geometry) ? el.geometry : null;
			if (!g || g.length < 3) continue;
			const ring = g.map(n => [Number(n.lon), Number(n.lat)]).filter(c => !isNaN(c[0]) && !isNaN(c[1]));
			if (ring.length < 3) continue;
			const first = ring[0]; const last = ring[ring.length - 1];
			if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
			features.push({ type: 'Feature', properties: { ...el.tags, height: determineHeight(el.tags) }, geometry: { type: 'Polygon', coordinates: [ring] } });
		}
		try { console.log('Buildings3D: Minimal conversion → features', features.length); } catch (e) {}
		return { type: 'FeatureCollection', features };
	}

	async function _loadForView() {
		if (!enabled) return;

		// Clear any existing buildings first
		if (currentDataSource) {
			try { viewer.dataSources.remove(currentDataSource, true); } catch(e) {}
			currentDataSource = null;
		}

		// Try primary method first (full camera view)
		let bbox = computeViewBBox();
		let usingPrioritized = false;
		
		if (!bbox || bboxTooLarge(bbox)) {
			// Primary method failed or area too large - use prioritized approach
			try { console.log('Buildings3D: Using prioritized bbox (camera-focused)'); } catch(e) {}
			bbox = computePrioritizedBBox(bbox && bboxTooLarge(bbox));
			usingPrioritized = true;
			
			if (!bbox) { 
				try { console.log('Buildings3D: No bbox computed'); } catch(e) {} 
				return; // Don't show error message, just return silently
			}
		}
		
		try { 
			console.log('Buildings3D: Computed bbox', bbox, usingPrioritized ? '(prioritized)' : '(full view)'); 
		} catch(e) {}
		const key = roundBBox(bbox);
		try { console.log('Buildings3D: Cache key', key); } catch(e) {}
		if (currentAbortController) { try { currentAbortController.abort(); } catch(e) {} }
		currentAbortController = new AbortController();
		const { signal } = currentAbortController;

		let geojson = cache.get(key);
		if (!geojson) {
			await loadOsmToGeoJson();
			for (const ep of OVERPASS_ENDPOINTS) {
				const url = overpassUrl(ep, bbox);
				try { console.log('Buildings3D: Trying endpoint', ep); } catch(e) {}
				try {
					const res = await fetch(url, { signal });
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					const osmJson = await res.json();
					try { console.log('Buildings3D: Raw OSM response', { elements: (osmJson && osmJson.elements) ? osmJson.elements.length : 0 }); } catch(e) {}
					const gj = parseOverpassToGeoJSON_viaLib(osmJson);
					try { console.log('Buildings3D: Converted to GeoJSON', { features: (gj && gj.features) ? gj.features.length : 0 }); } catch(e) {}
					if (gj.features && gj.features.length) { geojson = gj; break; }
				} catch (err) {
					if (err.name === 'AbortError') return;
					try { console.error('Buildings3D: Endpoint failed', ep, err); } catch(e2) {}
				}
			}
			if (!geojson) { 
				try { console.log('Buildings3D: Network error, trying prioritized bbox'); } catch(e) {}
				// Instead of showing error, try with prioritized bbox
				if (!usingPrioritized) {
					const prioritizedBbox = computePrioritizedBBox(true);
					const prioritizedKey = roundBBox(prioritizedBbox);
					let prioritizedGeojson = cache.get(prioritizedKey);
					if (!prioritizedGeojson) {
						// Try again with smaller area
						for (const ep of OVERPASS_ENDPOINTS) {
							const url = overpassUrl(ep, prioritizedBbox);
							try {
								const res = await fetch(url, { signal });
								if (!res.ok) throw new Error(`HTTP ${res.status}`);
								const osmJson = await res.json();
								const gj = parseOverpassToGeoJSON_viaLib(osmJson);
								if (gj.features && gj.features.length) { prioritizedGeojson = gj; break; }
							} catch (err) {
								if (err.name === 'AbortError') return;
							}
						}
						if (prioritizedGeojson) cache.set(prioritizedKey, prioritizedGeojson);
					}
					if (prioritizedGeojson) geojson = prioritizedGeojson;
				}
				if (!geojson) return; // Silent return, no error message
			}
			
			// If too many features, try prioritized approach instead of showing error
			if (geojson.features.length > MAX_FEATURES) { 
				try { console.log('Buildings3D: Too many features (' + geojson.features.length + '), using prioritized bbox'); } catch(e) {}
				if (!usingPrioritized) {
					const prioritizedBbox = computePrioritizedBBox(true);
					const prioritizedKey = roundBBox(prioritizedBbox);
					let prioritizedGeojson = cache.get(prioritizedKey);
					if (!prioritizedGeojson) {
						// Try again with smaller prioritized area
						for (const ep of OVERPASS_ENDPOINTS) {
							const url = overpassUrl(ep, prioritizedBbox);
							try {
								const res = await fetch(url, { signal });
								if (!res.ok) throw new Error(`HTTP ${res.status}`);
								const osmJson = await res.json();
								const gj = parseOverpassToGeoJSON_viaLib(osmJson);
								if (gj.features && gj.features.length <= MAX_FEATURES) { 
									prioritizedGeojson = gj; 
									break; 
								}
							} catch (err) {
								if (err.name === 'AbortError') return;
							}
						}
						if (prioritizedGeojson) cache.set(prioritizedKey, prioritizedGeojson);
					}
					if (prioritizedGeojson && prioritizedGeojson.features.length <= MAX_FEATURES) {
						geojson = prioritizedGeojson;
						try { console.log('Buildings3D: Using prioritized data with', geojson.features.length, 'features'); } catch(e) {}
					} else {
						// Still too many or no data, return silently
						return;
					}
				} else {
					// Already using prioritized and still too many, return silently
					return;
				}
			}
			cache.set(key, geojson);
		}

		try {
			const ds = new cesium.CustomDataSource(CONTROLLER_NAME);
			currentDataSource = ds;
			await viewer.dataSources.add(ds);
			let created = 0;
			const materialColor = cesium.Color.fromCssColorString(COLOR_HEX).withAlpha(currentOpacity);

			function addPolygonEntity(coords, height) {
				if (!coords || coords.length === 0) return;
				try {
					const outer = coords[0];
					if (!outer || outer.length < 3) return;
					
					// Validate coordinates
					const validOuter = outer.filter(c => Array.isArray(c) && c.length >= 2 && !isNaN(c[0]) && !isNaN(c[1]));
					if (validOuter.length < 3) return;
					
					const outerPositions = validOuter.map(c => cesium.Cartesian3.fromDegrees(c[0], c[1], 0));
					
					// Handle holes (simplified for now)
					const hierarchy = new cesium.PolygonHierarchy(outerPositions);
					
					ds.entities.add({
						polygon: {
							hierarchy,
							height: 0,
							heightReference: cesium.HeightReference.CLAMP_TO_GROUND,
							extrudedHeight: height,
							extrudedHeightReference: cesium.HeightReference.RELATIVE_TO_GROUND,
							material: materialColor,
							outline: true,
							outlineColor: cesium.Color.YELLOW,
							outlineWidth: 3
						}
					});
					created++;
				} catch (err) {
					try { console.warn('Buildings3D: Failed to add polygon', err); } catch(e) {}
				}
			}

			for (const feature of geojson.features) {
				const height = feature.properties?.height || 10;
				const geom = feature.geometry;
				if (!geom) continue;
				if (geom.type === 'Polygon') {
					addPolygonEntity(geom.coordinates, height);
				} else if (geom.type === 'MultiPolygon') {
					for (const part of geom.coordinates) addPolygonEntity(part, height);
				}
			}
			try { console.log('Buildings3D: Created entities', created); } catch(e) {}
			viewer.scene.requestRender();
			// Update active layers display after loading buildings
			this.updateActiveLayersDisplay();
		} catch (e) {
			if (e.name === 'AbortError') return;
			try { console.error('Buildings3D: Render error', e); } catch(e2) {}
			// Silent return instead of showing error message
		}
	}

	function debouncedLoad() { if (!enabled) return; if (debounceTimer) clearTimeout(debounceTimer); debounceTimer = setTimeout(_loadForView, DEBOUNCE_MS); }
	function onMoveEnd() { debouncedLoad(); }
	function attachCameraListener() { viewer.camera.moveEnd.addEventListener(onMoveEnd); }
	function detachCameraListener() { try { viewer.camera.moveEnd.removeEventListener(onMoveEnd); } catch(e) {} }
	function applyOpacity() { if (!currentDataSource) return; const color = cesium.Color.fromCssColorString(COLOR_HEX).withAlpha(currentOpacity); currentDataSource.entities.values.forEach(e => { if (e.polygon) e.polygon.material = color; }); }
	function markButtonActive(a) { 
		const btn = document.getElementById('buildings3DTool'); 
		if (!btn) return; 
		btn.classList.toggle('active', a); 
		
		// Show/hide opacity slider based on state
		const opacityContainer = document.getElementById('buildings3DOpacityContainer');
		if (opacityContainer) {
			opacityContainer.style.display = a ? 'flex' : 'none';
		}
	}
	function createUI() {
		const grid = document.querySelector('#rightPanel .tool-grid'); if (!grid) return;
		
		// Create B3D button
		const btn = document.createElement('div'); 
		btn.className = 'tool-icon'; 
		btn.id = 'buildings3DTool'; 
		btn.title = 'Buildings 3D'; 
		btn.style.display = 'flex'; 
		btn.style.alignItems = 'center'; 
		btn.style.justifyContent = 'center'; 
		btn.innerHTML = '<span style="font-size:10px;font-weight:600;letter-spacing:0.5px;">B3D</span>'; 
		btn.onclick = () => { enabled ? api.disable() : api.enable(); };
		grid.appendChild(btn);
		
		// Create opacity container (initially hidden)
		const cont = document.createElement('div'); 
		cont.id = 'buildings3DOpacityContainer'; 
		cont.style.gridColumn = 'span 2'; 
		cont.style.display = 'none'; // Hidden by default
		cont.style.alignItems = 'center'; 
		cont.style.gap = '6px'; 
		cont.style.padding = '4px 8px'; // Increased left/right padding for consistent spacing
		cont.style.marginTop = '2px';
		cont.style.boxSizing = 'border-box'; // Ensure padding is included in width calculation
		
		const slider = document.createElement('input'); 
		slider.type = 'range'; 
		slider.min = '0'; 
		slider.max = '100'; 
		slider.value = String(Math.round(currentOpacity * 100)); 
		slider.style.flex = '1'; 
		slider.style.width = '100%'; // Ensure slider doesn't exceed container width
		slider.style.maxWidth = '100%'; // Prevent overflow
		slider.oninput = (e) => { 
			const pct = Number(e.target.value); 
			currentOpacity = Math.min(1, Math.max(0, pct / 100)); 
			localStorage.setItem('osmBuildings.opacity', String(currentOpacity)); 
			applyOpacity(); 
		};
		
		cont.appendChild(slider); 
		grid.appendChild(cont);
	}

	const api = {
		init(v) { viewer = v; if (!viewer || !window.Cesium) return; try { const savedOpacity = parseFloat(localStorage.getItem('osmBuildings.opacity') || ''); if (!isNaN(savedOpacity)) currentOpacity = Math.min(1, Math.max(0, savedOpacity)); } catch (e) {} createUI(); },
		enable() { 
			if (!viewer || enabled) return; 
			enabled = true; 
			localStorage.setItem('osmBuildings.enabled', 'true'); 
			markButtonActive(true); 
			attachCameraListener(); 
			_loadForView(); 
			// Update active layers display
			this.updateActiveLayersDisplay();
		},
		disable() { 
			enabled = false; 
			localStorage.setItem('osmBuildings.enabled', 'false'); 
			markButtonActive(false); 
			detachCameraListener(); 
			if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; } 
			if (currentAbortController) { try { currentAbortController.abort(); } catch(e) {} currentAbortController = null; } 
			if (currentDataSource) { try { viewer.dataSources.remove(currentDataSource, true); } catch(e) {} currentDataSource = null; } 
			// Update active layers display
			this.updateActiveLayersDisplay();
		},
		// Test function removed - no longer needed
		setOpacity(alpha) { currentOpacity = Math.min(1, Math.max(0, Number(alpha))); localStorage.setItem('osmBuildings.opacity', String(currentOpacity)); applyOpacity(); },
		
		// Debug function to test OSM data fetching directly
		async testOSM() {
			if (!viewer) return;
			
			// Use current view or default to Paris
			const bbox = computeViewBBox() || [48.8566, 2.3522, 48.8566, 2.3522]; // Paris center
			const testBbox = [bbox[0] - 0.01, bbox[1] - 0.01, bbox[0] + 0.01, bbox[1] + 0.01]; // Small area around current view
			
			try {
				showToast('Testing OSM fetch...');
				console.log('OSM Test: Testing bbox', testBbox);
				
				const query = buildOverpassQuery(testBbox);
				console.log('OSM Test: Query', query);
				
				const url = overpassUrl(OVERPASS_ENDPOINTS[0], testBbox);
				console.log('OSM Test: URL', url);
				
				const response = await fetch(url);
				const osmData = await response.json();
				console.log('OSM Test: Raw response', osmData);
				
				await loadOsmToGeoJson();
				const geojson = parseOverpassToGeoJSON_viaLib(osmData);
				console.log('OSM Test: GeoJSON', geojson);
				
				showToast(`OSM Test: Got ${osmData.elements?.length || 0} elements, ${geojson.features?.length || 0} features`);
				
			} catch (error) {
				console.error('OSM Test: Error', error);
				showToast('OSM Test: Error - check console');
			}
		},
		
		// Function to update the active layers display
		updateActiveLayersDisplay() {
			// Trigger the main active layers update function if it exists
			if (typeof window.updateActiveLayersDisplay === 'function') {
				window.updateActiveLayersDisplay();
			}
		},
		
		// Function to check if buildings are enabled (for external use)
		isEnabled() {
			return enabled;
		}
	};

	window.Buildings3DController = api;
})();


