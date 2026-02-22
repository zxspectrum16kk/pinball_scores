# Pinball Scores Application - Technical Specification

## 1. Project Overview

**Pinball Scores** is a client-side Progressive Web App (PWA) designed for tracking and analyzing pinball league data. The application operates on a **Decoupled Architecture**, strictly separating the public runtime from the private management environment.

*   **Active Deployment**: [https://pinball-scores.pages.dev/](https://pinball-scores.pages.dev/)

### 1.1 Origin Story
This application is a bespoke tool built for **Craig, his son Luke, and a few mates**. It tackles a specific problem: enabling quick, friendly score comparisons during their pinball meetups. While the data comes from a public league, the view is tailored to their group's need for instant updates and personal best tracking.

### 1.2 Architecture Rationale
This project was designed with three core principles in mind: **Security, Performance, and Responsible Scraping**.

*   **Security**: By generating static JSON files, we eliminate the need for a public database or backend server. There is **zero attack surface** on the live site—no SQL to inject, no servers to hack.
*   **Performance**: The application consumes pre-computed JSON data. This is significantly faster than querying a database in real-time. Global CDNs (like Cloudflare) can cache these files at the edge, ensuring instant load times.
*   **On-Demand Scraping**: We do not scrape data on every user visit. Instead, the admin triggers a scrape **on demand**. This approach respects the external data source (Pinball League UK) by minimizing traffic load.

## 2. System Architecture

The system is composed of two distinct subsystems:

### 2.1 Static Frontend (The Client)
*   **Hosting**: Agnostic (Cloudflare Pages, GitHub Pages, Netlify).
*   **Logic**: 100% Client-side JavaScript (ES Modules).
*   **State Management**: Fetches static JSON files from the `/data` directory.
*   **Offline Capability**: Service Worker (`sw.js`) caches all assets and data using a stale-while-revalidate strategy.
*   **Offline Indicator**: Visual badge displays when the user is offline, showing cached data availability.

### 2.2 Local Admin Backend (The Management Layer)
*   **Execution**: PowerShell Core script (`server.ps1`) running locally.
*   **Server**: Custom .NET `HttpListener` exposing a local REST API.
*   **Responsibility**: Handles all data ingestion, player management, and file publication.

## 3. Application Map (User Guide)

The application consists of several specialized views, each serving a distinct purpose for the players:

*   **`index.html` (Player Performance)**: The main dashboard. Shows a detailed performance table for each player across all machines, with **search filtering**, **table sorting**, **unplayed machine filter**, gradient score bars, and star indicators for personal bests. Includes skeleton loading screens with shimmer animations for a polished loading experience.
*   **`machines.html` (Machines)**: A comprehensive catalog of all pinball machines played by the group. Useful for seeing global stats across all players.
*   **`machine.html` (Machine Detail)**: Deep dive into a single machine's stats, showing all player scores, high scores, and the machine's **difficulty ranking** sourced from the difficulty index.
*   **`overall.html` (Leaderboard)**: The competitive heart of the app. Displays overall player rankings based on aggregate performance across all machines.
*   **`difficulty.html` (Machine Difficulty)**: Ranks all machines by difficulty, calculated from player score distributions. Helps players understand which tables are the toughest and which are more forgiving.
*   **`player.html` (Player Profile)**: Deep dive into a single player's performance. Shows their best scores and history for every machine, including **above-average percentage** indicators.
*   **`custom_list.html` (Custom List)**: **Feature Highlight**. This page allows users to select a specific subset of machines (e.g., "The 5 machines at the next venue"). The app then filters all data to show insights *only* for those selected games, perfect for event-day strategy.
*   **`players.html` (Settings)**: Player management and configuration options.
*   **`admin.html` (Admin Dashboard)**: The private control room. Accessible only when running the local backend. Used to add players, scrape new data, and publish updates.

## 4. Data Source & Provenance

*   **Primary Source**: [Pinball League UK](https://pinballleague.uk)
*   **Nature**: This application acts as a specialized **offline-first viewer** for data publicly available on the Pinball League UK website.
*   **Sync Strategy**: Data is **snapshotted**. The app reflects the state of the league at the time of the last "Publish" action. It does not pull live data dynamically to the client.

## 5. Technology Stack

### Frontend
| Component | Technology | Description |
| :--- | :--- | :--- |
| **Markup** | HTML5 | Semantic structure with accessibility focus. |
| **Styling** | CSS3 (Vanilla) | Uses CSS Variables (`:root`), Flexbox, and Grid. No preprocessors. |
| **Scripting** | JavaScript (ES6+) | Native ES Modules, split into page-specific modules. No bundlers (Webpack/Vite are **not** used). |
| **PWA** | Service Worker | Cache-First strategy for assets; Stale-While-Revalidate for data. |

### Backend
| Component | Technology | Description |
| :--- | :--- | :--- |
| **Runtime** | PowerShell 7+ | Cross-platform scripting environment. |
| **Server** | .NET HttpListener | Embedded in `server.ps1`. Handles HTTP requests. |
| **Module** | `admin_logic.psm1` | Encapsulates scraping logic and file operations. |

## 6. Offline Functionality

This application is a **fully offline-capable Progressive Web App (PWA)**. Users can install it on their devices and access their pinball scores even without an internet connection.

### 6.1 How It Works

The offline functionality is powered by a **Service Worker** using the **Cache API** with intelligent caching strategies:

#### Caching Strategies

1.  **Data Files (Stale-While-Revalidate)**
    *   **Target**: All `/data/*.json` files (player stats, machine data)
    *   **Behavior**: Serves cached data immediately for instant load times, then fetches fresh data in the background and updates the cache for the next visit.
    *   **Benefit**: Best of both worlds - instant performance + always updating.

2.  **Navigation (Network-First with Offline Fallback)**
    *   **Target**: HTML pages
    *   **Behavior**: Attempts to fetch from network first. If offline, serves cached page. If page not cached, shows `offline.html` fallback.
    *   **Benefit**: Fresh content when online, graceful degradation when offline.

3.  **Static Assets (Cache-First)**
    *   **Target**: CSS, JavaScript, images
    *   **Behavior**: Serves from cache if available, otherwise fetches from network.
    *   **Benefit**: Maximum performance for unchanging assets.

### 6.2 User Experience

*   **Online**: App loads normally with fresh data. Background updates happen silently.
*   **Offline**: Red "📡 Offline" badge appears in top-right corner. Last synchronized data is displayed. All previously visited pages remain functional.
*   **Reconnecting**: Offline badge disappears automatically. Fresh data is fetched in the background without user intervention.

### 6.3 Technical Implementation

*   **Service Worker**: `sw.js` manages two separate caches:
    *   `pinball-scores-v{N}` - App shell (HTML, CSS, JS, images)
    *   `pinball-data-v{N}` - Data files (JSON)
*   **Offline Indicator**: `offline-indicator.js` listens to browser `online`/`offline` events and displays status badge.
*   **Cache Management**: Old cache versions are automatically deleted when the service worker updates.
*   **Storage Size**: ~900KB total (500KB app shell + 400KB data).

## 7. Accessibility & UX Enhancements

The application includes several accessibility and user-experience improvements:

*   **ARIA Support**: Full `aria-sort` attributes on sortable table columns, `aria-current="page"` on navigation links, and semantic HTML throughout.
*   **Reduced Motion**: Respects `prefers-reduced-motion` media query, disabling shimmer animations and transitions for users who prefer reduced motion.
*   **Skeleton Loading Screens**: Pages display shimmer-animated placeholder content while data loads, preventing layout shift and providing visual feedback.
*   **Above-Average Indicators**: Player scores show percentage above or below the group average, giving instant context to raw numbers.

## 8. Code Architecture

The frontend JavaScript follows a modular, maintainable structure:

*   **Page Modules**: `ui.js` has been split into dedicated page modules, each handling the logic for its specific view.
*   **Score Helper**: Shared score calculation utilities extracted into a reusable helper module.
*   **Memoized Stats**: Expensive statistical computations are memoized to avoid redundant recalculation.
*   **Centralised SW Registration**: Service Worker registration is handled in a single shared location rather than per-page.
*   **Consolidated Styles**: All inline styles and embedded style blocks have been moved into a single `styles.css` file.

## 9. Technical Workflows

### 9.1 Player Management
Players are managed via the local API, which updates the `playerid.txt` source of truth and regenerates the `players.json` registry.

*   **Add Player**: Endpoint `POST /api/players` with `{ "name": "Name", "id": "123" }`.
*   **Remove Player**: Endpoint `DELETE /api/players` with `{ "id": "123" }`.

### 9.2 Data Scraping Pipeline
1.  **Request**: `POST /api/scrape` with target IDs.
2.  **Fetch**: `Invoke-WebRequest` retrieves HTML from source.
3.  **Parse**: Regex extraction of table data.
4.  **Stage**: Serialized JSON saved to `data/temp/`.

### 9.3 Publication Cycle
1.  **Review**: `GET /api/staged` checks `data/temp/`.
2.  **Promote**: `POST /api/publish` moves files to `data/`.
3.  **Deploy**: User commits `data/` changes to git/Cloudflare.

## 10. Privacy & Compliance

Transparency is key. Even though this is a personal project, I believe in clear data practices.

*   **Policy**: [Privacy Notice](privacy.html)
*   **Data Handling**: This application collects **no personal data** from visitors. It strictly displays public league data.
*   **Compliance**: We respect the "Right to be Forgotten". Players can request removal from this view by contacting the maintainer, as detailed in the privacy policy.

## 11. Open Development

We believe in the principle of **Developing in the Open**. Even though this tool serves a small group of friends, sharing the source code allows others to learn from the architecture, suggest improvements, or fork it for their own leagues.

*   **Source Code**: [https://github.com/zxspectrum16kk/pinball_scores](https://github.com/zxspectrum16kk/pinball_scores)

---
*Maintained by: Craig Cole*
