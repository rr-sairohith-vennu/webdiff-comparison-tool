# 🎯 WebDiff - Visual Comparison Tool

> Compare two versions of a website side-by-side, spot differences automatically, and get visual screenshots with highlighted changes!

**Live Demo:** https://1-summer-sea-3563.fly.dev

---

## 🤔 What Does This Tool Do?

Imagine you changed something on your website (maybe a button, text, or price). How do you check if it looks the same in Production and Preview?

**WebDiff does this automatically!**

1. Give it two URLs (Production vs Preview)
2. It takes screenshots of both
3. It finds ALL differences (text, buttons, prices, images)
4. It draws red boxes around the differences
5. You see them side-by-side!

---

## ✨ Key Features

- ✅ **Side-by-side comparison** - See Production vs Preview together
- ✅ **Automatic difference detection** - No manual checking needed
- ✅ **Visual highlighting** - Red boxes show exactly what changed
- ✅ **Button state comparison** - Compare "Pending", "Confirmed", etc. tabs
- ✅ **Cookie support** - Works with authenticated pages (QA1, Preview)
- ✅ **Real-time progress** - Watch as it compares
- ✅ **No AI needed** - Pure logic and math!

---

## 🛠️ Tech Stack

### Backend
- **Node.js** (v22.20.0) - JavaScript runtime
- **Express.js** (v4.21.2) - Web server
- **Playwright** (v1.56.0) - Browser automation (takes screenshots)
- **Sharp** (v0.34.4) - Image processing (draws red boxes)
- **Socket.io** (v4.8.1) - Real-time updates to browser

### Frontend
- **Vanilla JavaScript** - No frameworks!
- **HTML5 + CSS3** - Modern dark UI
- **Socket.io Client** - Real-time progress bar

### Deployment
- **Fly.io** - Cloud hosting (San Jose datacenter)
- **GitHub Actions** - Automatic deployment on push
- **Docker** - Containerized deployment
- **Persistent Volumes** - Saves screenshots (3GB)

---

## 📊 How It Works (Simple Explanation)

\`\`\`
You enter 2 URLs
     ↓
Server launches 2 Chrome browsers (headless)
     ↓
Browser 1 opens URL 1 (Production)
Browser 2 opens URL 2 (Preview)
     ↓
Extract ALL elements from both pages
(buttons, text, images, prices)
     ↓
Compare them using math:
- Same text? ✅ Matched
- Different position? ❌ Difference
- Only in URL1? ❌ Removed
- Only in URL2? ❌ Added
     ↓
Take full-page screenshots
     ↓
Draw red boxes on differences
     ↓
Show you the results!
\`\`\`

---

## 🎨 Visual Flow Diagram

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                    USER BROWSER                             │
│  http://localhost:4000 or https://fly.io                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  URL 1: [https://prod.com/page    ]                        │
│  URL 2: [https://preview.com/page ]                        │
│  Buttons: [Pending, Confirmed     ]                        │
│  Cookies: [Optional JSON          ]                        │
│                                                             │
│           [🚀 Compare Now]                                  │
└─────────────────────────────────────────────────────────────┘
                    │
                    │ HTTP POST /api/compare
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                  EXPRESS SERVER (Backend)                   │
│                      server.js                              │
├─────────────────────────────────────────────────────────────┤
│  1. Receives request with URLs + cookies                    │
│  2. Creates UIComparisonEngine instance                     │
│  3. Passes config to Playwright                             │
└─────────────────────────────────────────────────────────────┘
                    │
                    │ Launch browsers
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                PLAYWRIGHT (Browser Automation)              │
│                 Chromium Headless x2                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Browser 1                    Browser 2                     │
│  ┌─────────────┐             ┌─────────────┐              │
│  │             │             │             │              │
│  │  Opens      │             │  Opens      │              │
│  │  URL 1      │             │  URL 2      │              │
│  │  (Prod)     │             │  (Preview)  │              │
│  │             │             │             │              │
│  └─────────────┘             └─────────────┘              │
│        │                            │                       │
│        └────────────────┬───────────┘                       │
│                         │                                   │
│              Extract DOM Elements                           │
│           (buttons, text, images, etc.)                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│              COMPARISON ALGORITHM (Math)                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  For each element in URL 1:                                 │
│    Find similar element in URL 2                            │
│                                                             │
│    Calculate similarity score:                              │
│    ┌─────────────────────────────────┐                     │
│    │ Text match:     50% weight      │                     │
│    │ Position match: 30% weight      │                     │
│    │ Size match:     20% weight      │                     │
│    └─────────────────────────────────┘                     │
│                                                             │
│    If score > 60% → MATCHED ✅                              │
│    If score < 60% → DIFFERENT ❌                            │
│                                                             │
│  Results:                                                   │
│  • Content Removed (in URL1, not in URL2)                   │
│  • Content Added (in URL2, not in URL1)                     │
│  • Currency Changed ($69.42 → $16.87)                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│               SCREENSHOT CAPTURE                            │
│                   (Playwright)                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  page1.screenshot() → prod_123.png                          │
│  page2.screenshot() → preview_123.png                       │
│                                                             │
│  Saved to: /app/data/screenshots/ (Fly.io)                 │
│         or ./screenshots/ (Local)                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│            IMAGE PROCESSING (Sharp)                         │
│              Draw Red Boxes                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  For each difference:                                       │
│    Create SVG rectangle                                     │
│    Position: (x, y, width, height)                          │
│    Color: Red (#ff453a)                                     │
│                                                             │
│  Composite SVG on screenshot                                │
│  Save: prod_123_highlighted.png                             │
│       preview_123_highlighted.png                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                SEND RESULTS TO BROWSER                      │
│                    (JSON Response)                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  {                                                          │
│    success: true,                                           │
│    comparisons: [{                                          │
│      screenshots: {                                         │
│        highlighted: {                                       │
│          url1: "screenshots/prod_123_highlighted.png",      │
│          url2: "screenshots/preview_123_highlighted.png"    │
│        }                                                    │
│      },                                                     │
│      differences: [                                         │
│        { category: "Currency Changed", ... }                │
│      ],                                                     │
│      totalDifferences: 29                                   │
│    }]                                                       │
│  }                                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                BROWSER DISPLAYS RESULTS                     │
│                   (Frontend UI)                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📊 29 Total Differences Found                              │
│                                                             │
│  ┌───────────────────┬───────────────────┐                 │
│  │   URL 1 (Prod)    │  URL 2 (Preview)  │                 │
│  │   Clean image     │  Red boxes 🔴     │                 │
│  └───────────────────┴───────────────────┘                 │
│                                                             │
│  📋 Detailed Differences Table:                             │
│  ┌─────────────────────────────────────────┐               │
│  │ Type  | Category        | Severity      │               │
│  ├─────────────────────────────────────────┤               │
│  │ Content | Currency Changed | High ⚠️   │               │
│  │ $69.42 → $16.87                         │               │
│  └─────────────────────────────────────────┘               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
\`\`\`

---

## 🚀 Quick Start

### Local Development

\`\`\`bash
# 1. Clone the repo
git clone https://github.com/rr-sairohith-vennu/webdiff-comparison-tool.git
cd webdiff-comparison-tool

# 2. Install dependencies
npm install

# 3. Install Playwright browsers
npx playwright install chromium

# 4. Start the server
npm start

# 5. Open in browser
open http://localhost:4000
\`\`\`

### Using Deployed Version

Just visit: **https://1-summer-sea-3563.fly.dev**

---

## 📖 Usage Guide

### Basic Comparison (Public URLs)

1. **Enter URLs**
   \`\`\`
   URL 1: https://example.com
   URL 2: https://example.org
   \`\`\`

2. **Click "Compare Now"**

3. **Wait 15-25 seconds**

4. **View Results** - See screenshots with red boxes!

### Authenticated Pages (Rakuten QA1/Preview)

For pages that require login (ebtoken URLs):

1. **Extract Cookies from Browser**
   - Press \`F12\` to open DevTools
   - Go to **Console** tab
   - Paste and run:
   \`\`\`javascript
   copy(JSON.stringify(
     document.cookie.split('; ').map(cookie => {
       const [name, value] = cookie.split('=');
       return {
         name: name,
         value: value,
         domain: '.rakuten.com',
         path: '/'
       };
     })
   ))
   \`\`\`
   - Cookies are now copied to clipboard!

2. **Paste Cookies in WebDiff**
   - Enter your QA1/Preview URLs
   - Paste cookies in the 🍪 field
   - Click "Compare Now"

### Button State Comparison

To compare different tabs/states:

\`\`\`
URL 1: https://qa1-www.rakuten.com/account/activity
URL 2: https://qa1-www.rakuten.com/account/activity
Buttons: Pending, Confirmed, Payments
\`\`\`

This will compare:
- Default view
- After clicking "Pending"
- After clicking "Confirmed"
- After clicking "Payments"

---

## 📁 Project Structure

\`\`\`
webdiff-comparison-tool/
├── server.js                 # Main backend (1700+ lines)
│   ├── Express server
│   ├── UIComparisonEngine class
│   ├── Playwright automation
│   └── Image processing with Sharp
│
├── public/
│   └── index.html           # Frontend UI (900+ lines)
│       ├── Form inputs
│       ├── Socket.io client
│       └── Results display
│
├── screenshots/             # Generated screenshots (local)
├── results/                 # Comparison results (JSON)
│
├── package.json             # Dependencies
├── fly.toml                 # Fly.io configuration
├── Dockerfile               # Docker container setup
│
├── .github/
│   └── workflows/
│       └── fly-deploy.yml   # Auto-deployment
│
└── README.md                # This file!
\`\`\`

---

## 🔧 Configuration

### Environment Variables

\`\`\`bash
# Port (default: 4000)
PORT=4000

# Fly.io deployment
FLY_APP_NAME=1-summer-sea-3563
\`\`\`

### Fly.io Settings (fly.toml)

\`\`\`toml
# Persistent storage for screenshots
[mounts]
  source = "webdiff_data"
  destination = "/app/data"
  initial_size = "3gb"

# Server configuration
[http_service]
  internal_port = 4000
  force_https = true
  min_machines_running = 0  # Auto-sleep when idle
\`\`\`

---

## 🔍 How Cookie Authentication Works

**Problem:** Rakuten URLs with \`ebtoken\` are IP-restricted. They work locally but fail on Fly.io because Fly.io uses a different IP.

**Solution:** Use session cookies!

### Why Cookies Work:

\`\`\`
WITHOUT COOKIES (Fails):
┌─────────────┐         ┌─────────────┐
│  Fly.io IP  │────────→│  Rakuten    │
│ 66.241.x.x  │  ebtoken │  Server     │
└─────────────┘         └─────────────┘
                             ↓
                        ❌ "Wrong IP!"

WITH COOKIES (Works):
┌─────────────┐         ┌─────────────┐
│  Fly.io IP  │────────→│  Rakuten    │
│ + Cookies 🍪│  ebtoken │  Server     │
└─────────────┘         └─────────────┘
                             ↓
                        ✅ "Valid session!"
\`\`\`

Cookies prove your identity regardless of IP address!

---

## 🤖 GitHub Actions CI/CD Integration

Want to run visual comparisons automatically in your CI/CD pipeline? Here's how!

### Setup GitHub Actions

Create \`.github/workflows/visual-regression.yml\`:

\`\`\`yaml
name: Visual Regression Testing

on:
  pull_request:
    branches: [ main, develop ]
  push:
    branches: [ main ]

jobs:
  visual-diff:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run Visual Comparison
        env:
          WEBDIFF_URL: https://1-summer-sea-3563.fly.dev
          # Store Rakuten cookies as GitHub secrets
          RAKUTEN_COOKIES: \${{ secrets.RAKUTEN_COOKIES }}
        run: |
          # Compare Production vs Preview
          RESPONSE=\$(curl -X POST \\
            "\$WEBDIFF_URL/api/compare" \\
            -H "Content-Type: application/json" \\
            -d "{
              \\"url1\\": \\"https://www.rakuten.com/account/activity\\",
              \\"url2\\": \\"https://preview-www.rakuten.com/account/activity\\",
              \\"cookies\\": \$RAKUTEN_COOKIES
            }")

          # Parse results
          DIFFERENCES=\$(echo \$RESPONSE | jq -r '.result.comparisons[0].differences | length')
          echo "Found \$DIFFERENCES visual differences"

          # Fail if critical differences found
          CRITICAL=\$(echo \$RESPONSE | jq -r '[.result.comparisons[0].differences[] | select(.severity=="high")] | length')

          if [ "\$CRITICAL" -gt 0 ]; then
            echo "❌ Found \$CRITICAL critical visual differences!"
            echo \$RESPONSE | jq -r '.result.comparisons[0].differences[] | select(.severity=="high")'
            exit 1
          else
            echo "✅ No critical visual differences detected"
          fi

      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const comment = \`## 🎯 Visual Regression Results
            
            **Status:** \${{ job.status == 'success' ? '✅ Passed' : '❌ Failed' }}
            
            View comparison at: https://1-summer-sea-3563.fly.dev
            \`;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
\`\`\`

### Add Secrets to GitHub

1. Go to **GitHub Repo** → **Settings** → **Secrets and variables** → **Actions**
2. Add secret: \`RAKUTEN_COOKIES\`
3. Value: Your cookies JSON from Console
   \`\`\`json
   [{"name":"__adroll","value":"...","domain":".rakuten.com","path":"/"}]
   \`\`\`

---

## 🎯 Use Cases

### 1. QA Testing
Compare Production vs Preview before deploying:
\`\`\`
URL 1: https://www.rakuten.com/account
URL 2: https://preview-www.rakuten.com/account
\`\`\`

### 2. A/B Testing
Compare different variants:
\`\`\`
URL 1: https://www.site.com?variant=A
URL 2: https://www.site.com?variant=B
\`\`\`

### 3. Cross-Environment Validation
Ensure QA1 matches Production:
\`\`\`
URL 1: https://qa1-www.rakuten.com/page
URL 2: https://www.rakuten.com/page
\`\`\`

---

## 📊 Performance

**Typical Comparison:**
- 2 URLs (default view only)
- ~200 elements extracted per page
- ~15-25 seconds total time

**Breakdown:**
- Browser launch: 3-5s
- Page load: 5-10s
- Element extraction: 2-3s
- Comparison: 1-2s
- Screenshots: 2-3s
- Image processing: 1-2s

---

## ⚠️ Known Limitations

1. **Position-based matching** - Uses 200px threshold for similarity
2. **Layout shifts** - May cause false positives
3. **No color change detection** - Only compares text/position/size
4. **Single comparison at a time** - No parallel processing
5. **Cookie expiration** - Session cookies typically last hours/days

---

## 🐛 Troubleshooting

### Issue: Screenshots show "406 Not Acceptable"
**Solution:** Add session cookies in the 🍪 field

### Issue: "Only 2 elements extracted"
**Cause:** Playwright can't see page content (login/error page)
**Fix:** Add session cookies for authenticated pages

### Issue: "No differences found" but changes exist
**Cause:** Changes are too small (< 200px position threshold)
**Fix:** Verify elements are visible and not hidden

---

## 📝 API Documentation

### POST /api/compare

**Request:**
\`\`\`json
{
  "url1": "https://prod.com/page",
  "url2": "https://preview.com/page",
  "clickAction": "Pending,Confirmed",
  "cookies": [
    {
      "name": "sessionId",
      "value": "abc123",
      "domain": ".site.com",
      "path": "/"
    }
  ]
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "result": {
    "comparisons": [{
      "screenshots": {
        "highlighted": {
          "url1": "screenshots/prod_123_highlighted.png",
          "url2": "screenshots/preview_123_highlighted.png"
        }
      },
      "differences": [
        {
          "category": "Currency Amount Changed",
          "severity": "high",
          "url1Value": "\$69.42",
          "url2Value": "\$16.87"
        }
      ],
      "summary": {
        "totalDifferences": 29
      }
    }]
  }
}
\`\`\`

---

## 📜 License

MIT License - Feel free to use this for your projects!

---

## 🙏 Acknowledgments

Built with:
- [Playwright](https://playwright.dev/) - Browser automation
- [Sharp](https://sharp.pixelplumbing.com/) - Image processing
- [Express.js](https://expressjs.com/) - Web framework
- [Socket.io](https://socket.io/) - Real-time communication
- [Fly.io](https://fly.io/) - Deployment platform

---

## 📞 Support

- **Issues:** https://github.com/rr-sairohith-vennu/webdiff-comparison-tool/issues
- **Live Demo:** https://1-summer-sea-3563.fly.dev

---

**Made with ❤️ for QA Engineers and Developers**

Stop manually comparing pages! Let WebDiff do it for you! 🚀
