# Starlink Direct-to-Cell Tracker

A real-time web app to track Starlink Direct-to-Cell satellites overhead. Shows which satellites are currently usable from your location with an interactive rotating compass view.

## Features

- 🛰️ **Real-time DTC tracking** - Shows only Direct-to-Cell satellites (not regular Starlink)
- 📍 **Smart filtering** - Only displays satellites above 25° elevation (Starlink's minimum for reliable service)
- 🧭 **Rotating compass** - Sky map rotates with your device so North points to actual north
- 📊 **Visual sky map** - See exactly where each satellite is positioned in the sky
- ⏰ **Next pass predictions** - When no satellites are overhead, shows upcoming passes with countdown timers
- 📱 **Mobile optimized** - Designed for use in the field on your phone
- 🌙 **Dark theme** - Easy on the eyes when checking satellites at night

## How to Use

### Basic Operation

1. **Allow location access** when prompted - needed to calculate satellite positions
2. **Enable compass** (iOS only) - Tap the "Enable Compass" button when it appears
3. **Hold phone flat** - Keep it parallel to the ground for accurate compass readings
4. **Point and look** - The map rotates as you turn, showing where satellites are in real life

### Understanding the Display

**Sky Map:**
- **Center** = Directly overhead (zenith)
- **Edge** = Horizon
- **Compass directions** (N, S, E, W) stay fixed to real directions as you turn
- **Numbers** on map correspond to numbered satellites in the list below

**Satellite Colors:**
- 🟢 **Green** (>60° elevation) - Excellent signal, high in sky
- 🟡 **Yellow** (30-60° elevation) - Good signal, medium height
- 🟠 **Orange** (25-30° elevation) - Marginal signal, low on horizon

**Satellite Details:**
Each satellite shows:
- **Direction** - Compass heading (e.g., "NE (45°)")
- **Elevation** - Angle above horizon (25° minimum shown)
- **Distance** - How far away the satellite is in km

**When No Satellites Are Visible:**
- Shows next 5 upcoming passes
- Countdown timer for each (e.g., "In 12 minutes")
- Exact time of pass

### Tips

- **Fewer satellites = normal** - You'll typically see 0-4 satellites at a time, not dozens
- **Coverage gaps are expected** - Sometimes you'll wait a few minutes between passes
- **Higher elevation = better** - Satellites near center of map have best signal
- **Turn slowly** - Give the compass a second to update as you rotate
- **Clear sky view needed** - Satellites won't work if obstructed by buildings/trees

## Technical Details

**Why only satellites above 25° elevation?**
- Starlink uses 25° as the minimum for reliable service
- Below this angle, too much atmosphere and higher chance of obstruction
- Your phone needs clearer line-of-sight than a Starlink dish

**How many DTC satellites are there?**
- Currently tracking ~650 Direct-to-Cell satellites in orbit
- Much smaller constellation than regular Starlink (6000+ broadband satellites)
- That's why you see fewer overhead at any given time

**Data sources:**
- Satellite positions: [Celestrak](https://celestrak.org/) (updated every 30 minutes)
- Orbital calculations: [satellite.js](https://github.com/shashwatak/satellite-js)
- All processing happens in your browser - no data sent to external servers

**Update frequency:**
- Satellite positions recalculated every 5 seconds
- TLE (orbital) data refreshed every 30 minutes
- Compass updates continuously as you turn your device

## Device Compatibility

**Location Services:**
- Required for all devices
- Uses GPS to determine your position

**Compass:**
- **iOS 13+**: Requires permission (tap "Enable Compass" button)
- **Android**: Works automatically
- Desktop browsers: Sky map shows but won't rotate (no compass hardware)

**Browsers:**
- Safari (iOS/macOS)
- Chrome (Android/Desktop)
- Firefox (Android/Desktop)
- Edge (Desktop)

## Privacy

- Your location is only used locally in your browser
- No tracking, analytics, or data collection
- No account or login required
- Completely free and open source

---

*This tracker helps you understand when and where satellites are available for connection. It's especially useful for understanding coverage patterns in remote areas.*
