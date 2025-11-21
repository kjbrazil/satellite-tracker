# Starlink Direct-to-Cell Tracker

A real-time web app to track Starlink Direct-to-Cell satellites overhead. Shows which satellites are currently visible from your location and when the next passes will occur.

## Features

- 🛰️ Real-time tracking of Starlink satellites
- 📍 Automatic location detection
- 🧭 Compass directions and elevation angles
- ⏰ Next pass predictions
- 📱 Mobile-friendly responsive design
- 🌙 Dark theme optimized for night viewing

## Setup Instructions

### Quick Start (GitHub Pages)

1. **Create a new GitHub repository**
   - Go to https://github.com/new
   - Name it `starlink-tracker` (or whatever you prefer)
   - Check "Add a README file"
   - Click "Create repository"

2. **Upload the files**
   - Click "Add file" → "Upload files"
   - Drag and drop these three files:
     - `index.html`
     - `style.css`
     - `app.js`
   - Click "Commit changes"

3. **Enable GitHub Pages**
   - Go to repository Settings
   - Scroll down to "Pages" in the left sidebar
   - Under "Source", select "main" branch
   - Click "Save"
   - Wait 1-2 minutes for deployment

4. **Access your app**
   - Your app will be live at: `https://yourusername.github.io/starlink-tracker`
   - Bookmark this URL on your phone for easy access

## How to Use

1. Open the app in your browser
2. Allow location access when prompted
3. View satellites currently overhead or see when the next pass will occur
4. The app updates automatically every 5 seconds

## Technical Details

- Uses [satellite.js](https://github.com/shashwatak/satellite-js) for orbital calculations
- Fetches TLE data from [Celestrak](https://celestrak.org/)
- Updates satellite data every 30 minutes
- No backend required - runs entirely in the browser

## Requirements

- Modern web browser (Chrome, Safari, Firefox, Edge)
- Internet connection for initial load and TLE updates
- Location services enabled

## Privacy

- Your location is only used locally in your browser
- No data is sent to any server except Celestrak for satellite data
- No tracking or analytics

## License

Free to use and modify
