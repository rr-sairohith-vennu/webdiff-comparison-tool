# WebDiff - Complete Workflow Diagram

## 🎯 Architecture Overview

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Browser   │◄───────►│   Server    │◄───────►│  Playwright │
│  (Frontend) │         │  (Backend)  │         │  (Browsers) │
└─────────────┘         └─────────────┘         └─────────────┘
      │                       │                        │
   index.html            server.js              Chromium x2
   Socket.io             Express.js             (Headless)
   JavaScript            Socket.io
                         Sharp (Images)
```

---

## 🔄 Complete Flow (Step by Step)

### **STEP 1: User Input**
```
┌──────────────────────────────────────┐
│          USER BROWSER                │
│  http://localhost:4000               │
├──────────────────────────────────────┤
│                                      │
│  📝 URL 1: https://prod.com/page     │
│  📝 URL 2: https://preview.com/page  │
│  📝 Buttons: Pending, Confirmed      │
│                                      │
│       [🚀 Compare Now]               │
└──────────────────────────────────────┘
           │
           │ HTTP POST /api/compare
           │ { url1, url2, clickAction }
           ▼
```

---

### **STEP 2: Backend Receives Request**
```
┌──────────────────────────────────────┐
│        EXPRESS SERVER                │
│        (server.js)                   │
├──────────────────────────────────────┤
│                                      │
│  app.post('/api/compare')            │
│    ↓                                 │
│  new UIComparisonEngine()            │
│    ↓                                 │
│  engine.run()                        │
│                                      │
└──────────────────────────────────────┘
           │
           │ Initialize comparison
           ▼
```

---

### **STEP 3: Launch Browsers (Playwright)**
```
┌─────────────────────────────────────────────┐
│         PLAYWRIGHT                          │
│         (Browser Automation)                │
├─────────────────────────────────────────────┤
│                                             │
│  const browser = await chromium.launch({    │
│    headless: true                           │
│  })                                         │
│                                             │
│  Browser 1 ──► Opens URL 1 (Production)     │
│  Browser 2 ──► Opens URL 2 (Preview)        │
│                                             │
└─────────────────────────────────────────────┘
           │
           │ Socket.io emit: "Launching browsers..."
           ▼
┌──────────────────────────────────────┐
│   USER BROWSER (Real-time Update)   │
│   Progress: 🔄 Launching browsers... │
└──────────────────────────────────────┘
```

---

### **STEP 4: Load Pages & Handle Popups**
```
┌─────────────────────────────────────────────┐
│         BROWSER 1 (Prod)                    │
├─────────────────────────────────────────────┤
│  page1.goto(url1)                           │
│    ↓                                        │
│  ⚠️  Popup detected!                        │
│    ↓                                        │
│  Click close button                         │
│    ↓                                        │
│  🔍 Check URL changed?                      │
│    ↓                                        │
│  ❌ Yes! Redirected to /verify              │
│    ↓                                        │
│  🔄 Navigate back to original URL           │
│    ↓                                        │
│  ✅ Correct page loaded                     │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│         BROWSER 2 (Preview)                 │
├─────────────────────────────────────────────┤
│  page2.goto(url2)                           │
│    ↓                                        │
│  ✅ No popup detected                        │
│    ↓                                        │
│  ✅ Page loaded successfully                │
└─────────────────────────────────────────────┘

           │
           │ Socket.io emit: "Pages loaded..."
           ▼
```

---

### **STEP 5: Extract DOM Elements**
```
┌─────────────────────────────────────────────┐
│     ELEMENT EXTRACTION (Both Pages)         │
├─────────────────────────────────────────────┤
│                                             │
│  page.evaluate(() => {                      │
│    const elements = [];                     │
│                                             │
│    // Extract buttons                      │
│    document.querySelectorAll('button')      │
│      .forEach(btn => {                      │
│        elements.push({                      │
│          text: btn.innerText,               │
│          x: btn.getBoundingClientRect().x,  │
│          y: btn.getBoundingClientRect().y,  │
│          width: btn.offsetWidth,            │
│          height: btn.offsetHeight,          │
│          tagName: 'button'                  │
│        })                                   │
│      });                                    │
│                                             │
│    // Extract links, images, text...       │
│    return elements;                         │
│  })                                         │
│                                             │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│            RESULTS                          │
├─────────────────────────────────────────────┤
│  URL 1: 340 elements                        │
│  [                                          │
│    { text: "Rakuten Card Rewards",          │
│      x: 150, y: 80, width: 200, height: 40, │
│      tagName: "button" },                   │
│    { text: "$69.42",                        │
│      x: 300, y: 150, ...},                  │
│    ...                                      │
│  ]                                          │
│                                             │
│  URL 2: 469 elements                        │
│  [                                          │
│    { text: "rakuten card rewards",          │
│      x: 180, y: 85, ...},                   │
│    { text: "$16.87",                        │
│      x: 300, y: 150, ...},                  │
│    ...                                      │
│  ]                                          │
└─────────────────────────────────────────────┘
```

---

### **STEP 6: Match Elements (Algorithm)**
```
┌─────────────────────────────────────────────┐
│        MATCHING ALGORITHM                   │
├─────────────────────────────────────────────┤
│                                             │
│  For each element in URL1:                  │
│    ↓                                        │
│  1. Find nearby elements in URL2            │
│     (within 200px radius)                   │
│    ↓                                        │
│  2. Calculate similarity score              │
│     ┌─────────────────────────────┐        │
│     │ • Text match: 50% weight    │        │
│     │ • Position: 30% weight      │        │
│     │ • Size: 20% weight          │        │
│     └─────────────────────────────┘        │
│    ↓                                        │
│  3. If score > 60% → MATCHED ✅             │
│     If score < 60% → REMOVED ❌             │
│                                             │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│          EXAMPLE MATCHING                   │
├─────────────────────────────────────────────┤
│                                             │
│  URL1: "Rakuten Card Rewards" at (150,80)   │
│           ↓                                 │
│  Search URL2 within (0-350, 0-280)          │
│           ↓                                 │
│  Found: "rakuten card rewards" at (180,85)  │
│           ↓                                 │
│  Similarity:                                │
│    Text: 90% (case different)               │
│    Position: 30% (32px away)                │
│    Size: 20% (similar)                      │
│    Total: 92% ✅ MATCHED                    │
│                                             │
│  ─────────────────────────────              │
│                                             │
│  URL1: "$69.42" at (300,150)                │
│           ↓                                 │
│  Found: "$16.87" at (300,150)               │
│           ↓                                 │
│  Similarity:                                │
│    Text: 0% (different)                     │
│    Position: 100% (exact same)              │
│    Size: 100% (same)                        │
│    Total: 65% ✅ MATCHED                    │
│           ↓                                 │
│  But text different + currency detected     │
│  → "Currency Amount Changed" 💰             │
│                                             │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│            MATCHING RESULTS                 │
├─────────────────────────────────────────────┤
│  • Matched: 59 elements                     │
│  • Unmatched in URL1: 281 (REMOVED)         │
│  • Unmatched in URL2: 410 (ADDED)           │
│  • Total Differences: 390                   │
└─────────────────────────────────────────────┘
```

---

### **STEP 7: Categorize Differences**
```
┌─────────────────────────────────────────────┐
│       CATEGORIZATION LOGIC                  │
├─────────────────────────────────────────────┤
│                                             │
│  If (element in URL1 && not in URL2):       │
│    → Type: "Content Removed"                │
│    → Severity: "high"                       │
│    → url1Value: "Rakuten Card Rewards"      │
│    → url2Value: "Not present"               │
│                                             │
│  If (element in URL2 && not in URL1):       │
│    → Type: "Content Added"                  │
│    → Severity: "high"                       │
│    → url1Value: "Not present"               │
│    → url2Value: "manage rakuten card"       │
│                                             │
│  If (matched && text has $XX.XX):           │
│    → Type: "Content"                        │
│    → Category: "Currency Amount Changed"    │
│    → Severity: "high"                       │
│    → url1Value: "$69.42"                    │
│    → url2Value: "$16.87"                    │
│                                             │
└─────────────────────────────────────────────┘
```

---

### **STEP 8: Take Screenshots**
```
┌─────────────────────────────────────────────┐
│         SCREENSHOT CAPTURE                  │
├─────────────────────────────────────────────┤
│                                             │
│  await page1.screenshot({                   │
│    path: 'screenshots/prod_123.png',        │
│    fullPage: true                           │
│  })                                         │
│    ↓                                        │
│  ✅ URL1 screenshot saved (CLEAN)           │
│                                             │
│  await page2.screenshot({                   │
│    path: 'screenshots/preview_123.png',     │
│    fullPage: true                           │
│  })                                         │
│    ↓                                        │
│  ✅ URL2 screenshot saved (CLEAN)           │
│                                             │
└─────────────────────────────────────────────┘

           │
           │ Socket.io emit: "Taking screenshots..."
           ▼
```

---

### **STEP 9: Draw Red Boxes (Sharp)**
```
┌─────────────────────────────────────────────┐
│        IMAGE PROCESSING (Sharp)             │
├─────────────────────────────────────────────┤
│                                             │
│  const image = sharp('preview_123.png');    │
│                                             │
│  For each difference:                       │
│    ↓                                        │
│    const svg = `                            │
│      <svg>                                  │
│        <rect x="${x}" y="${y}"              │
│              width="${w}" height="${h}"     │
│              stroke="red"                   │
│              stroke-width="3"               │
│              fill="none"/>                  │
│      </svg>                                 │
│    `;                                       │
│    ↓                                        │
│    image.composite([{                       │
│      input: Buffer.from(svg),               │
│      top: 0, left: 0                        │
│    }]);                                     │
│                                             │
│  image.toFile('preview_123_highlighted.png');│
│    ↓                                        │
│  ✅ Highlighted screenshot saved            │
│                                             │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│            VISUAL RESULT                    │
├─────────────────────────────────────────────┤
│                                             │
│  📷 prod_123.png (clean)                    │
│  📷 preview_123_highlighted.png             │
│      ↑                                      │
│      Contains RED BOXES around:             │
│      • "rakuten card rewards" button        │
│      • "$16.87" (currency change)           │
│      • "mabubasha $42.48" (new content)     │
│      • All 390 differences                  │
│                                             │
└─────────────────────────────────────────────┘
```

---

### **STEP 10: Send Results to Frontend**
```
┌─────────────────────────────────────────────┐
│        BUILD RESPONSE (JSON)                │
├─────────────────────────────────────────────┤
│                                             │
│  const result = {                           │
│    timestamp: 1729025678000,                │
│    url1: "https://prod.com/page",           │
│    url2: "https://preview.com/page",        │
│    totalDifferences: 390,                   │
│    summary: {                               │
│      bySeverity: {                          │
│        high: 390,                           │
│        medium: 0,                           │
│        low: 0                               │
│      }                                      │
│    },                                       │
│    differences: [                           │
│      {                                      │
│        type: "Content",                     │
│        category: "Currency Amount Changed", │
│        severity: "high",                    │
│        url1Value: "$69.42",                 │
│        url2Value: "$16.87"                  │
│      },                                     │
│      // ... 389 more                        │
│    ],                                       │
│    screenshots: {                           │
│      url1: "screenshots/prod_123.png",      │
│      url2: "screenshots/preview_123.png",   │
│      highlighted: {                         │
│        url2: "preview_123_highlighted.png"  │
│      }                                      │
│    }                                        │
│  };                                         │
│                                             │
│  res.json({ success: true, result });       │
│                                             │
└─────────────────────────────────────────────┘

           │
           │ HTTP Response (JSON)
           ▼
```

---

### **STEP 11: Display Results in Browser**
```
┌─────────────────────────────────────────────┐
│        USER BROWSER (index.html)            │
├─────────────────────────────────────────────┤
│                                             │
│  📊 Comparison Results                      │
│  ┌─────────────────────────────────────┐   │
│  │  390 Total Differences              │   │
│  │  390 High Priority                  │   │
│  │    0 Medium Priority                │   │
│  │    0 Low Priority                   │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  🖼️ Screenshots (Side by Side)              │
│  ┌─────────────┬─────────────┐             │
│  │  URL 1      │  URL 2      │             │
│  │  (Clean)    │  (Boxes) 🔴 │             │
│  └─────────────┴─────────────┘             │
│                                             │
│  📋 Detailed Differences (29 shown)         │
│  ┌─────────────────────────────────────┐   │
│  │ Content | Currency Changed | high   │   │
│  │ $69.42  → $16.87                    │   │
│  ├─────────────────────────────────────┤   │
│  │ Content | Content Added | high      │   │
│  │ Not present → rakuten card rewards  │   │
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack Deep Dive

### **Backend Technologies**
```
┌──────────────────────────────────────────┐
│  Node.js v22.20.0                        │
│  └─ JavaScript Runtime                   │
├──────────────────────────────────────────┤
│  Express.js v4.21.2                      │
│  └─ Web Server Framework                 │
│     • Handles HTTP requests              │
│     • Serves static files (index.html)   │
│     • API endpoint: /api/compare         │
├──────────────────────────────────────────┤
│  Socket.io v4.8.1                        │
│  └─ Real-time Communication              │
│     • Bidirectional event-based          │
│     • Progress updates to browser        │
│     • No polling needed                  │
├──────────────────────────────────────────┤
│  Playwright v1.56.0                      │
│  └─ Browser Automation                   │
│     • Launches Chromium headless         │
│     • Navigates to URLs                  │
│     • Extracts DOM elements              │
│     • Takes screenshots                  │
├──────────────────────────────────────────┤
│  Sharp v0.34.4                           │
│  └─ High-performance Image Processing    │
│     • Draws SVG overlays (red boxes)     │
│     • Composites images                  │
│     • Fast PNG manipulation              │
├──────────────────────────────────────────┤
│  Pixelmatch v7.1.0                       │
│  └─ Pixel-level Image Comparison         │
│     • (Not currently used in main flow)  │
├──────────────────────────────────────────┤
│  PNG.js v7.0.0                           │
│  └─ PNG Image Parser                     │
│     • Read/write PNG files               │
├──────────────────────────────────────────┤
│  Cheerio v1.0.0                          │
│  └─ HTML Parser (jQuery-like)            │
│     • Parse HTML structure               │
├──────────────────────────────────────────┤
│  Chalk v5.3.0                            │
│  └─ Terminal Styling                     │
│     • Colored console output             │
└──────────────────────────────────────────┘
```

### **Frontend Technologies**
```
┌──────────────────────────────────────────┐
│  Vanilla JavaScript (ES6+)               │
│  └─ No frameworks!                       │
│     • Fetch API for HTTP requests        │
│     • DOM manipulation                   │
│     • Event listeners                    │
├──────────────────────────────────────────┤
│  Socket.io Client                        │
│  └─ Receives real-time updates           │
│     • socket.on('progress', ...)         │
├──────────────────────────────────────────┤
│  CSS3                                    │
│  └─ Modern dark theme                    │
│     • Flexbox/Grid layouts               │
│     • Animations                         │
│     • Google Fonts (Inter)               │
└──────────────────────────────────────────┘
```

---

## 📊 Data Flow Summary

```
USER INPUT (URLs)
      ↓
EXPRESS SERVER (receives request)
      ↓
PLAYWRIGHT (launches 2 Chrome browsers)
      ↓
LOAD PAGES (handle popups, redirects)
      ↓
EXTRACT ELEMENTS (query DOM for all elements)
      ↓
MATCH ALGORITHM (compare 340 vs 469 elements)
      ↓
CATEGORIZE (removed/added/changed)
      ↓
TAKE SCREENSHOTS (full page PNG)
      ↓
DRAW RED BOXES (Sharp image processing)
      ↓
SEND RESULTS (JSON + screenshots)
      ↓
BROWSER DISPLAYS (side-by-side comparison)
```

---

## ⚡ Performance Breakdown

```
┌────────────────────────────────────────┐
│  Total Time: 15-25 seconds             │
├────────────────────────────────────────┤
│  1. Launch browsers      │ 3-5s        │
│  2. Load pages           │ 5-10s       │
│  3. Handle popups        │ 2-3s        │
│  4. Extract elements     │ 2-3s        │
│  5. Match elements       │ 1-2s        │
│  6. Take screenshots     │ 2-3s        │
│  7. Draw red boxes       │ 1-2s        │
│  8. Send results         │ <1s         │
└────────────────────────────────────────┘
```

---

## 🎯 Key Components

### **UIComparisonEngine (server.js)**
```javascript
class UIComparisonEngine {

  async run() {
    await this.initBrowser();        // Launch Playwright
    await this.loadPages();           // Load URLs
    await this.handlePopups();        // Close popups
    await this.extractElements();     // Get DOM elements
    const diffs = await this.compare(); // Match & categorize
    await this.takeScreenshots();     // Capture images
    await this.highlightDifferences(); // Draw boxes
    return results;                   // Return JSON
  }

  async comparePageElements(el1[], el2[]) {
    // Match elements by similarity
    // Return differences array
  }

}
```

---

## 🔐 Security & Constraints

```
┌────────────────────────────────────────┐
│  • Runs locally (localhost:4000)      │
│  • No external API calls               │
│  • No data stored externally           │
│  • No authentication required          │
│  • Screenshots saved locally           │
└────────────────────────────────────────┘
```

---

## 🎉 Summary

**This is how WebDiff works:**
1. User enters 2 URLs → Backend receives
2. Playwright launches 2 Chrome browsers → Loads pages
3. DOM elements extracted → Compared using math
4. Differences categorized → Screenshots taken
5. Sharp draws red boxes → Results sent to browser
6. User sees side-by-side comparison in 20 seconds!

**No AI. Just logic, math, and automation!** 🚀
