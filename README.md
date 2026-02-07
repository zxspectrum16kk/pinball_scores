# Pinball Scores Application

A modern, responsive Progressive Web App (PWA) for tracking, analyzing, and comparing pinball scores among a group of players. It features a robust backend for scraping data from external sources and a rich frontend for visualization.

## 🚀 Features

### Frontend (User Interface)
- **Machines Table**: View all machines with high scores, averages, and play counts.
- **Leaderboard**: Overall player rankings based on aggregate performance.
- **Head-to-Head**: Direct comparison between any two players.
- **Player Profiles**: Detailed stats for individual players.
- **Custom Lists**: Create and manage custom lists of machines.
- **PWA Support**: Installable on mobile/desktop with offline capabilities.
- **Responsive Design**: Works seamlessly on mobile and desktop.

### Backend (Admin Tools)
- **Web-Based Admin Interface**: Manage players and data without touching code.
- **Player Management**: Add or remove players dynamically.
- **Data Scraping**: 
    - Scrapes real-time data from [Pinball League UK](https://pinballleague.uk).
    - Supports individual player scraping and global machine stats.
- **Staging & Publishing**: Review scraped data before publishing to the live site.
- **API**: Custom PowerShell-based API for handling frontend requests.

## 🛠 Technology Stack

### Frontend
- **HTML5 & CSS3**: Semantic markup with a custom responsive design system (variables, flexbox/grid).
- **JavaScript (ES6+)**: Vanilla JS modules for state management, data fetching, and UI rendering.
- **Manifest & Service Worker**: Full PWA implementation for installability and offline caching.

### Backend
- **PowerShell Typescript (PSM1)**: Core logic encapsulated in `admin/admin_logic.psm1`.
- **PowerShell HTTP Server**: Custom lightweight HTTP server `server.ps1` that handles:
    - Static file serving.
    - RESTful API endpoints (`/api/players`, `/api/scrape`, `/api/publish`, etc.).

### Data
- **JSON**: All data is stored in static JSON files in the `/data` directory.
- **Source**: Player and machine data is sourced from [Pinball League UK](https://pinballleague.uk).

## 📂 File Structure

```text
c:\pinball_scores\
├── admin\
│   └── admin_logic.psm1    # Core backend logic (Scraping, CRUD, Publishing)
├── data\
│   ├── players.json        # List of active players (Generated)
│   ├── temp\               # Staging area for scraped files
│   └── *.json              # Live player and machine data
├── admin.html              # Admin interface entry point
├── admin.js                # Admin UI logic and API client
├── data.js                 # Data fetching and state management
├── index.html              # Main Machines list
├── main.js                 # App entry point (Routing/Bootstrapping)
├── manifest.json           # PWA Manifest
├── server.ps1              # PowerShell Web Server + API Handler
├── stats.js                # Statistics calculation engine
├── styles.css              # Global styles
├── sw.js                   # Service Worker (Caching strategy)
└── ui.js                   # UI Rendering functions
```

## ⚡ How to Use (Local vs. Cloudflare)

**Important**: This application is designed to be hosted on **Cloudflare Pages** (or any static host), but the **Admin Tools** must be run **LOCALLY**.

### Why?
Cloudflare Pages hosts only *static files* (HTML, CSS, JS). It cannot run the PowerShell backend script (`server.ps1`) required for scraping data and managing players.

### The Workflow "Local CMS"
1.  **Run Locally**: Open `server.ps1` on your computer.
2.  **Manage Data**: Go to `http://localhost:8000/admin.html` to add players and scrape new scores.
    *   *Note: The Admin page is hidden from the public execution.*
3.  **Publish**: This updates the JSON files in your local `data` folder.
4.  **Deploy**: Upload your entire `pinball_scores` folder to Cloudflare.
5.  **View Live**: Your visitors see the updated scores on the live site!

### Running the Server Locally
1.  Open PowerShell in the project root.
2.  Run: `& "c:\mytools\server.ps1"`
3.  Access the site at: `http://localhost:8000`

## 🛡 API Endpoints

The `server.ps1` script exposes the following API endpoints:

- `GET /api/players`: Returns the list of configured players.
- `POST /api/players`: Add a new player.
- `DELETE /api/players`: Remove a player.
- `POST /api/scrape`: Trigger scraping for selected targets.
- `GET /api/staged`: List files waiting in the staging area.
- `POST /api/publish`: Move staged files to the live `data` folder.

## 🌍 External Data

All score and machine data is scraped from **Pinball League UK**.
- Website: [https://pinballleague.uk](https://pinballleague.uk)
- This application is a personal viewer for this data and is not affiliated with Pinball League UK.

---
*Created for personal use. Maintainer: [Craig Cole]*
