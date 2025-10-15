# WebDiff - Visual Comparison Tool
**Simple Documentation**

## 📋 Overview
WebDiff is a web-based tool that compares two URLs (Production vs Preview) and highlights visual differences. No AI - just pure logic!

---

## 🛠️ Tech Stack

### **Backend** (Node.js)
- **Express.js** - Web server (handles HTTP requests)
- **Socket.io** - Real-time progress updates to browser
- **Playwright** - Browser automation (launches Chrome headlessly)
- **Sharp** - Image processing (draws red boxes on screenshots)

### **Frontend** (Single HTML file)
- **Vanilla JavaScript** - No frameworks!
- **Socket.io Client** - Receives real-time updates
- **CSS** - Modern dark UI design

### **Dependencies** (package.json)
```json
{
  "playwright": "Browser automation",
  "express": "Web server",
  "socket.io": "Real-time communication",
  "sharp": "Image manipulation (draw boxes)",
  "pixelmatch": "Pixel-level image comparison",
  "pngjs": "PNG image handling",
  "chalk": "Colored console output",
  "cheerio": "HTML parsing",
  "node-fetch": "HTTP requests"
}
```

---

## 📁 Project Structure

```
webdiff/
├── server.js              # Main backend logic (1704 lines)
├── public/
│   └── index.html         # Frontend UI (884 lines)
├── package.json           # Dependencies
├── screenshots/           # Saved screenshots
├── results/               # Comparison results (JSON)
├── node_modules/          # Installed packages
└── README.md             # General info
```

---

## 🔄 How It Works (Flow)

### **1. User Action**
```
User enters:
- URL 1 (Production)
- URL 2 (Preview)
- Optional: Button clicks
↓
Clicks "Compare Now"
```

### **2. Backend Processing** (server.js)
```javascript
Step 1: Launch 2 browsers (Playwright)
  → browser1.goto(url1)
  → browser2.goto(url2)

Step 2: Handle popups
  → Find popup close buttons
  → Click to close
  → Check if redirect happened
  → Navigate back if needed

Step 3: Extract DOM elements (both pages)
  → All buttons, links, text, images
  → Store: { text, x, y, width, height }

Step 4: Match elements
  → For each element in URL1:
    → Find similar element in URL2
    → Calculate similarity (text + position + size)
    → If >60% match → MATCHED
    → Else → REMOVED or ADDED

Step 5: Take screenshots
  → Full page screenshot (both URLs)
  → Save as PNG

Step 6: Draw red boxes
  → Using Sharp library
  → Draw rectangle on differences
  → Save highlighted screenshot

Step 7: Send results to browser
  → Via Socket.io (real-time)
```

### **3. Frontend Display** (index.html)
```javascript
Receives results → Display:
- Total differences count
- Side-by-side screenshots
- Detailed differences table
- Severity badges (high/medium/low)
```

---

## 🧮 Comparison Algorithm (No AI!)

### **Element Matching Logic**
```javascript
function calculateSimilarity(element1, element2) {
  let score = 0;

  // 1. Text comparison (50% weight)
  if (element1.text === element2.text) {
    score += 0.5;
  }

  // 2. Position comparison (30% weight)
  distance = sqrt((x1-x2)² + (y1-y2)²);
  if (distance < 200px) {
    score += 0.3;
  }

  // 3. Size comparison (20% weight)
  if (width1 ≈ width2 && height1 ≈ height2) {
    score += 0.2;
  }

  return score; // 0.0 to 1.0
}
```

### **Categorization Logic**
```javascript
// Content Removed
If (element in URL1 && no match in URL2):
  → "Content Removed"
  → url1Value: "Rakuten Card Rewards"
  → url2Value: "Not present"

// Content Added
If (element in URL2 && no match in URL1):
  → "Content Added"
  → url1Value: "Not present"
  → url2Value: "manage rakuten card"

// Currency Changed
If (matched && both have $XX.XX):
  → "Currency Amount Changed"
  → url1Value: "$69.42"
  → url2Value: "$16.87"
```

---

## 🚀 How to Run

### **Installation**
```bash
npm install
```

### **Start Server**
```bash
npm start
# or
PORT=4000 npm start
```

### **Access**
```
http://localhost:4000
```

---

## 📊 Real-Time Updates (Socket.io)

### **Backend Sends:**
```javascript
socket.emit('progress', {
  event: 'status',
  message: 'Loading page...'
})
```

### **Frontend Receives:**
```javascript
socket.on('progress', (data) => {
  updateProgressBar(data.message);
})
```

**Progress Events:**
- "Launching browsers..."
- "Loading pages..."
- "Extracting elements..."
- "Comparing..."
- "Taking screenshots..."
- "Complete!"

---

## 🖼️ Image Processing (Sharp)

### **Drawing Red Boxes**
```javascript
const image = sharp('screenshot.png');

// For each difference:
image.composite([{
  input: Buffer.from(`
    <svg>
      <rect x="${x}" y="${y}"
            width="${w}" height="${h}"
            stroke="red" stroke-width="3"
            fill="none"/>
    </svg>
  `),
  top: 0,
  left: 0
}]);

image.toFile('highlighted.png');
```

---

## 📈 Performance

**Typical Comparison:**
- 2 URLs, default view only
- ~340 elements in URL1
- ~469 elements in URL2
- ~59 matched elements
- ~390 differences found
- **Total time: 15-25 seconds**

**Breakdown:**
- Browser launch: 3-5s
- Page load: 5-10s
- Element extraction: 2-3s
- Matching: 1-2s
- Screenshots: 2-3s
- Image processing: 1-2s

---

## 🔧 Key Features

### ✅ **Working Features**
- Side-by-side comparison
- Real-time progress updates
- Popup detection & handling
- Redirect detection (fixes homepage issue)
- Button click simulation
- Currency change detection
- Screenshot highlighting
- Detailed differences table
- Export results (JSON)

### ⚠️ **Known Limitations**
- Position-based matching (200px threshold)
- False positives when layouts shift
- Cannot detect color changes
- No baseline/history management
- Single comparison at a time

---

## 🔑 Key Technologies Explained

### **1. Playwright**
```javascript
// Launches headless Chrome
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(url);
```

### **2. Socket.io**
```javascript
// Real-time bidirectional communication
io.on('connection', (socket) => {
  socket.emit('progress', { message: 'Started!' });
});
```

### **3. Sharp**
```javascript
// Image manipulation
await sharp('input.png')
  .composite([{ input: svgBuffer }])
  .toFile('output.png');
```

### **4. Express**
```javascript
// Web server
app.post('/api/compare', async (req, res) => {
  const result = await comparePages(url1, url2);
  res.json(result);
});
```

---

## 🎯 Current Status

**Version:** 1.0.0
**Status:** ✅ Working (as of Oct 2024)
**Port:** 4000
**Environment:** Development

### **Recent Fixes:**
- ✅ Popup redirect detection
- ✅ Navigation back to correct page
- ✅ Both prod & preview load correctly

### **Comparison Accuracy:**
- Good at: Currency changes, button text changes
- Struggles with: False positives from layout shifts

---

## 📝 Example Output

```json
{
  "timestamp": 1729025678000,
  "totalDifferences": 29,
  "differences": [
    {
      "type": "Content",
      "category": "Currency Amount Changed",
      "severity": "high",
      "url1Value": "$69.42",
      "url2Value": "$16.87"
    },
    {
      "type": "Content",
      "category": "Content Added",
      "severity": "high",
      "url1Value": "Not present",
      "url2Value": "rakuten card rewards"
    }
  ],
  "screenshots": {
    "url1": "screenshots/prod_123456.png",
    "url2": "screenshots/preview_123456_highlighted.png"
  }
}
```

---

## 🔄 Workflow Summary

```
USER                    BACKEND                     BROWSER
  |                        |                          |
  |--[Compare Button]----->|                          |
  |                        |--[Launch Chrome]-------->|
  |<--[Progress: Loading]--|                          |
  |                        |<--[Page Loaded]----------|
  |                        |--[Extract Elements]----->|
  |                        |<--[340 elements]---------|
  |                        |                          |
  |                        |--[Compare Logic]-------->|
  |                        |<--[390 differences]------|
  |                        |                          |
  |                        |--[Take Screenshot]------>|
  |                        |<--[screenshot.png]-------|
  |                        |                          |
  |                        |--[Draw Boxes]----------->|
  |<--[Show Results]-------|<--[highlighted.png]------|
```

---

## 🎉 That's It!

**This tool:**
- Compares 2 URLs
- Finds differences using logic (no AI)
- Shows results in ~20 seconds
- Runs on localhost:4000

**Simple, fast, and effective!** 🚀
