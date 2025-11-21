// Starlink DTC Tracker - Main Application
const app = document.getElementById('app');
let userLocation = null;
let satellites = [];
let updateInterval = null;
let tleInterval = null;

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
        for (let i = 0; i < lines.length; i += 3) {
            if (i + 2 < lines.length) {
                const name = lines[i].trim();
                sats.push({
                    name: name,
                    tle1: lines[i + 1],
                    tle2: lines[i + 2],
                });
            }
        }
        
        satellites = sats;
        console.log(`Loaded ${satellites.length} Starlink satellites`);
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
                
                // If satellite is above horizon (elevation > 0)
                if (elevation > 0) {
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
                        
                        // Found a pass for this satellite
                        if (elevation > 0 && !upcoming.find(p => p.name === sat.name)) {
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
                <div class="satellite-list">
        `;
        
        visibleSatellites.forEach(sat => {
            content += `
                <div class="satellite-card">
                    <div class="satellite-name">${sat.name}</div>
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
                    <p class="small-text">Tracking ${satellites.length} Starlink satellites</p>
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
