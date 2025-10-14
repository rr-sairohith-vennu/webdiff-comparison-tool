`# Visual UI Comparison Tool

A web-based application that automates UI regression testing by comparing two web pages (Production vs QA/Preview) and highlighting visual and structural differences.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)
![License](https://img.shields.io/badge/license-MIT-blue)

## 🎯 What It Does

Compares Production vs QA/Preview environments instantly, detecting visual and structural differences automatically with support for multi-state testing (clicking different tabs/buttons), and delivering annotated screenshots with clear difference markers in 8-15 seconds.

## ✨ Key Features

- **Intelligent Comparison** - Percy-style smart element matching with text normalization and position tolerance
- **Multi-State Testing** - Automatically clicks specified buttons/tabs and compares multiple UI states
- **Automated Popup Handling** - Detects and closes popups/modals/banners automatically
- **Real-Time Progress** - Live WebSocket updates with progress bar and status messages
- **Visual Results** - Red bounding boxes on differences with severity classification (High/Medium/Low)
- **Side-by-Side View** - Compare screenshots with detailed statistics

## 🛠 Technology Stack

- **Backend:** Node.js, Express
- **Real-Time:** Socket.IO
- **Browser Automation:** Playwright (Chromium)
- **Image Processing:** Sharp
- **DOM Parsing:** Cheerio
- **Frontend:** HTML5, CSS3, JavaScript

## 🚀 Quick Start

### Installation

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/webdiff.git
cd webdiff

# Install dependencies (includes Playwright Chromium)
npm install

# Start server
npm start
```

The application will be available at **http://localhost:3000**

### Usage

**Basic Comparison:**
1. Enter Production URL in "URL 1"
2. Enter Preview/QA URL in "URL 2"
3. Click "Compare Now"
4. View results in 8-15 seconds

**Multi-State Comparison:**
1. Enter URLs as above
2. Enter button names: `All, Pending, Confirmed`
3. Click "Compare Now"
4. Tool clicks each button and compares separately

## 📊 Performance

- **Total Time:** 8-15 seconds per comparison
- **Page Load:** 3-8 seconds (parallel loading)
- **Screenshot:** 1-2 seconds
- **Analysis:** 0.5-1 second

## 📝 Project Structure

```
webdiff/
├── server.js              # Main backend server + comparison engine
├── public/
│   └── index.html         # Frontend UI
├── package.json           # Dependencies and scripts
├── screenshots/           # Generated screenshots (temp)
├── results/              # Comparison results with annotations
└── DOCUMENTATION.md      # Detailed documentation
```

## 🔧 Configuration

The tool automatically handles:
- Popup detection and closing
- Content stabilization checks
- Network idle waiting with fallback
- Element matching with 60% similarity threshold
- Position tolerance of 200px

## 📚 Documentation

See [DOCUMENTATION.md](DOCUMENTATION.md) for:
- System architecture
- Detailed workflow
- Matching algorithm
- Troubleshooting guide
- Best practices

## 🚀 Deployment

### Deploy to Render (Free)

1. Push to GitHub
2. Go to [Render.com](https://render.com)
3. Connect repository
4. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Deploy

### Deploy to Railway

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Timeout errors | Ensure URLs are accessible; check authentication tokens |
| Button not found | Verify exact button text; ensure button appears after load |
| 0 differences shown | Ensure URL1 ≠ URL2; check if button clicks change content |
| Port 3000 in use | Run `killall -9 node` then `npm start` |

## 👨‍💻 Author

**Sai Rohith Vennu**
Built with Node.js, Playwright, and Socket.IO

## 📄 License

MIT License - feel free to use for your projects

## 🙏 Acknowledgments

Built using Claude Code for automation and testing workflows.

---

**Version:** 1.0.0
**Last Updated:** January 2025
