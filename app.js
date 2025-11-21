// Starlink DTC Tracker - Main Application
const app = document.getElementById('app');
let userLocation = null;
let satellites = [];
let updateInterval = null;
let tleInterval = null;
let compassHeading = 0; // Device compass heading in degrees

// Minimum elevation angle for usable satellite connection (degrees)
// Starlink uses 25° minimum for reliable service
// Satellites lower than this are too close to horizon for reliable phone connection
const MIN_ELEVATION = 25;

// Render HTML to the app container
function render(html) {
    app.innerHTML = html;
}

// Show loading state
function showLoading(message = 'Loading satellite data...', subMessage = '') {
    render(`
        <div class="container">
            <div class="loading">
                <div class="spinner"></div>
                <p>${message}</p>
                ${subMessage ? `<p class="small-text">${subMessage}</p>` : ''}
            </div>
        </div>
    `);
}

// Show error state
function showError(message) {
    render(`
        <div class="container">
            <div class="error">
                <h2>Error</h2>
                <p>${message}</p>
                <button onclick="window.location.reload()">Retry</button>
            </div>
        </div>
    `);
}

// Convert azimuth degrees to compass direction
function getCompassDirection(azimuth) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(azimuth / 22.5) % 16;
    return directions[index];
}

// Render sky map visualization
function renderSkyMap(visibleSatellites, heading = 0) {
    if (visibleSatellites.length === 0) return '';
    
    const size = 300;
    const center = size / 2;
    const radius = size / 2 - 20;
    
    let svg = `
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="max-width: 100%; height: auto;">
            <!-- Rotate entire map based on device heading so North points to actual north -->
            <g transform="rotate(${-heading} ${center} ${center})">
                <!-- Background -->
                <circle cx="${center}" cy="${center}" r="${radius}" fill="#0a0e1a" stroke="#2c3e50" stroke-width="2"/>
                
                <!-- Elevation rings -->
                <circle cx="${center}" cy="${center}" r="${radius * 0.33}" fill="none" stroke="#1a2332" stroke-width="1" opacity="0.5"/>
                <circle cx="${center}" cy="${center}" r="${radius * 0.67}" fill="none" stroke="#1a2332" stroke-width="1" opacity="0.5"/>
                
                <!-- Compass directions -->
                <text x="${center}" y="15" text-anchor="middle" fill="#64b5f6" font-size="14" font-weight="bold">N</text>
                <text x="${size - 10}" y="${center + 5}" text-anchor="end" fill="#64b5f6" font-size="14" font-weight="bold">E</text>
                <text x="${center}" y="${size - 5}" text-anchor="middle" fill="#64b5f6" font-size="14" font-weight="bold">S</text>
                <text x="10" y="${center + 5}" text-anchor="start" fill="#64b5f6" font-size="14" font-weight="bold">W</text>
                
                <!-- Center dot (zenith) -->
                <circle cx="${center}" cy="${center}" r="3" fill="#64b5f6" opacity="0.5"/>
    `;
    
    // Plot satellites
    visibleSatellites.forEach((sat, index) => {
        const azimuth = parseFloat(sat.azimuth);
        const elevation = parseFloat(sat.elevation);
        
        // Convert to polar coordinates
        // Elevation: 90° (zenith) = center, 0° (horizon) = edge
        const elevationRadius = radius * (1 - (elevation / 90));
        
        // Azimuth: 0° = North (top), increases clockwise
        const azimuthRad = (azimuth - 90) * (Math.PI / 180);
        
        const x = center + elevationRadius * Math.cos(azimuthRad);
        const y = center + elevationRadius * Math.sin(azimuthRad);
        
        // Color based on elevation (green = high, yellow = medium, red = low)
        let color;
        if (elevation > 60) color = '#4caf50';
        else if (elevation > 30) color = '#ffc107';
        else color = '#ff9800';
        
        svg += `
            <circle cx="${x}" cy="${y}" r="6" fill="${color}" opacity="0.8" stroke="#fff" stroke-width="1">
                <title>${sat.name}\n${sat.elevation}° elevation\n${getCompassDirection(azimuth)} (${sat.azimuth}°)</title>
            </circle>
            <text x="${x}" y="${y - 10}" text-anchor="middle" fill="#e0e0e0" font-size="10" opacity="0.7">${index + 1}</text>
        `;
    });
    
    svg += `
            </g>
        </svg>`;
    
    return svg;
}

// Fetch TLE (Two-Line Element) data for Starlink satellites
async function fetchTLEData() {
    try {
        console.log('Fetching TLE data from Celestrak...');
        const response = await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const text = await response.text();
        const lines = text.trim().split('\n');
        const sats = [];
        
        // Parse TLE data (3 lines per satellite: name, line1, line2)
        // Filter for Direct-to-Cell satellites only
        for (let i = 0; i < lines.length; i += 3) {
            if (i + 2 < lines.length) {
                const name = lines[i].trim();
                const nameLower = name.toLowerCase();
                
                // Filter for DTC satellites - they typically have "DTC" or "DIRECT TO CELL" in the name
                if (nameLower.includes('dtc') || 
                    nameLower.includes('direct to cell') || 
                    nameLower.includes('direct-to-cell')) {
                    sats.push({
                        name: name,
                        tle1: lines[i + 1],
                        tle2: lines[i + 2],
                    });
                }
            }
        }
        
        satellites = sats;
        
        if (satellites.length === 0) {
            console.warn('No DTC satellites found in TLE data. The naming convention may have changed.');
            console.log('Try checking Celestrak manually or contact support.');
        } else {
            console.log(`Loaded ${satellites.length} Starlink Direct-to-Cell satellites`);
        }
        
        return true;
    } catch (err) {
        console.error('Failed to fetch TLE data:', err);
        return false;
    }
}

// Calculate current positions and future passes
function calculatePositions() {
    if (!userLocation || satellites.length === 0) {
        console.log('Waiting for location and satellite data...');
        return;
    }
    
    const now = new Date();
    
    // Observer position in geodetic coordinates
    const observerGd = {
        latitude: userLocation.latitude * (Math.PI / 180),
        longitude: userLocation.longitude * (Math.PI / 180),
        height: (userLocation.altitude || 0) / 1000, // Convert to km
    };
    
    const visible = [];
    const upcoming = [];
    
    // Check each satellite's current position
    satellites.forEach((sat) => {
        try {
            const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
            const positionAndVelocity = satellite.propagate(satrec, now);
            
            if (positionAndVelocity.position && typeof positionAndVelocity.position !== 'boolean') {
                const positionEci = positionAndVelocity.position;
                const gmst = satellite.gstime(now);
                const positionEcf = satellite.eciToEcf(positionEci, gmst);
                const lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf);
                
                const azimuth = lookAngles.azimuth * (180 / Math.PI);
                const elevation = lookAngles.elevation * (180 / Math.PI);
                
                // If satellite is above minimum elevation (usable for connection)
                if (elevation > MIN_ELEVATION) {
                    visible.push({
                        name: sat.name,
                        azimuth: azimuth.toFixed(1),
                        elevation: elevation.toFixed(1),
                        distance: (lookAngles.rangeSat).toFixed(0),
                    });
                }
            }
        } catch (err) {
            // Skip satellites with calculation errors
            console.debug(`Error calculating position for ${sat.name}:`, err.message);
        }
    });
    
    // Sort visible satellites by elevation (highest first)
    visible.sort((a, b) => parseFloat(b.elevation) - parseFloat(a.elevation));
    
    // If no satellites are visible, calculate next passes
    if (visible.length === 0) {
        console.log('No satellites currently visible, calculating next passes...');
        
        // Look ahead up to 3 hours
        for (let minutes = 1; minutes <= 180; minutes += 2) {
            const futureTime = new Date(now.getTime() + minutes * 60 * 1000);
            
            // Check first 100 satellites to avoid too much computation
            for (const sat of satellites.slice(0, 100)) {
                try {
                    const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
                    const positionAndVelocity = satellite.propagate(satrec, futureTime);
                    
                    if (positionAndVelocity.position && typeof positionAndVelocity.position !== 'boolean') {
                        const positionEci = positionAndVelocity.position;
                        const gmst = satellite.gstime(futureTime);
                        const positionEcf = satellite.eciToEcf(positionEci, gmst);
                        const lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf);
                        const elevation = lookAngles.elevation * (180 / Math.PI);
                        
                        // Found a pass for this satellite (above minimum elevation)
                        if (elevation > MIN_ELEVATION && !upcoming.find(p => p.name === sat.name)) {
                            upcoming.push({
                                name: sat.name,
                                time: futureTime,
                                minutesUntil: minutes,
                            });
                            
                            if (upcoming.length >= 5) break;
                        }
                    }
                } catch (err) {
                    // Skip satellites with errors
                }
            }
            
            if (upcoming.length >= 5) break;
        }
        
        // Sort by soonest pass first
        upcoming.sort((a, b) => a.minutesUntil - b.minutesUntil);
    }
    
    renderApp(visible, upcoming);
}

// Render the main application UI
function renderApp(visibleSatellites, nextPasses) {
    const lastUpdate = new Date();
    
    let content = `
        <div class="container">
            <header>
                <h1>Starlink Direct-to-Cell Tracker</h1>
                ${userLocation ? `<p class="location">${userLocation.latitude.toFixed(4)}°, ${userLocation.longitude.toFixed(4)}°</p>` : ''}
            </header>
            
            <main>
    `;
    
    if (visibleSatellites.length > 0) {
        content += `
            <section class="section">
                <h2 class="section-title">Currently Overhead (${visibleSatellites.length})</h2>
                
                <div style="text-align: center; margin-bottom: 20px;">
                    ${renderSkyMap(visibleSatellites, compassHeading)}
                    <p class="small-text" style="margin-top: 10px;">
                        Sky map: Center = directly overhead, Edge = horizon<br>
                        🟢 High elevation • 🟡 Medium • 🟠 Low<br>
                        ${compassHeading !== 0 ? 'Compass enabled - map rotates with your device' : 'Turn phone to enable compass'}
                    </p>
                </div>
                
                <div class="satellite-list">
        `;
        
        visibleSatellites.forEach((sat, index) => {
            content += `
                <div class="satellite-card">
                    <div class="satellite-name">${index + 1}. ${sat.name}</div>
                    <div class="satellite-info">
                        <div class="info-item">
                            <span class="label">Direction:</span>
                            <span class="value">${getCompassDirection(parseFloat(sat.azimuth))} (${sat.azimuth}°)</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Elevation:</span>
                            <span class="value">${sat.elevation}°</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Distance:</span>
                            <span class="value">${sat.distance} km</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        content += `
                </div>
            </section>
        `;
    } else {
        content += `
            <section class="section">
                <h2 class="section-title">No Satellites Currently Overhead</h2>
        `;
        
        if (nextPasses.length > 0) {
            content += `
                <h3 class="subsection-title">Next Passes</h3>
                <div class="pass-list">
            `;
            
            nextPasses.forEach(pass => {
                content += `
                    <div class="pass-card">
                        <div class="pass-name">${pass.name}</div>
                        <div class="pass-time">In ${pass.minutesUntil} minute${pass.minutesUntil !== 1 ? 's' : ''}</div>
                        <div class="pass-time-exact">${pass.time.toLocaleTimeString()}</div>
                    </div>
                `;
            });
            
            content += `
                </div>
            `;
        } else {
            content += `<p class="no-data">Calculating next passes...</p>`;
        }
        
        content += `</section>`;
    }
    
    content += `
                <section class="footer">
                    <p class="small-text">Tracking ${satellites.length} Starlink Direct-to-Cell satellites</p>
                    <p class="small-text">Showing satellites above ${MIN_ELEVATION}° elevation</p>
                    <p class="small-text">Last updated: ${lastUpdate.toLocaleTimeString()}</p>
                    <button class="refresh-button" onclick="window.location.reload()">Refresh</button>
                </section>
            </main>
        </div>
    `;
    
    render(content);
}

// Initialize the application
async function init() {
    showLoading('Getting your location...');
    
    // Check if geolocation is supported
    if (!navigator.geolocation) {
        showError('Geolocation is not supported by your browser');
        return;
    }
    
    // Request user location
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            userLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                altitude: position.coords.altitude || 0,
            };
            
            console.log('Location acquired:', userLocation);
            showLoading('Loading satellite data...', 'Location acquired');
            
            // Fetch satellite TLE data
            const success = await fetchTLEData();
            if (!success) {
                showError('Failed to fetch satellite data. Please check your internet connection and try again.');
                return;
            }
            
            // Start calculating positions
            calculatePositions();
            
            // Update positions every 5 seconds
            updateInterval = setInterval(calculatePositions, 5000);
            
            // Refresh TLE data every 30 minutes
            tleInterval = setInterval(async () => {
                console.log('Refreshing TLE data...');
                await fetchTLEData();
            }, 30 * 60 * 1000);
        },
        (error) => {
            console.error('Geolocation error:', error);
            showError(`Location error: ${error.message}. Please enable location services and reload.`);
        }
    );
}

// Start the application when the page loads
init();

// Setup device compass/orientation
function setupCompass() {
    if (!window.DeviceOrientationEvent) {
        console.log('Device orientation not supported');
        return;
    }
    
    // iOS 13+ requires permission
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        // Create a button to request permission (iOS requirement)
        const requestButton = document.createElement('button');
        requestButton.textContent = 'Enable Compass';
        requestButton.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 1000; padding: 10px 20px; background: #1976d2; color: white; border: none; border-radius: 8px; font-size: 14px;';
        requestButton.onclick = async () => {
            try {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission === 'granted') {
                    startCompass();
                    requestButton.remove();
                }
            } catch (error) {
                console.error('Error requesting device orientation permission:', error);
            }
        };
        document.body.appendChild(requestButton);
    } else {
        // Non-iOS or older iOS - just start listening
        startCompass();
    }
}

function startCompass() {
    // Use deviceorientationabsolute if available (provides true north)
    // Otherwise fall back to deviceorientation (magnetic north)
    const eventType = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    
    window.addEventListener(eventType, (event) => {
        // Alpha is the compass heading (0-360 degrees)
        // 0/360 = North, 90 = East, 180 = South, 270 = West
        if (event.alpha !== null) {
            // On Android, alpha is already compass heading
            // On iOS with absolute, alpha is true north
            compassHeading = Math.round(event.alpha);
            
            // Trigger a re-render if satellites are visible
            if (satellites.length > 0 && userLocation) {
                calculatePositions();
            }
        }
    });
    
    console.log('Compass enabled');
}

// Start compass after a short delay to ensure app is loaded
setTimeout(setupCompass, 2000);
