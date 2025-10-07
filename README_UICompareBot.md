# UICompareBot - Automated UI Comparison Tool

## Overview
UICompareBot is a Playwright-based tool that automatically compares UI between Production and Preview environments for Rakuten websites.

## Features
✅ **Multi-page comparison** - Compares multiple pages simultaneously
✅ **Authentication support** - Uses ebtoken cookies for authenticated pages
✅ **Static content analysis** - Compares headings, text, buttons, links, and structure
✅ **Dynamic content detection** - Automatically finds and clicks tabs/buttons to test interactive elements
✅ **Structured reporting** - Generates clean Markdown reports with categorized differences
✅ **Parallel execution** - Loads pages in parallel for faster results

## Architecture

### Core Components

1. **capturePageData()** - Extracts visible UI elements:
   - Page titles
   - Headings (H1-H6)
   - Visible text content
   - Buttons and their labels
   - Links (excluding analytics/tracking)
   - Tabs and interactive elements
   - DOM structure

2. **detectAndClickInteractiveElements()** - Simulates user interactions:
   - Finds tabs (`[role="tab"]`, `.tab`, etc.)
   - Clicks interactive buttons
   - Captures content changes after each interaction
   - Limits to 5 elements per selector type to avoid excessive testing

3. **compareData()** - Diffs extracted content:
   - Identifies added/removed text
   - Detects new or missing buttons
   - Flags heading changes
   - Compares DOM structure differences

4. **generateMarkdownReport()** - Creates formatted output:
   - Organized by page
   - Categorized by difference type (Text/Layout/Behavior)
   - Shows specific examples and context

## Usage

### Basic Execution
```bash
node ui-compare-bot.js
```

### Configuration
Edit the config object in the script:
```javascript
const config = {
  baseUrl1: "https://www.rakuten.com",           // Production
  baseUrl2: "https://preview-www.rakuten.com",   // Preview
  ebtoken1: "your-production-token",
  ebtoken2: "your-preview-token",
  pages: ["/", "/account", "/account/cash-back-activity"]
};
```

### Output
The tool generates `ui_comparison_report.md` with:
- Comparison timestamp
- URLs tested
- Per-page difference breakdown
- Categorized findings (Text/Layout/Behavior)
- Summary statistics

## Recent Run Results

**Execution Date:** October 7, 2025, 9:23 AM

**Pages Tested:**
- `/` (Homepage)
- `/account` (Account page)
- `/account/cash-back-activity` (Cash back activity page)

**Results:** ✅ No differences detected across all pages

This indicates that:
1. Preview and Production environments are currently in sync
2. No new changes have been deployed to Preview
3. Both environments are serving identical content

## Difference Types

| Type | Description | Examples |
|------|-------------|----------|
| **Text** | Content changes | New headings, modified copy, removed paragraphs |
| **Layout** | Structural changes | New buttons, removed links, reordered elements |
| **Behavior** | Interactive changes | New tabs, different click handlers, dynamic content |
| **Missing Element** | Removed components | Deleted sections, removed features |

## Technical Details

### Authentication
- Uses `ebtoken` cookies for session authentication
- Sets cookies before page navigation
- Supports different tokens for each environment

### Performance
- Parallel page loading reduces comparison time
- Typical runtime: 30-60 seconds for 3 pages
- Timeout: 30 seconds per page load

### Content Filtering
- Ignores analytics/tracking links
- Filters out non-visible elements
- Deduplicates text content
- Truncates very long text for readability

## Troubleshooting

### "No differences detected" when changes exist
- Check if auth tokens are valid
- Verify pages are fully loading (increase waitForTimeout)
- Confirm changes are deployed to Preview

### Timeouts
- Increase timeout in `page.goto()` options
- Check network connectivity
- Verify URLs are accessible

### Missing dynamic content
- Add selectors to `interactiveSelectors` array
- Increase interaction wait time
- Check if elements are visible

## Future Enhancements

Potential improvements:
- Screenshot comparison for visual diffs
- CSS style comparison (colors, fonts, spacing)
- Performance metrics (load times, bundle sizes)
- Accessibility testing (ARIA labels, contrast ratios)
- Mobile viewport testing
- Historical trend tracking

## Files

- `ui-compare-bot.js` - Main comparison script
- `ui_comparison_report.md` - Latest generated report
- `test-auth.js` - Authentication testing utility
- `webdiff-playwright.js` - Original comparison tool

## Dependencies

```json
{
  "playwright": "^1.56.0",
  "chalk": "^5.3.0",
  "cheerio": "^1.0.0-rc.12",
  "node-fetch": "^3.3.2"
}
```

---

**Created by:** UICompareBot Agent
**Last Updated:** October 7, 2025
