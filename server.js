#!/usr/bin/env node
import express from 'express';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use('/screenshots', express.static('screenshots'));
app.use('/results', express.static('results'));

// Ensure directories exist
['screenshots', 'results', 'public'].forEach(dir => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
});

// UI Comparison Engine
class UIComparisonEngine {
  constructor(config) {
    this.config = config;
    this.results = [];
  }

  async handlePopups(page, url) {
    // Common selectors for popup close buttons
    const popupSelectors = [
      // Generic close buttons
      '[aria-label*="close" i]',
      '[aria-label*="dismiss" i]',
      'button[class*="close" i]',
      'button[class*="dismiss" i]',
      '[data-testid*="close" i]',
      '[data-testid*="dismiss" i]',
      '.modal-close',
      '.popup-close',
      '.banner-close',
      // Common icon-based close buttons
      'button > svg[class*="close" i]',
      'button[title*="close" i]',
      // Specific to Chrome/browser extension prompts
      'button:has-text("No thanks")',
      'button:has-text("Not now")',
      'button:has-text("Maybe later")',
      'button:has-text("Skip")',
      // X button patterns
      'button:has-text("×")',
      'button:has-text("✕")',
      '[class*="close"]:has-text("×")',
      // Overlay/backdrop clicks
      '.modal-backdrop',
      '[class*="overlay"]'
    ];

    console.log(`  🔍 Checking for popups on ${url}...`);
    let popupClosed = false;

    // Try each selector
    for (const selector of popupSelectors) {
      try {
        const element = await page.locator(selector).first();
        if (await element.isVisible({ timeout: 1000 })) {
          await element.click({ timeout: 2000 });
          console.log(`  ✅ Popup closed successfully using selector: ${selector}`);
          popupClosed = true;
          await page.waitForTimeout(1500); // Wait for popup animation to complete
          break;
        }
      } catch (error) {
        // Selector not found or not clickable, continue to next
        continue;
      }
    }

    // Also try to detect and close popups by evaluating common patterns
    if (!popupClosed) {
      const jsPopupClosed = await page.evaluate(() => {
        // Look for elements that might be popups/modals/banners
        const possiblePopups = document.querySelectorAll('[role="dialog"], [role="alertdialog"], .modal, .popup, [class*="modal"], [class*="popup"], [class*="banner"]');

        for (const popup of possiblePopups) {
          const style = window.getComputedStyle(popup);
          if (style.display !== 'none' && style.visibility !== 'hidden' && popup.offsetParent !== null) {
            // Look for close button within the popup
            const closeButton = popup.querySelector('button[aria-label*="close" i], button[class*="close" i], [class*="close"]');
            if (closeButton) {
              closeButton.click();
              return true;
            }
          }
        }
        return false;
      });

      if (jsPopupClosed) {
        console.log('  ✅ Popup closed successfully using JavaScript evaluation');
        popupClosed = true;
        await page.waitForTimeout(1500);
      }
    }

    if (!popupClosed) {
      console.log('  ℹ️  No popup detected');
    }

    return popupClosed;
  }

  async capturePageData(page, url) {
    // Use 'load' event which is more reliable than 'networkidle' for sites with continuous network activity
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });

    // Wait longer for authentication to process and page to render
    await page.waitForTimeout(8000);

    // Handle popups/modals/banners
    const popupClosed = await this.handlePopups(page, url);

    // If popup was closed, verify we're still on the correct URL
    if (popupClosed) {
      await page.waitForTimeout(2000); // Extra wait after popup close

      const currentUrl = page.url();
      const targetPath = new URL(url).pathname + new URL(url).search;
      const currentPath = new URL(currentUrl).pathname + new URL(currentUrl).search;

      // If we got redirected to a different page, navigate back
      if (currentPath !== targetPath) {
        console.log(`  ⚠️  Page redirected after popup close. Re-navigating to: ${url}`);
        await page.goto(url, { waitUntil: 'load', timeout: 30000 });
        await page.waitForTimeout(3000);

        // Check for popups again after re-navigation
        await this.handlePopups(page, url);
      }
    }

    // Check if we're stuck on a login page by looking for login indicators
    const hasLoginModal = await page.evaluate(() => {
      const signInText = document.body.innerText;
      return signInText.includes('Sign In') && signInText.includes('Password');
    });

    if (hasLoginModal) {
      console.log('  ⚠️  Login modal detected, waiting longer for auth...');
      await page.waitForTimeout(5000);
    }

    // Wait for dynamic content to fully load (like cash back amounts, user data, etc.)
    console.log('  ⏳ Waiting for dynamic content to fully render...');
    await page.waitForTimeout(3000);

    // Additional smart wait: Check if content is still changing
    let previousContent = '';
    for (let i = 0; i < 3; i++) {
      const currentContent = await page.evaluate(() => document.body.innerText);
      if (currentContent === previousContent) {
        break; // Content stable
      }
      previousContent = currentContent;
      await page.waitForTimeout(1500);
    }
    console.log('  ✅ Content rendering complete');

    const data = await page.evaluate(() => {
      const isVisible = (el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' &&
               style.visibility !== 'hidden' &&
               style.opacity !== '0' &&
               el.offsetWidth > 0 &&
               el.offsetHeight > 0;
      };

      const extractText = (el) => {
        return el.innerText?.trim() || el.textContent?.trim() || '';
      };

      const data = {
        title: document.title,
        headings: [],
        visibleText: [],
        buttons: [],
        links: [],
        forms: [],
        images: []
      };

      // Extract headings
      document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(el => {
        if (isVisible(el)) {
          data.headings.push({
            tag: el.tagName.toLowerCase(),
            text: extractText(el)
          });
        }
      });

      // Extract visible text
      document.querySelectorAll('p, div, span, li').forEach(el => {
        if (isVisible(el) && el.innerText) {
          const text = extractText(el);
          if (text.length > 5 && text.length < 200) {
            data.visibleText.push(text);
          }
        }
      });

      // Extract buttons
      document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]').forEach(el => {
        if (isVisible(el)) {
          data.buttons.push(extractText(el) || el.value || el.getAttribute('aria-label') || 'Unlabeled');
        }
      });

      // Extract links
      document.querySelectorAll('a[href]').forEach(el => {
        if (isVisible(el)) {
          data.links.push({
            text: extractText(el),
            href: el.getAttribute('href')
          });
        }
      });

      // Extract forms
      document.querySelectorAll('form').forEach(el => {
        if (isVisible(el)) {
          const inputs = Array.from(el.querySelectorAll('input, textarea, select')).map(inp => ({
            type: inp.type || inp.tagName.toLowerCase(),
            name: inp.name || inp.id,
            label: inp.getAttribute('aria-label') || inp.placeholder
          }));
          data.forms.push({ inputs });
        }
      });

      // Extract images
      document.querySelectorAll('img').forEach(el => {
        if (isVisible(el)) {
          data.images.push({
            alt: el.alt || '',
            src: el.src.substring(0, 100)
          });
        }
      });

      return {
        ...data,
        visibleText: [...new Set(data.visibleText)].sort()
      };
    });

    return data;
  }

  compareData(data1, data2) {
    const differences = [];

    // Compare titles
    if (data1.title !== data2.title) {
      differences.push({
        type: 'Text',
        category: 'Page Title',
        severity: 'high',
        detail: `URL 1: "${data1.title}" vs URL 2: "${data2.title}"`
      });
    }

    // Compare headings
    const headings1 = data1.headings.map(h => `${h.tag}: ${h.text}`);
    const headings2 = data2.headings.map(h => `${h.tag}: ${h.text}`);
    const headingsAdded = headings2.filter(h => !headings1.includes(h));
    const headingsRemoved = headings1.filter(h => !headings2.includes(h));

    if (headingsAdded.length > 0) {
      differences.push({
        type: 'Content',
        category: 'Headings Added',
        severity: 'medium',
        detail: headingsAdded.slice(0, 5).join('; '),
        count: headingsAdded.length
      });
    }

    if (headingsRemoved.length > 0) {
      differences.push({
        type: 'Content',
        category: 'Headings Removed',
        severity: 'medium',
        detail: headingsRemoved.slice(0, 5).join('; '),
        count: headingsRemoved.length
      });
    }

    // Compare buttons
    const buttonsAdded = data2.buttons.filter(b => !data1.buttons.includes(b));
    const buttonsRemoved = data1.buttons.filter(b => !data2.buttons.includes(b));

    if (buttonsAdded.length > 0) {
      differences.push({
        type: 'Interactive',
        category: 'Buttons Added',
        severity: 'high',
        detail: buttonsAdded.slice(0, 5).map(b => `"${b}"`).join('; '),
        count: buttonsAdded.length
      });
    }

    if (buttonsRemoved.length > 0) {
      differences.push({
        type: 'Interactive',
        category: 'Buttons Removed',
        severity: 'high',
        detail: buttonsRemoved.slice(0, 5).map(b => `"${b}"`).join('; '),
        count: buttonsRemoved.length
      });
    }

    // Compare text content
    const textAdded = data2.visibleText.filter(t => !data1.visibleText.includes(t));
    const textRemoved = data1.visibleText.filter(t => !data2.visibleText.includes(t));

    if (textAdded.length > 0) {
      differences.push({
        type: 'Content',
        category: 'Text Added',
        severity: 'low',
        detail: `${textAdded.length} new text elements`,
        examples: textAdded.slice(0, 3).map(t => t.substring(0, 50)),
        count: textAdded.length
      });
    }

    if (textRemoved.length > 0) {
      differences.push({
        type: 'Content',
        category: 'Text Removed',
        severity: 'low',
        detail: `${textRemoved.length} text elements removed`,
        examples: textRemoved.slice(0, 3).map(t => t.substring(0, 50)),
        count: textRemoved.length
      });
    }

    // Compare forms
    if (data1.forms.length !== data2.forms.length) {
      differences.push({
        type: 'Interactive',
        category: 'Form Count Changed',
        severity: 'high',
        detail: `URL 1: ${data1.forms.length} forms, URL 2: ${data2.forms.length} forms`
      });
    }

    return differences;
  }

  async createHighlightedScreenshots(screenshotPath1, screenshotPath2, differences, timestamp) {
    try {
      console.log('  🎨 Creating highlighted difference screenshots...');

      // Read both images
      const img1Buffer = readFileSync(screenshotPath1);
      const img2Buffer = readFileSync(screenshotPath2);

      const img1 = PNG.sync.read(img1Buffer);
      const img2 = PNG.sync.read(img2Buffer);

      // Ensure images are the same size
      const width = Math.min(img1.width, img2.width);
      const height = Math.min(img1.height, img2.height);

      // Create diff image
      const diff = new PNG({ width, height });

      // Perform pixel-level comparison
      const numDiffPixels = pixelmatch(
        img1.data,
        img2.data,
        diff.data,
        width,
        height,
        {
          threshold: 0.1,
          includeAA: true,
          alpha: 0.5
        }
      );

      console.log(`  📊 Found ${numDiffPixels} different pixels`);

      // Create annotated versions with colored boxes based on severity
      const annotatedPath1 = join('screenshots', `${timestamp}_url1_highlighted.png`);
      const annotatedPath2 = join('screenshots', `${timestamp}_url2_highlighted.png`);
      const diffPath = join('screenshots', `${timestamp}_diff.png`);

      // Save the pixel diff
      writeFileSync(diffPath, PNG.sync.write(diff));

      // Create SVG overlays for both images with colored boxes
      await this.createAnnotatedImage(screenshotPath1, annotatedPath1, differences, 'url1');
      await this.createAnnotatedImage(screenshotPath2, annotatedPath2, differences, 'url2');

      return {
        highlighted: {
          url1: annotatedPath1,
          url2: annotatedPath2,
          diff: diffPath
        },
        pixelDifferences: numDiffPixels
      };

    } catch (error) {
      console.error('  ❌ Error creating highlighted screenshots:', error.message);
      return null;
    }
  }

  async createAnnotatedImage(inputPath, outputPath, differences, urlType) {
    try {
      const image = sharp(inputPath);
      const metadata = await image.metadata();

      if (differences.length === 0) {
        // No differences, just copy the original
        await image.toFile(outputPath);
        return;
      }

      // Create SVG overlay with subtle side indicators
      const severityColors = {
        high: { color: '#ff453a', label: 'HIGH' },
        medium: { color: '#ff9f0a', label: 'MED' },
        low: { color: '#0a84ff', label: 'LOW' }
      };

      // Create a compact legend/badge on the side
      const badges = [];
      let yPosition = 20;
      const badgeHeight = 40;
      const badgeWidth = 120;
      const rightMargin = 20;

      differences.forEach((diff) => {
        const colorInfo = severityColors[diff.severity] || severityColors.low;

        badges.push(`
          <g>
            <!-- Badge background -->
            <rect
              x="${metadata.width - badgeWidth - rightMargin}"
              y="${yPosition}"
              width="${badgeWidth}"
              height="${badgeHeight}"
              fill="rgba(0, 0, 0, 0.75)"
              stroke="${colorInfo.color}"
              stroke-width="2"
              rx="8"
            />
            <!-- Severity indicator -->
            <rect
              x="${metadata.width - badgeWidth - rightMargin + 5}"
              y="${yPosition + 5}"
              width="4"
              height="${badgeHeight - 10}"
              fill="${colorInfo.color}"
              rx="2"
            />
            <!-- Text -->
            <text
              x="${metadata.width - badgeWidth - rightMargin + 15}"
              y="${yPosition + 18}"
              font-family="Arial, sans-serif"
              font-size="11"
              font-weight="bold"
              fill="${colorInfo.color}"
            >
              ${colorInfo.label}
            </text>
            <text
              x="${metadata.width - badgeWidth - rightMargin + 15}"
              y="${yPosition + 32}"
              font-family="Arial, sans-serif"
              font-size="10"
              fill="white"
            >
              ${diff.category.substring(0, 15)}
            </text>
          </g>
        `);

        yPosition += badgeHeight + 10;
      });

      const svgOverlay = `
        <svg width="${metadata.width}" height="${metadata.height}">
          ${badges.join('\n')}
        </svg>
      `;

      await image
        .composite([{
          input: Buffer.from(svgOverlay),
          top: 0,
          left: 0
        }])
        .toFile(outputPath);

    } catch (error) {
      console.error(`  ❌ Error annotating ${urlType}:`, error.message);
      // Fallback: copy original
      const original = readFileSync(inputPath);
      writeFileSync(outputPath, original);
    }
  }

  async run() {
    const browser = await chromium.launch({ headless: true });
    const timestamp = Date.now();

    try {
      const context1 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      const context2 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // Capture data and screenshots
      const [data1, data2] = await Promise.all([
        this.capturePageData(page1, this.config.url1),
        this.capturePageData(page2, this.config.url2)
      ]);

      const screenshotPath1 = join('screenshots', `${timestamp}_url1.png`);
      const screenshotPath2 = join('screenshots', `${timestamp}_url2.png`);

      await Promise.all([
        page1.screenshot({ path: screenshotPath1, fullPage: true }),
        page2.screenshot({ path: screenshotPath2, fullPage: true })
      ]);

      await context1.close();
      await context2.close();
      await browser.close();

      // Compare
      const differences = this.compareData(data1, data2);

      // Create highlighted screenshots with visual difference markers
      const highlightedResults = await this.createHighlightedScreenshots(
        screenshotPath1,
        screenshotPath2,
        differences,
        timestamp
      );

      return {
        timestamp,
        config: this.config,
        screenshots: {
          url1: screenshotPath1,
          url2: screenshotPath2,
          ...(highlightedResults && { highlighted: highlightedResults.highlighted }),
          ...(highlightedResults && { diff: highlightedResults.highlighted.diff }),
          ...(highlightedResults && { pixelDifferences: highlightedResults.pixelDifferences })
        },
        data: { data1, data2 },
        differences,
        summary: {
          totalDifferences: differences.length,
          byType: this.groupByType(differences),
          bySeverity: this.groupBySeverity(differences)
        }
      };

    } catch (error) {
      await browser.close();
      throw error;
    }
  }

  groupByType(differences) {
    const grouped = {};
    differences.forEach(diff => {
      if (!grouped[diff.type]) grouped[diff.type] = 0;
      grouped[diff.type]++;
    });
    return grouped;
  }

  groupBySeverity(differences) {
    const grouped = {};
    differences.forEach(diff => {
      if (!grouped[diff.severity]) grouped[diff.severity] = 0;
      grouped[diff.severity]++;
    });
    return grouped;
  }
}

// API Routes
app.post('/api/compare', async (req, res) => {
  try {
    const { url1, url2, description } = req.body;

    if (!url1 || !url2) {
      return res.status(400).json({ error: 'Both URLs are required' });
    }

    console.log(`\n🔍 Starting comparison: ${url1} vs ${url2}`);

    const engine = new UIComparisonEngine({ url1, url2, description });
    const result = await engine.run();

    // Save result
    const resultPath = join('results', `${result.timestamp}.json`);
    writeFileSync(resultPath, JSON.stringify(result, null, 2));

    console.log(`✅ Comparison completed: ${result.differences.length} differences found`);

    res.json({
      success: true,
      result: {
        ...result,
        resultId: result.timestamp
      }
    });

  } catch (error) {
    console.error('❌ Comparison error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/results', (req, res) => {
  try {
    const files = readdirSync('results')
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const content = JSON.parse(readFileSync(join(__dirname, 'results', f), 'utf-8'));
        return {
          id: f.replace('.json', ''),
          timestamp: content.timestamp,
          url1: content.config.url1,
          url2: content.config.url2,
          totalDifferences: content.differences.length
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);

    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/results/:id', (req, res) => {
  try {
    const resultPath = join('results', `${req.params.id}.json`);
    if (!existsSync(resultPath)) {
      return res.status(404).json({ error: 'Result not found' });
    }

    const result = JSON.parse(readFileSync(resultPath, 'utf-8'));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     🤖 UI Comparison Web App - Running                    ║
║                                                            ║
║     📍 Server: http://localhost:${PORT}                        ║
║     📊 API: http://localhost:${PORT}/api/compare               ║
║                                                            ║
║     Drop any two URLs to compare their UI!                ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
