# 🤖 UI Comparison Web Application

An interactive web application for comparing UI between any two URLs with AI-powered analysis and visual screenshots.

## 🚀 Quick Start

```bash
# Install dependencies (if not already done)
npm install

# Start the server
npm start
```

The application will be available at: **http://localhost:3000**

## ✨ Features

### 1. **Interactive Web Interface**
- Beautiful, responsive UI
- Drop any two URLs to compare
- Real-time progress updates
- Side-by-side screenshot comparison

### 2. **Smart Comparison Engine**
- Extracts and compares:
  - Page titles
  - Headings (H1-H6)
  - Visible text content
  - Buttons and interactive elements
  - Links
  - Forms
  - Images
- Categorizes differences by type (Content, Interactive, Text)
- Prioritizes by severity (High, Medium, Low)

### 3. **Visual Diff Screenshots**
- Full-page screenshots of both URLs
- Side-by-side visual comparison
- Perfect for spotting layout changes

### 4. **Quick Presets**
- Pre-configured Rakuten URLs with auth tokens
- One-click comparison for:
  - Homepage
  - Account page
  - Cash Back Activity page

## 📖 How to Use

### Method 1: Web Interface (Recommended)

1. **Open your browser**: Navigate to http://localhost:3000

2. **Enter URLs**:
   - Paste the first URL in "URL 1 (Production)"
   - Paste the second URL in "URL 2 (Preview/Staging)"
   - Add optional description of what you're comparing

3. **Click "Compare Now"**: Wait 10-30 seconds for analysis

4. **View Results**:
   - Summary statistics (total differences, severity breakdown)
   - Side-by-side screenshots
   - Detailed difference table

### Method 2: Quick Presets

Click one of the preset buttons for instant Rakuten comparisons:
- 🏠 **Homepage** - Compares main landing pages
- 👤 **Account** - Compares account dashboards
- 💰 **Cash Back Activity** - Compares transaction history

### Method 3: API (For Automation)

```bash
curl -X POST http://localhost:3000/api/compare \
  -H "Content-Type: application/json" \
  -d '{
    "url1": "https://www.rakuten.com?ebtoken=...",
    "url2": "https://preview-www.rakuten.com?ebtoken=...",
    "description": "Compare homepage"
  }'
```

## 🎯 Use Cases

### QA Testing
- Compare staging vs production before deployment
- Verify new features are visible
- Check for unintended changes

### A/B Testing
- Compare different versions of pages
- Analyze layout differences
- Track content changes

### Bug Detection
- Spot missing elements
- Find broken layouts
- Identify text mismatches

### Regression Testing
- Ensure UI consistency across updates
- Automated visual regression checks
- Historical comparison tracking

## 📊 Understanding Results

### Difference Types

| Type | Description | Example |
|------|-------------|---------|
| **Content** | Text and heading changes | New heading added, paragraph removed |
| **Interactive** | Button, form, and link changes | New button added, form field changed |
| **Text** | Visible text content changes | Label text updated, description modified |

### Severity Levels

| Level | Description | When to Worry |
|-------|-------------|---------------|
| **High** | Critical UI changes | Buttons missing, forms broken, major layout shifts |
| **Medium** | Notable changes | Headings changed, sections reordered |
| **Low** | Minor tweaks | Text updated, small content additions |

## 🛠️ Technical Architecture

### Backend (server.js)
- **Express.js** server
- **Playwright** for browser automation
- **REST API** endpoints for comparison
- Automated screenshot capture
- JSON result storage

### Frontend (public/index.html)
- Vanilla JavaScript (no frameworks needed)
- Responsive CSS Grid layout
- Real-time progress indicators
- Beautiful gradient UI design

### Data Flow
```
User Input → Server → Playwright → Capture Pages → Compare Data
                                                          ↓
User View ← Results Display ← API Response ← Generate Report
```

## 📁 Project Structure

```
webdiff/
├── server.js              # Express server & comparison engine
├── public/
│   └── index.html         # Frontend web interface
├── screenshots/           # Generated screenshots
├── results/               # Comparison results (JSON)
├── package.json           # Dependencies
└── README_WebApp.md       # This file
```

## 🔧 Configuration

### Authentication
The default auth token is embedded in the HTML. To update:

1. Open `public/index.html`
2. Find the `ebtoken` constant
3. Replace with your fresh token

### Port
Default port is 3000. To change:

1. Open `server.js`
2. Modify `const PORT = 3000;`
3. Restart the server

## 📝 API Reference

### POST /api/compare
Compare two URLs

**Request:**
```json
{
  "url1": "https://example.com",
  "url2": "https://staging.example.com",
  "description": "Optional description"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "timestamp": 1696789012345,
    "screenshots": {
      "url1": "screenshots/1696789012345_url1.png",
      "url2": "screenshots/1696789012345_url2.png"
    },
    "differences": [...],
    "summary": {
      "totalDifferences": 5,
      "byType": { "Content": 2, "Interactive": 3 },
      "bySeverity": { "high": 1, "medium": 2, "low": 2 }
    }
  }
}
```

### GET /api/results
List all past comparisons

**Response:**
```json
[
  {
    "id": "1696789012345",
    "timestamp": 1696789012345,
    "url1": "https://example.com",
    "url2": "https://staging.example.com",
    "totalDifferences": 5
  }
]
```

### GET /api/results/:id
Get specific comparison result

## 🚦 Troubleshooting

### Server won't start
```bash
# Check if port 3000 is already in use
lsof -i :3000

# Kill existing process if needed
kill -9 <PID>

# Restart
npm start
```

### Comparison fails
- Verify both URLs are accessible
- Check auth tokens are valid
- Ensure Playwright browsers are installed: `npx playwright install`

### Screenshots are blank
- URLs may require authentication
- Page may have blocking content
- Try increasing wait timeout in `capturePageData()`

## 🎨 Customization

### Styling
Edit `public/index.html` - all CSS is inline for easy customization

### Comparison Logic
Edit `compareData()` in `server.js` to add custom comparison rules

### Screenshot Size
Modify viewport in `server.js`:
```javascript
viewport: { width: 1920, height: 1080 }
```

## 🌟 Future Enhancements

Potential features to add:
- [ ] AI-powered difference explanation
- [ ] Export results to PDF
- [ ] Screenshot diff highlighting
- [ ] Historical trend analysis
- [ ] Slack/email notifications
- [ ] Multi-page batch comparison
- [ ] Mobile viewport testing
- [ ] Accessibility audits

## 📞 Support

- **Issues**: Report bugs or feature requests
- **Documentation**: Check code comments in server.js
- **Examples**: See quick presets in web UI

---

**Created by:** UICompareBot
**Version:** 1.0.0
**Last Updated:** October 7, 2025

🎯 **Start comparing:** http://localhost:3000
