# 🛠️ Tech Stack

## Core Technologies

**Runtime & Framework**
- **Node.js** (v22.20.0) - JavaScript runtime
- **Express.js** (v4.21.1) - Web server framework

**Browser Automation**
- **Playwright** (v1.56.0) - Headless browser control for screenshots & DOM extraction

**Image Processing**
- **Sharp** (v0.34.4) - High-performance image resizing & manipulation
- **Pixelmatch** (v6.0.0) - Pixel-level image comparison
- **pngjs** (v7.0.0) - PNG encoding/decoding

**Real-Time Communication**
- **Socket.io** (v4.8.1) - WebSocket for live progress updates to UI

**Deployment**
- **Fly.io** - Cloud hosting with persistent volumes for screenshots

---

## How It Works

```
User submits URLs
    ↓
Playwright opens both pages in headless browser
    ↓
Takes screenshots + extracts DOM elements
    ↓
Pixelmatch compares images pixel-by-pixel
    ↓
Sharp draws red boxes on differences
    ↓
Socket.io sends progress updates to UI
    ↓
Results displayed with screenshots
```

---

## Key Features

✅ **Visual Comparison** - Pixel-perfect screenshot diff
✅ **Element Extraction** - Compares buttons, text, images, forms
✅ **JSON/Text Comparison** - Smart parsing for API endpoints
✅ **Cookie Support** - Test authenticated pages
✅ **Click Actions** - Test different UI states (tabs, modals)
✅ **Popup Detection** - Auto-closes popups before comparison
✅ **Real-Time Updates** - Live progress via WebSockets

---

## Architecture

```
Frontend (HTML/JS/CSS)
    ↓ HTTP POST
Express Server (Node.js)
    ↓ Launches
Playwright Browser
    ↓ Captures
Screenshots + DOM
    ↓ Processes
Sharp + Pixelmatch
    ↓ Returns
JSON Results + Annotated Images
```

---

## File Structure

```
├── server.js           # Main server & comparison logic
├── public/
│   └── index.html      # UI
├── screenshots/        # Generated comparisons
├── fly.toml           # Fly.io config
└── package.json       # Dependencies
```

---

**Built with ❤️ using Claude Sonnet 4.5**
