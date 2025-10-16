# Percy Visual Testing Script

Automated visual regression testing using Percy API with multi-state support (button clicks, popups, modals).

## Features

- **Percy Integration** - Uses Percy's official API for visual comparisons
- **Multi-State Testing** - Automatically clicks buttons/tabs and captures each state
- **Popup Handling** - Detects and closes popups, modals, banners automatically
- **Baseline Management** - First run creates baseline, subsequent runs compare
- **Playwright Automation** - Reliable browser automation for screenshots
- **Local Screenshots** - Saves local copies for quick reference

## Prerequisites

1. **Percy Account** - Sign up at [percy.io](https://percy.io)
2. **Percy Token** - Get from [Percy Settings](https://percy.io/settings)
3. **Node.js** - Version 18 or higher

## Quick Start

### 1. Installation

```bash
cd percy-visual-testing
npm install
```

### 2. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env and add your configuration:
# PERCY_TOKEN=your_percy_token_here
# TEST_URL=https://your-website.com
# BUTTONS=Tab1,Tab2,Tab3
```

Example `.env` file:
```bash
PERCY_TOKEN=abc123xyz456
TEST_URL=https://dashboard.example.com
BUTTONS=All,Pending,Completed
PERCY_PROJECT=my-dashboard
```

### 3. Run First Test (Create Baseline)

```bash
npm start
```

No need to export variables - the script automatically loads from `.env` file!

This will:
1. Launch Chromium browser
2. Navigate to your URL
3. Handle any popups/modals
4. Take screenshot of default view
5. Click each button and take screenshots
6. Send all snapshots to Percy
7. Save local screenshots in `screenshots/` folder

### 4. Approve Baseline in Percy

1. Go to [percy.io](https://percy.io)
2. Open your project
3. Review the snapshots
4. Click **"Approve"** to set as baseline

### 5. Run Comparison Test

```bash
npm start
```

Percy will now compare new snapshots against your approved baseline and highlight any visual differences.

## Configuration

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PERCY_TOKEN` | Yes | Your Percy API token | `abc123...` |
| `TEST_URL` | Yes | URL to test | `https://example.com` |
| `BUTTONS` | No | Buttons to click (comma-separated) | `All,Pending,Confirmed` |
| `PERCY_PROJECT` | No | Project name | `my-app` |

### Example Configuration

**Test single page:**

Edit your `.env` file:
```bash
PERCY_TOKEN=your_token
TEST_URL=https://example.com
```

Then run:
```bash
npm start
```

**Test with multiple button states:**

Edit your `.env` file:
```bash
PERCY_TOKEN=your_token
TEST_URL=https://dashboard.example.com
BUTTONS=All Tasks,Pending,Completed,Archived
```

Then run:
```bash
npm start
```

## How It Works

### Workflow

1. **Initialize**
   - Start Percy CLI server
   - Launch Playwright browser

2. **Default View**
   - Navigate to URL
   - Wait for page load (networkidle)
   - Detect and close popups
   - Capture Percy snapshot

3. **Button States** (if configured)
   - For each button:
     - Reload page
     - Click button
     - Close any new popups
     - Capture Percy snapshot

4. **Percy Processing**
   - Percy receives all snapshots
   - First run: Creates baseline
   - Subsequent runs: Compares against baseline
   - Highlights visual differences

### Popup Detection

Automatically detects and closes:
- Modals (`[role="dialog"]`, `.modal`)
- Popups (`.popup`, `#popup`)
- Banners (`[class*="banner"]`)
- Cookie notices (`[class*="cookie"]`)
- ARIA modals (`[aria-modal="true"]`)

## Output

### Console Output

```
╔════════════════════════════════════════╗
║   Percy Visual Testing Script v1.0    ║
╚════════════════════════════════════════╝

📋 Configuration:
   URL: https://example.com
   Buttons: All, Pending, Confirmed
   Project: my-project

🚀 Starting Percy CLI server...
✅ Percy server started successfully

🌐 Launching browser...
✅ Browser launched

📍 Navigating to: https://example.com
✅ Page loaded
🔍 Checking for popups/modals...
✅ Closed popup: [role="dialog"]

📸 Taking Percy snapshot: "Default View - my-project"
💾 Local screenshot saved: screenshots/Default_View_my_project.png
✅ Percy snapshot captured: "Default View - my-project"

🖱️  Clicking button: "All"
✅ Button "All" clicked
📸 Taking Percy snapshot: "All - my-project"
✅ Percy snapshot captured: "All - my-project"

✅ Visual testing completed successfully!

📊 View results at: https://percy.io

💡 Next steps:
   1. Go to Percy dashboard
   2. Review and approve the baseline snapshots
   3. Run this script again to compare against baseline
```

### Local Screenshots

Screenshots are saved in `screenshots/` directory:
- `Default_View_my_project.png`
- `All_my_project.png`
- `Pending_my_project.png`

## Troubleshooting

### Error: PERCY_TOKEN not set

```bash
❌ ERROR: PERCY_TOKEN environment variable not set!
```

**Solution:** Add your Percy token to `.env` file:
```bash
PERCY_TOKEN=your_percy_token_here
```

### Error: Button not found

```bash
⚠️  Button "Submit" not found, skipping...
```

**Solution:**
- Check button text matches exactly (case-sensitive)
- Ensure button appears after page load
- Button might be in an iframe (not currently supported)

### Error: Percy server timeout

```bash
❌ Percy server did not start in time
```

**Solution:**
- Check internet connection
- Verify PERCY_TOKEN is valid
- Try running `npx percy --version` to verify installation

### Error: Page load timeout (FIXED in v1.1)

```bash
❌ Failed to load page: Navigation timeout
```

**This has been fixed!** The script now:
- ✅ Uses 120-second timeout for authenticated pages
- ✅ Falls back to domcontentloaded if networkidle times out
- ✅ Retries failed page loads automatically
- ✅ Waits 5 extra seconds for JWT token validation

**If still having issues:**
- Check URL is accessible: `curl -I <url>`
- Verify JWT token hasn't expired (tokens typically last 15-30 minutes)
- Check if site requires additional authentication steps

### Error: Authenticated pages with JWT tokens

**Example URL:**
```
https://example.com/account/page?ebtoken=eyJhbGciOi...
```

**Solution:**
The script now handles JWT token authentication automatically!

**How it works:**
1. Detects networkidle timeout (common with auth pages)
2. Falls back to domcontentloaded (faster)
3. Waits 5 seconds for token validation
4. Retries if first attempt fails

**If token has expired:**
1. Login to the website in your browser
2. Copy the fresh URL with new token
3. Update `.env` file with new URL
4. Run `npm start` again

**Tips for authenticated pages:**
- JWT tokens expire after 15-30 minutes
- Get fresh token right before running Percy
- Use WebDiff tool (localhost:4000) for quick auth URL comparisons

## Advanced Usage

### CI/CD Integration

**GitHub Actions:**
```yaml
name: Percy Visual Tests
on: [push, pull_request]

jobs:
  visual-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm start
        env:
          PERCY_TOKEN: ${{ secrets.PERCY_TOKEN }}
          TEST_URL: https://staging.example.com
          BUTTONS: "Tab1,Tab2,Tab3"
```

### Programmatic Usage

```javascript
import { PercyVisualTester } from './percy-test.js';

const config = {
  url: 'https://example.com',
  buttons: ['All', 'Pending'],
  percyToken: process.env.PERCY_TOKEN,
  projectName: 'my-app'
};

const tester = new PercyVisualTester(config);
await tester.runTest();
```

## Project Structure

```
percy-visual-testing/
├── percy-test.js      # Main script
├── package.json       # Dependencies
├── .env               # Your configuration (not committed)
├── .env.example       # Example configuration
├── .gitignore         # Git ignore rules
├── screenshots/       # Local screenshots (auto-generated)
└── README.md          # This file
```

## Comparison: Percy vs Custom Tool

| Feature | Percy Script | WebDiff Tool |
|---------|-------------|--------------|
| Visual Comparison | Percy's AI (industry-standard) | Custom pixel matching |
| Baseline Management | Built-in with approval flow | Manual |
| CI/CD Integration | Native support | API endpoint |
| Reporting | Percy dashboard | Local HTML |
| Team Collaboration | Yes (comments, approvals) | No |
| Cost | Paid (free tier available) | Free |
| Speed | ~10-15s | ~8-15s |

## Best Practices

1. **Baseline Management**
   - Review and approve baselines carefully
   - Update baseline after intentional UI changes
   - Don't auto-approve in CI/CD

2. **Test Organization**
   - Use descriptive snapshot names
   - Group related tests in same project
   - Test critical user flows

3. **Performance**
   - Limit button states to essential flows
   - Use parallel runs for multiple URLs
   - Cache dependencies in CI/CD

4. **Maintenance**
   - Update Playwright regularly
   - Monitor Percy build minutes usage
   - Review failed tests promptly

## Resources

- [Percy Documentation](https://docs.percy.io)
- [Percy API Reference](https://docs.percy.io/reference)
- [Playwright Documentation](https://playwright.dev)
- [Percy Pricing](https://percy.io/pricing)

## Author

**Sai Rohith Vennu**
Built with Percy, Playwright, and Node.js

## License

MIT License - Free to use for any purpose

---

**Version:** 1.0.0
**Last Updated:** January 2025
