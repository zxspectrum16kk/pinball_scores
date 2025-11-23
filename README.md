# Pinball Scores Website

A web application for tracking and displaying pinball machine scores across multiple players.

## Quick Start

🚀 **Server is running on port 8000**  
Access the site at: **http://localhost:8000**

⚠️ **Do not open HTML files directly** - Must be served via HTTP server (see instructions below)

## Features

- **Machines Page**: View all pinball machines with scores for selected players
- **Leaderboard**: Overall player statistics and rankings
- **Head-to-Head**: Compare players directly against each other
- **Settings**: Select which players to display in the main views
- **Machine Detail**: Detailed statistics for individual machines
- **Player Profile**: Individual player performance across all machines

## How to Run

⚠️ **Important**: This website must be served via an HTTP server. You cannot simply double-click the HTML files to open them in a browser, as this will cause CORS errors when loading JSON data.

### Using PowerShell (Windows)

From the project root directory:

```powershell
# Navigate to the parent directory
cd c:\projects

# Run the server script
./mytools/server.ps1 -Root ./pinball_scores
```

The site will be available at: **http://localhost:8000**

### Using Python (Cross-platform)

```bash
# Navigate to the pinball_scores directory
cd c:\projects\pinball_scores

# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

### Using Node.js

```bash
# Install http-server globally (one time)
npm install -g http-server

# Navigate to the pinball_scores directory
cd c:\projects\pinball_scores

# Run the server
http-server -p 8000
```

## Why Do I Need a Server?

Modern browsers block JavaScript from loading local files (JSON data) when using the `file://` protocol due to CORS (Cross-Origin Resource Sharing) security policies. This is a security feature to prevent malicious scripts from accessing your file system.

By serving the site via HTTP (even locally), the browser treats all files as coming from the same origin and allows the data to load properly.

## Data Structure

The application loads data from JSON files in the `/data` directory:
- Player score data (Craig, Luke, Paul, Richard, Jane)
- Machine statistics

## Player Selection

By default, Craig, Luke, and Paul are selected. You can customize which players appear on the main pages via the **Settings** page. Your selection is saved in browser localStorage.

Note: Machine Detail and Player Profile pages always show all tracked players for complete accuracy.

## Browser Compatibility

Tested and working in:
- Chrome
- Edge
- Firefox
- Safari

## Technical Details

- Pure HTML, CSS, and JavaScript (no frameworks)
- Responsive design with mobile support
- Client-side data processing
- LocalStorage for user preferences
- Sortable tables with visual indicators
