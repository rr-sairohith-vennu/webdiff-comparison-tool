#!/usr/bin/env node
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
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
const httpServer = createServer(app);
const io = new Server(httpServer);
const PORT = process.env.PORT || 4000;

// Use persistent storage on Fly.io, fallback to local for development
const DATA_DIR = process.env.FLY_APP_NAME ? '/app/data' : __dirname;
const SCREENSHOTS_DIR = join(DATA_DIR, 'screenshots');
const RESULTS_DIR = join(DATA_DIR, 'results');

// Middleware
app.use(express.json());

// Add logging for all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

app.use(express.static('public'));

// Custom screenshot handler to bypass Fly.io proxy content negotiation issues
app.get('/screenshots/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = join(SCREENSHOTS_DIR, filename);

  console.log(`Serving screenshot: ${filepath}`);

  if (!existsSync(filepath)) {
    console.log(`Screenshot not found: ${filepath}`);
    return res.status(404).send('Not found');
  }

  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'public, max-age=31536000');
  res.sendFile(filepath);
});

app.use('/results', express.static(RESULTS_DIR));

// Ensure directories exist
[SCREENSHOTS_DIR, RESULTS_DIR, 'public'].forEach(dir => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
});

// UI Comparison Engine
class UIComparisonEngine {
  constructor(config, socket = null) {
    this.config = config;
    this.results = [];
    this.socket = socket;
  }

  emit(event, data) {
    if (this.socket) {
      this.socket.emit('progress', { event, ...data });
    }
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
    let totalPopupsClosed = 0;

    // Try multiple rounds to catch delayed popups (up to 3 attempts)
    for (let attempt = 0; attempt < 3; attempt++) {
      let popupClosedThisRound = false;

      // Try each selector
      for (const selector of popupSelectors) {
        try {
          const element = await page.locator(selector).first();
          if (await element.isVisible({ timeout: 500 })) {
            await element.click({ timeout: 2000 });
            console.log(`  ✅ Popup closed using selector: ${selector}`);
            popupClosedThisRound = true;
            totalPopupsClosed++;
            await page.waitForTimeout(1000); // Wait for popup animation
            break;
          }
        } catch (error) {
          // Selector not found or not clickable, continue to next
          continue;
        }
      }

      // Also try JavaScript-based popup detection
      if (!popupClosedThisRound) {
        const jsPopupClosed = await page.evaluate(() => {
          // Look for elements that might be popups/modals/banners
          const possiblePopups = document.querySelectorAll('[role="dialog"], [role="alertdialog"], .modal, .popup, [class*="modal"], [class*="popup"], [class*="banner"], [class*="overlay"]');

          for (const popup of possiblePopups) {
            const style = window.getComputedStyle(popup);
            if (style.display !== 'none' && style.visibility !== 'hidden' && popup.offsetParent !== null) {
              // Look for close button within the popup
              const closeButton = popup.querySelector('button[aria-label*="close" i], button[class*="close" i], button, [class*="close"]');
              if (closeButton && closeButton.offsetParent !== null) {
                closeButton.click();
                return true;
              }
            }
          }
          return false;
        });

        if (jsPopupClosed) {
          console.log('  ✅ Popup closed using JavaScript evaluation');
          popupClosedThisRound = true;
          totalPopupsClosed++;
          await page.waitForTimeout(1000);
        }
      }

      // If no popup found this round, we're done
      if (!popupClosedThisRound) {
        break;
      }

      // Wait a bit before next attempt to catch delayed popups
      await page.waitForTimeout(1000);
    }

    if (totalPopupsClosed === 0) {
      console.log('  ℹ️  No popup detected');
    } else {
      console.log(`  ✅ Total popups closed: ${totalPopupsClosed}`);

      // FIX: Check if closing popup caused a redirect
      await page.waitForTimeout(1000);
      const currentUrl = page.url();

      if (currentUrl !== url && !currentUrl.startsWith(url)) {
        console.log(`  ⚠️  Popup closing caused redirect! Expected: ${url}, Got: ${currentUrl}`);
        console.log(`  🔄 Navigating back to correct URL...`);

        // Navigate back to the original URL
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          console.log(`  ✅ Successfully navigated back to ${url}`);
          await page.waitForTimeout(2000); // Wait for page to stabilize
        } catch (error) {
          console.log(`  ❌ Failed to navigate back: ${error.message}`);
        }
      }
    }

    return totalPopupsClosed > 0;
  }

  async handleClickAction(page, clickAction) {
    if (!clickAction) return false;

    console.log(`  🖱️  Attempting to click: "${clickAction}"`);

    try {
      // Try as button text first (most common case)
      const buttonByText = page.locator(`button:has-text("${clickAction}")`).first();
      if (await buttonByText.isVisible({ timeout: 3000 })) {
        await buttonByText.click();
        console.log(`  ✅ Clicked button with text: "${clickAction}"`);
        await page.waitForTimeout(2000); // Wait for content to update
        return true;
      }
    } catch (e) {
      // Button by text not found, continue
    }

    try {
      // Try as CSS selector
      const elementBySelector = page.locator(clickAction).first();
      if (await elementBySelector.isVisible({ timeout: 2000 })) {
        await elementBySelector.click();
        console.log(`  ✅ Clicked element with selector: "${clickAction}"`);
        await page.waitForTimeout(2000);
        return true;
      }
    } catch (e) {
      // Selector not found
    }

    try {
      // Try as aria-label
      const elementByAria = page.locator(`[aria-label="${clickAction}"]`).first();
      if (await elementByAria.isVisible({ timeout: 2000 })) {
        await elementByAria.click();
        console.log(`  ✅ Clicked element with aria-label: "${clickAction}"`);
        await page.waitForTimeout(2000);
        return true;
      }
    } catch (e) {
      // Aria-label not found
    }

    console.log(`  ⚠️  Could not find clickable element: "${clickAction}"`);
    return false;
  }

  async addTextCoordinates(page1, page2, differences) {
    for (const diff of differences) {
      if (diff.category === 'Text Added' && diff.examples) {
        // Find coordinates on page2 (URL 2)
        const coordinates = [];
        for (const text of diff.examples.slice(0, 10)) { // Check more items
          try {
            const bounds = await page2.evaluate((searchText) => {
              // Find all text nodes that contain the search text
              const allBounds = [];
              const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
              let node;

              while (node = walker.nextNode()) {
                const nodeText = node.textContent.trim();
                // Try exact match first, then contains match
                if (nodeText === searchText.trim() || nodeText.includes(searchText.trim())) {
                  const parent = node.parentElement;
                  if (parent) {
                    const rect = parent.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                      allBounds.push({
                        x: Math.round(rect.left + window.scrollX),
                        y: Math.round(rect.top + window.scrollY),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height)
                      });
                    }
                  }
                }
              }
              return allBounds.length > 0 ? allBounds[0] : null;
            }, text);

            if (bounds && bounds.width > 0 && bounds.height > 0) {
              coordinates.push({ url2: bounds });
            }
          } catch (e) {
            // Skip if not found
          }
        }
        if (coordinates.length > 0) {
          diff.coordinates = coordinates;
          // If text contains currency, make it high severity
          if (diff.examples.some(t => t.match(/\$[\d,]+\.?\d*/))) {
            diff.severity = 'high';
          }
        }
      } else if (diff.category === 'Text Removed' && diff.examples) {
        // Find coordinates on page1 (URL 1)
        const coordinates = [];
        for (const text of diff.examples.slice(0, 10)) {
          try {
            const bounds = await page1.evaluate((searchText) => {
              const allBounds = [];
              const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
              let node;

              while (node = walker.nextNode()) {
                const nodeText = node.textContent.trim();
                if (nodeText === searchText.trim() || nodeText.includes(searchText.trim())) {
                  const parent = node.parentElement;
                  if (parent) {
                    const rect = parent.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                      allBounds.push({
                        x: Math.round(rect.left + window.scrollX),
                        y: Math.round(rect.top + window.scrollY),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height)
                      });
                    }
                  }
                }
              }
              return allBounds.length > 0 ? allBounds[0] : null;
            }, text);

            if (bounds && bounds.width > 0 && bounds.height > 0) {
              coordinates.push({ url1: bounds });
            }
          } catch (e) {
            // Skip if not found
          }
        }
        if (coordinates.length > 0) {
          diff.coordinates = coordinates;
          // If text contains currency, make it high severity
          if (diff.examples.some(t => t.match(/\$[\d,]+\.?\d*/))) {
            diff.severity = 'high';
          }
        }
      }
    }
  }

  async capturePageData(page, url) {
    // Use 'networkidle' for better stability - waits for network to be idle
    this.emit('step', { step: 1, detail: `🌐 Loading ${new URL(url).hostname}...` });

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
    } catch (error) {
      // If networkidle times out, try with domcontentloaded
      console.log(`  ⚠️  Network idle timeout, trying with domcontentloaded...`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000); // Wait a bit for content to load
    }

    this.emit('step', { step: 1, detail: `⚙️ Freezing animations for stable capture...` });
    // Freeze animations and transitions for stable comparison
    await page.evaluate(() => {
      // Disable CSS animations and transitions
      const style = document.createElement('style');
      style.textContent = `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `;
      document.head.appendChild(style);

      // Stop any video/gif autoplay
      document.querySelectorAll('video, img[src$=".gif"]').forEach(el => {
        if (el.tagName === 'VIDEO') el.pause();
      });
    });

    this.emit('step', { step: 2, detail: `🔍 Scanning for popups and modals...` });
    // Brief wait - networkidle already ensures page is loaded
    await page.waitForTimeout(1500);

    // Handle popups/modals/banners (try multiple times for delayed popups)
    this.emit('step', { step: 2, detail: `🚫 Closing detected popups...` });
    const popupClosed = await this.handlePopups(page, url);

    if (this.config.clickAction) {
      this.emit('step', { step: 3, detail: `👆 Clicking "${this.config.clickAction}" button...` });
      const clicked = await this.handleClickAction(page, this.config.clickAction);
      if (clicked) {
        this.emit('step', { step: 3, detail: `⏳ Waiting for content to update...` });
        await page.waitForTimeout(2000);
      }
    }

    // Brief wait if popup was closed
    if (popupClosed) {
      await page.waitForTimeout(500);
    }

    // Wait for dynamic content to fully load
    console.log('  ⏳ Waiting for dynamic content to fully render...');
    await page.waitForTimeout(2000);

    // Check if content is stable
    let previousContent = await page.evaluate(() => document.body.innerText);
    await page.waitForTimeout(1000);
    const currentContent = await page.evaluate(() => document.body.innerText);

    if (previousContent !== currentContent) {
      // Content still changing, wait a bit more
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
        images: [],
        currencyAmounts: [] // NEW: Track all currency with context and position
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

      // Extract buttons with coordinates
      document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]').forEach(el => {
        if (isVisible(el)) {
          const rect = el.getBoundingClientRect();
          data.buttons.push({
            text: extractText(el) || el.value || el.getAttribute('aria-label') || 'Unlabeled',
            bounds: {
              x: Math.round(rect.left + window.scrollX),
              y: Math.round(rect.top + window.scrollY),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            }
          });
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

      // Extract all currency amounts with position and context
      const currencyPattern = /\$[\d,]+\.?\d*/g;
      document.querySelectorAll('*').forEach(el => {
        if (isVisible(el) && el.children.length === 0) { // Leaf elements only
          const text = extractText(el);
          const matches = text.match(currencyPattern);
          if (matches) {
            matches.forEach(amount => {
              const rect = el.getBoundingClientRect();
              // Get context (nearby text or parent labels)
              let context = '';
              let parent = el.parentElement;
              while (parent && !context) {
                const parentText = extractText(parent);
                if (parentText.length > 0 && parentText.length < 100) {
                  context = parentText;
                  break;
                }
                parent = parent.parentElement;
              }

              data.currencyAmounts.push({
                amount,
                context: context.substring(0, 50),
                bounds: {
                  x: Math.round(rect.left + window.scrollX),
                  y: Math.round(rect.top + window.scrollY),
                  width: Math.round(rect.width),
                  height: Math.round(rect.height)
                }
              });
            });
          }
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
        category: 'Page Title Changed',
        severity: 'high',
        detail: `Title has changed`,
        url1Value: data1.title,
        url2Value: data2.title,
        location: 'Page Title (<title> tag)'
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
        detail: `${headingsAdded.length} new heading(s) found in URL 2`,
        url1Value: 'Not present',
        url2Value: headingsAdded.slice(0, 5).join('; '),
        location: 'Page Headings (H1-H6)',
        count: headingsAdded.length,
        fullList: headingsAdded
      });
    }

    if (headingsRemoved.length > 0) {
      differences.push({
        type: 'Content',
        category: 'Headings Removed',
        severity: 'medium',
        detail: `${headingsRemoved.length} heading(s) missing in URL 2`,
        url1Value: headingsRemoved.slice(0, 5).join('; '),
        url2Value: 'Not present',
        location: 'Page Headings (H1-H6)',
        count: headingsRemoved.length,
        fullList: headingsRemoved
      });
    }

    // Compare buttons
    const button1Texts = data1.buttons.map(b => typeof b === 'string' ? b : b.text);
    const button2Texts = data2.buttons.map(b => typeof b === 'string' ? b : b.text);

    const buttonsAdded = data2.buttons.filter(b => {
      const text = typeof b === 'string' ? b : b.text;
      return !button1Texts.includes(text);
    });
    const buttonsRemoved = data1.buttons.filter(b => {
      const text = typeof b === 'string' ? b : b.text;
      return !button2Texts.includes(text);
    });

    if (buttonsAdded.length > 0) {
      differences.push({
        type: 'Interactive',
        category: 'Buttons Added',
        severity: 'high',
        detail: `${buttonsAdded.length} new button(s) found in URL 2`,
        url1Value: 'Not present',
        url2Value: buttonsAdded.slice(0, 5).map(b => `"${typeof b === 'string' ? b : b.text}"`).join(', '),
        location: 'Interactive Buttons (<button> elements)',
        count: buttonsAdded.length,
        fullList: buttonsAdded,
        coordinates: buttonsAdded.filter(b => typeof b === 'object' && b.bounds).map(b => ({ url2: b.bounds }))
      });
    }

    if (buttonsRemoved.length > 0) {
      differences.push({
        type: 'Interactive',
        category: 'Buttons Removed',
        severity: 'high',
        detail: `${buttonsRemoved.length} button(s) missing in URL 2`,
        url1Value: buttonsRemoved.slice(0, 5).map(b => `"${typeof b === 'string' ? b : b.text}"`).join(', '),
        url2Value: 'Not present',
        location: 'Interactive Buttons (<button> elements)',
        count: buttonsRemoved.length,
        fullList: buttonsRemoved,
        coordinates: buttonsRemoved.filter(b => typeof b === 'object' && b.bounds).map(b => ({ url1: b.bounds }))
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
        detail: `${textAdded.length} new text element(s) found in URL 2`,
        url1Value: 'Not present',
        url2Value: textAdded.slice(0, 3).map(t => `"${t.substring(0, 100)}"`).join(', '),
        location: 'Visible Text Content',
        count: textAdded.length,
        examples: textAdded.slice(0, 10)
      });
    }

    if (textRemoved.length > 0) {
      differences.push({
        type: 'Content',
        category: 'Text Removed',
        severity: 'low',
        detail: `${textRemoved.length} text element(s) missing in URL 2`,
        url1Value: textRemoved.slice(0, 3).map(t => `"${t.substring(0, 100)}"`).join(', '),
        url2Value: 'Not present',
        location: 'Visible Text Content',
        count: textRemoved.length,
        examples: textRemoved.slice(0, 10)
      });
    }

    // Compare currency amounts by context
    if (data1.currencyAmounts && data2.currencyAmounts) {
      const contextMap1 = {};
      const contextMap2 = {};

      // Group by context
      data1.currencyAmounts.forEach(item => {
        const key = item.context || item.amount;
        contextMap1[key] = item;
      });

      data2.currencyAmounts.forEach(item => {
        const key = item.context || item.amount;
        contextMap2[key] = item;
      });

      // Find changed amounts (same context, different amount)
      Object.keys(contextMap1).forEach(context => {
        if (contextMap2[context]) {
          const amt1 = contextMap1[context].amount;
          const amt2 = contextMap2[context].amount;
          if (amt1 !== amt2) {
            differences.push({
              type: 'Content',
              category: 'Currency Amount Changed',
              severity: 'high',
              detail: `Amount changed in context: "${context}"`,
              url1Value: amt1,
              url2Value: amt2,
              location: `Currency Display`,
              coordinates: [
                { url1: contextMap1[context].bounds },
                { url2: contextMap2[context].bounds }
              ]
            });
          }
        }
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

  // Enhanced approach: Compare ALL interactive DOM elements (text, icons, buttons, images)
  async comparePageElements(page1, page2) {
    console.log('  🔍 Extracting and comparing ALL page elements (text, buttons, icons, images)...');

    // Extract all visible elements including buttons, links, icons, images
    const extractionFunction = () => {
      const elements = [];

      const isVisible = (el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' &&
               style.visibility !== 'hidden' &&
               style.opacity !== '0' &&
               rect.width > 0 &&
               rect.height > 0;
      };

      const getElementSignature = (el) => {
        const text = (el.innerText || el.textContent || '').trim();
        const ariaLabel = el.getAttribute('aria-label') || '';
        const title = el.getAttribute('title') || '';
        const alt = el.getAttribute('alt') || '';
        const role = el.getAttribute('role') || '';
        const tagName = el.tagName.toLowerCase();
        const type = el.getAttribute('type') || '';

        return {
          text: text.substring(0, 200),
          ariaLabel,
          title,
          alt,
          role,
          tagName,
          type,
          hasIcon: el.querySelector('svg, i[class*="icon"], span[class*="icon"]') !== null,
          className: el.className || ''
        };
      };

      // Extract interactive elements (buttons, links, inputs)
      const interactiveSelectors = [
        'button',
        'a[href]',
        'input',
        '[role="button"]',
        '[role="link"]',
        '[onclick]',
        'img',
        'svg',
        '[class*="icon"]',
        '[class*="btn"]'
      ];

      interactiveSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          if (isVisible(el) && el.getBoundingClientRect().left < window.innerWidth - 100) {
            const rect = el.getBoundingClientRect();
            const signature = getElementSignature(el);

            elements.push({
              ...signature,
              x: Math.round(rect.left + window.scrollX),
              y: Math.round(rect.top + window.scrollY),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            });
          }
        });
      });

      // Also extract all text-bearing elements
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      let node;
      while (node = walker.nextNode()) {
        if (node.children.length === 0 && isVisible(node)) {
          const text = (node.innerText || node.textContent || '').trim();
          if (text.length > 0 && text.length < 200) {
            const rect = node.getBoundingClientRect();
            if (rect.left < window.innerWidth - 100) {
              const signature = getElementSignature(node);
              elements.push({
                ...signature,
                x: Math.round(rect.left + window.scrollX),
                y: Math.round(rect.top + window.scrollY),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
              });
            }
          }
        }
      }

      // Deduplicate by position + content
      const unique = [];
      const seen = new Set();
      elements.forEach(el => {
        const key = `${el.x}_${el.y}_${el.text}_${el.ariaLabel}_${el.tagName}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(el);
        }
      });

      return unique;
    };

    const [elements1, elements2] = await Promise.all([
      page1.evaluate(extractionFunction),
      page2.evaluate(extractionFunction)
    ]);

    const differences = [];

    console.log(`  📊 Extracted ${elements1.length} elements from URL 1, ${elements2.length} from URL 2`);

    // Normalize text for comparison (remove extra whitespace, lowercase)
    const normalizeText = (text) => {
      if (!text) return '';
      return text.toLowerCase().replace(/\s+/g, ' ').trim();
    };

    // Calculate similarity score between two elements (0-1, 1 = identical)
    const calculateSimilarity = (el1, el2) => {
      let score = 0;
      let factors = 0;

      // Tag name match (most important)
      if (el1.tagName === el2.tagName) {
        score += 3;
        factors += 3;
      } else {
        factors += 3;
      }

      // Text content similarity
      const text1 = normalizeText(el1.text);
      const text2 = normalizeText(el2.text);
      if (text1 && text2) {
        if (text1 === text2) score += 2;
        else if (text1.includes(text2) || text2.includes(text1)) score += 1;
        factors += 2;
      }

      // Aria-label match
      const aria1 = normalizeText(el1.ariaLabel);
      const aria2 = normalizeText(el2.ariaLabel);
      if (aria1 && aria2 && aria1 === aria2) {
        score += 1;
        factors += 1;
      }

      // Position proximity (within 20px = similar)
      const positionSimilarity = Math.max(0, 1 - (Math.abs(el1.x - el2.x) + Math.abs(el1.y - el2.y)) / 100);
      score += positionSimilarity;
      factors += 1;

      return factors > 0 ? score / factors : 0;
    };

    // Match elements using intelligent similarity matching
    const matchedPage1 = new Set();
    const matchedPage2 = new Set();
    const matches = [];

    // For each element in page1, find best match in page2
    elements1.forEach(el1 => {
      let bestMatch = null;
      let bestScore = 0.6; // Minimum similarity threshold

      elements2.forEach(el2 => {
        if (matchedPage2.has(el2)) return; // Already matched

        // Only compare nearby elements (within 200px) for performance
        if (Math.abs(el2.x - el1.x) > 200 || Math.abs(el2.y - el1.y) > 200) return;

        const similarity = calculateSimilarity(el1, el2);
        if (similarity > bestScore) {
          bestScore = similarity;
          bestMatch = el2;
        }
      });

      if (bestMatch) {
        matchedPage1.add(el1);
        matchedPage2.add(bestMatch);
        matches.push({ el1, el2: bestMatch, similarity: bestScore });
      }
    });

    console.log(`  🔗 Matched ${matches.length} elements between pages`);

    // Check matched elements for meaningful changes
    matches.forEach(({ el1, el2 }) => {
      const text1 = normalizeText(el1.text);
      const text2 = normalizeText(el2.text);

      // Only flag if there's meaningful text change
      if (text1 !== text2 && text1.length > 2 && text2.length > 2) {
        // Check if it's currency (HIGH SEVERITY)
        const currency1 = el1.text.match(/\$[\d,]+\.?\d*/);
        const currency2 = el2.text.match(/\$[\d,]+\.?\d*/);

        if (currency1 && currency2 && currency1[0] !== currency2[0]) {
          differences.push({
            type: 'Content',
            category: 'Currency Amount Changed',
            severity: 'high',
            detail: `Amount changed from ${currency1[0]} to ${currency2[0]}`,
            url1Value: el1.text,
            url2Value: el2.text,
            location: `${el1.tagName} at (${el1.x}, ${el1.y})`,
            coordinates: [
              { url1: { x: el1.x, y: el1.y, width: el1.width, height: el1.height } },
              { url2: { x: el2.x, y: el2.y, width: el2.width, height: el2.height } }
            ]
          });
        }
        // Ignore minor text differences (whitespace, case) - too noisy
      }
    });

    // Find truly added elements (major structural additions only)
    const unmatchedPage2 = elements2.filter(el => !matchedPage2.has(el));

    // Group by text/label to avoid duplicates
    const addedGroups = new Map();
    unmatchedPage2.forEach(el2 => {
      const label = normalizeText(el2.text || el2.ariaLabel || el2.title || el2.alt);
      if (label.length > 3) { // Ignore very short labels (likely noise)
        if (!addedGroups.has(label)) {
          addedGroups.set(label, []);
        }
        addedGroups.get(label).push(el2);
      }
    });

    // Only report unique additions (first occurrence of each label)
    addedGroups.forEach((elements, label) => {
      const el2 = elements[0]; // Take first occurrence
      differences.push({
        type: 'Content',
        category: `Content Added`,
        severity: 'high',
        detail: `New content: "${label.substring(0, 50)}"${elements.length > 1 ? ` (${elements.length} instances)` : ''}`,
        url1Value: 'Not present',
        url2Value: label.substring(0, 100),
        location: `${el2.tagName} at (${el2.x}, ${el2.y})`,
        coordinates: [
          { url2: { x: el2.x, y: el2.y, width: el2.width, height: el2.height } }
        ]
      });
    });

    // Find truly removed elements (major structural removals only)
    const unmatchedPage1 = elements1.filter(el => !matchedPage1.has(el));

    const removedGroups = new Map();
    unmatchedPage1.forEach(el1 => {
      const label = normalizeText(el1.text || el1.ariaLabel || el1.title || el1.alt);
      if (label.length > 3) {
        if (!removedGroups.has(label)) {
          removedGroups.set(label, []);
        }
        removedGroups.get(label).push(el1);
      }
    });

    removedGroups.forEach((elements, label) => {
      const el1 = elements[0];
      differences.push({
        type: 'Content',
        category: `Content Removed`,
        severity: 'high',
        detail: `Removed content: "${label.substring(0, 50)}"${elements.length > 1 ? ` (${elements.length} instances)` : ''}`,
        url1Value: label.substring(0, 100),
        url2Value: 'Not present',
        location: `${el1.tagName} at (${el1.x}, ${el1.y})`,
        coordinates: [
          { url1: { x: el1.x, y: el1.y, width: el1.width, height: el1.height } }
        ]
      });
    });

    console.log(`  ✅ Found ${differences.length} meaningful differences (filtered noise)`);
    return differences;
  }

  async createSimpleHighlightedScreenshots(screenshotPath1, screenshotPath2, differences, timestamp) {
    const annotatedPath1 = join(SCREENSHOTS_DIR, `${timestamp}_url1_highlighted.png`);
    const annotatedPath2 = join(SCREENSHOTS_DIR, `${timestamp}_url2_highlighted.png`);

    // URL 1 (PROD) - Keep clean, no boxes
    const original1 = readFileSync(screenshotPath1);
    writeFileSync(annotatedPath1, original1);

    // URL 2 (PREVIEW) - Show all difference boxes
    await this.createAnnotatedImage(screenshotPath2, annotatedPath2, differences, 'url2');

    console.log('  ✅ URL 1 (Prod): Clean screenshot');
    console.log('  ✅ URL 2 (Preview): Marked with difference boxes');

    return {
      highlighted: {
        url1: `screenshots/${annotatedPath1.split('/').pop()}`,
        url2: `screenshots/${annotatedPath2.split('/').pop()}`
      }
    };
  }

  // Cluster diff pixels into bounding box regions (Percy-style)
  clusterDiffPixels(diffData, width, height) {
    const regions = [];
    const visited = new Set();

    // Helper to check if pixel is different (magenta in diff)
    const isDiffPixel = (x, y) => {
      const idx = (y * width + x) * 4;
      return diffData[idx] === 255 && diffData[idx + 1] === 0 && diffData[idx + 2] === 255;
    };

    // Flood fill to find connected regions
    const floodFill = (startX, startY) => {
      const stack = [[startX, startY]];
      const pixels = [];
      let minX = startX, maxX = startX, minY = startY, maxY = startY;

      while (stack.length > 0) {
        const [x, y] = stack.pop();
        const key = `${x},${y}`;

        if (visited.has(key) || x < 0 || y < 0 || x >= width || y >= height) continue;
        if (!isDiffPixel(x, y)) continue;

        visited.add(key);
        pixels.push([x, y]);

        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);

        // Check 8 neighbors
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            stack.push([x + dx, y + dy]);
          }
        }
      }

      return { pixels, bounds: { minX, maxX, minY, maxY } };
    };

    // Scan for diff pixels and cluster them
    for (let y = 0; y < height; y += 5) { // Skip pixels for faster scan
      for (let x = 0; x < width; x += 5) {
        const key = `${x},${y}`;
        if (!visited.has(key) && isDiffPixel(x, y)) {
          const region = floodFill(x, y);
          // Much higher threshold - ignore tiny regions
          if (region.pixels.length >= 500) {
            const padding = 20;
            regions.push({
              x: Math.max(0, region.bounds.minX - padding),
              y: Math.max(0, region.bounds.minY - padding),
              width: region.bounds.maxX - region.bounds.minX + padding * 2,
              height: region.bounds.maxY - region.bounds.minY + padding * 2,
              pixelCount: region.pixels.length
            });
          }
        }
      }
    }

    // Merge nearby regions (Percy-style grouping) - but don't over-merge!
    const mergeDistance = 100; // Merge regions within 100px
    const maxMergedSize = 500; // Don't merge if result would be > 500px in any dimension
    const merged = [];

    regions.sort((a, b) => a.y - b.y); // Sort by Y position

    for (const region of regions) {
      let wasMerged = false;
      for (const existing of merged) {
        // Calculate what the merged box would look like
        const newMinX = Math.min(existing.x, region.x);
        const newMinY = Math.min(existing.y, region.y);
        const newMaxX = Math.max(existing.x + existing.width, region.x + region.width);
        const newMaxY = Math.max(existing.y + existing.height, region.y + region.height);
        const mergedWidth = newMaxX - newMinX;
        const mergedHeight = newMaxY - newMinY;

        // Don't merge if it would create a huge box
        if (mergedWidth > maxMergedSize || mergedHeight > maxMergedSize) {
          continue;
        }

        // Check if regions are close enough to merge
        const xOverlap = Math.max(0, Math.min(existing.x + existing.width, region.x + region.width) - Math.max(existing.x, region.x));
        const yOverlap = Math.max(0, Math.min(existing.y + existing.height, region.y + region.height) - Math.max(existing.y, region.y));
        const xDistance = Math.abs((existing.x + existing.width/2) - (region.x + region.width/2));
        const yDistance = Math.abs((existing.y + existing.height/2) - (region.y + region.height/2));

        // Only merge if they directly overlap OR are very close in BOTH dimensions
        if (xOverlap > 0 && yOverlap > 0) {
          // Direct overlap - merge
          existing.x = newMinX;
          existing.y = newMinY;
          existing.width = mergedWidth;
          existing.height = mergedHeight;
          existing.pixelCount += region.pixelCount;
          wasMerged = true;
          break;
        } else if (xDistance < mergeDistance && yDistance < mergeDistance) {
          // Close in both directions - merge
          existing.x = newMinX;
          existing.y = newMinY;
          existing.width = mergedWidth;
          existing.height = mergedHeight;
          existing.pixelCount += region.pixelCount;
          wasMerged = true;
          break;
        }
      }

      if (!wasMerged) {
        merged.push({...region});
      }
    }

    console.log(`  📦 Found ${merged.length} meaningful difference regions (merged from ${regions.length} raw clusters)`);
    return merged;
  }

  // Identify what changed in each region and get precise element bounds
  async identifyRegionChanges(page1, page2, regions) {
    const differences = [];

    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      console.log(`  🔍 Analyzing region ${i + 1}/${regions.length} at (${region.x}, ${region.y})...`);

      try {
        // Find all leaf elements within this region on both pages
        const [elements1, elements2] = await Promise.all([
          page1.evaluate((bounds) => {
            const found = [];
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
            let node;

            while (node = walker.nextNode()) {
              // Check if element is within region bounds
              const rect = node.getBoundingClientRect();
              if (rect.left >= bounds.x && rect.left <= bounds.x + bounds.width &&
                  rect.top >= bounds.y && rect.top <= bounds.y + bounds.height) {

                // Only include leaf elements with text
                if (node.children.length === 0) {
                  const text = (node.innerText || node.textContent || '').trim();
                  if (text.length > 0 && text.length < 200) {
                    found.push({
                      text,
                      bounds: {
                        x: Math.round(rect.left + window.scrollX),
                        y: Math.round(rect.top + window.scrollY),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height)
                      }
                    });
                  }
                }
              }
            }
            return found;
          }, region),
          page2.evaluate((bounds) => {
            const found = [];
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
            let node;

            while (node = walker.nextNode()) {
              const rect = node.getBoundingClientRect();
              if (rect.left >= bounds.x && rect.left <= bounds.x + bounds.width &&
                  rect.top >= bounds.y && rect.top <= bounds.y + bounds.height) {

                if (node.children.length === 0) {
                  const text = (node.innerText || node.textContent || '').trim();
                  if (text.length > 0 && text.length < 200) {
                    found.push({
                      text,
                      bounds: {
                        x: Math.round(rect.left + window.scrollX),
                        y: Math.round(rect.top + window.scrollY),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height)
                      }
                    });
                  }
                }
              }
            }
            return found;
          }, region)
        ]);

        // Compare elements between pages
        const text1Set = new Set(elements1.map(e => e.text));
        const text2Set = new Set(elements2.map(e => e.text));

        // Find changed, added, and removed elements
        const changed = [];

        // Check for currency changes (same position, different amount)
        elements1.forEach(el1 => {
          const currency1 = el1.text.match(/\$[\d,]+\.?\d*/);
          if (currency1) {
            // Find element at similar position on page2
            const el2 = elements2.find(e =>
              Math.abs(e.bounds.x - el1.bounds.x) < 50 &&
              Math.abs(e.bounds.y - el1.bounds.y) < 50
            );

            if (el2) {
              const currency2 = el2.text.match(/\$[\d,]+\.?\d*/);
              if (currency2 && currency1[0] !== currency2[0]) {
                changed.push({
                  type: 'Content',
                  category: 'Currency Amount Changed',
                  severity: 'high',
                  detail: `Amount changed from ${currency1[0]} to ${currency2[0]}`,
                  url1Value: el1.text,
                  url2Value: el2.text,
                  location: `Position (${el1.bounds.x}, ${el1.bounds.y})`,
                  coordinates: [
                    { url1: el1.bounds },
                    { url2: el2.bounds }
                  ]
                });
              }
            }
          }
        });

        // Check for added content
        elements2.forEach(el2 => {
          if (!text1Set.has(el2.text)) {
            changed.push({
              type: 'Content',
              category: 'Content Added',
              severity: 'high',
              detail: `New content: "${el2.text.substring(0, 50)}"`,
              url1Value: 'Not present',
              url2Value: el2.text,
              location: `Position (${el2.bounds.x}, ${el2.bounds.y})`,
              coordinates: [
                { url2: el2.bounds }
              ]
            });
          }
        });

        // Check for removed content
        elements1.forEach(el1 => {
          if (!text2Set.has(el1.text)) {
            changed.push({
              type: 'Content',
              category: 'Content Removed',
              severity: 'high',
              detail: `Removed content: "${el1.text.substring(0, 50)}"`,
              url1Value: el1.text,
              url2Value: 'Not present',
              location: `Position (${el1.bounds.x}, ${el1.bounds.y})`,
              coordinates: [
                { url1: el1.bounds }
              ]
            });
          }
        });

        differences.push(...changed);

      } catch (error) {
        console.error(`  ⚠️  Error analyzing region ${i + 1}:`, error.message);
      }
    }

    console.log(`  ✅ Found ${differences.length} meaningful content differences`);
    return differences;
  }

  async createHighlightedScreenshots(screenshotPath1, screenshotPath2, page1, page2, timestamp) {
    try {
      console.log('  🎨 Analyzing pixel-level differences...');

      // Read both images and get metadata
      const img1Metadata = await sharp(screenshotPath1).metadata();
      const img2Metadata = await sharp(screenshotPath2).metadata();

      // Determine target dimensions (use the larger dimensions)
      const targetWidth = Math.max(img1Metadata.width, img2Metadata.width);
      const targetHeight = Math.max(img1Metadata.height, img2Metadata.height);

      console.log(`  📐 Resizing images to ${targetWidth}x${targetHeight}...`);

      // Resize both images to the same dimensions with white background
      const img1Buffer = await sharp(screenshotPath1)
        .resize(targetWidth, targetHeight, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toBuffer();

      const img2Buffer = await sharp(screenshotPath2)
        .resize(targetWidth, targetHeight, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toBuffer();

      const img1 = PNG.sync.read(img1Buffer);
      const img2 = PNG.sync.read(img2Buffer);

      // Create diff image
      const diff = new PNG({ width: targetWidth, height: targetHeight });

      // Perform pixel-level comparison with MORE SENSITIVE settings
      const numDiffPixels = pixelmatch(
        img1.data,
        img2.data,
        diff.data,
        targetWidth,
        targetHeight,
        {
          threshold: 0.1,        // Lower threshold = more sensitive
          includeAA: false,      // Exclude anti-aliasing differences
          alpha: 0.2,            // More transparent diff overlay
          diffColor: [255, 0, 255]  // Magenta for clustering
        }
      );

      console.log(`  📊 Found ${numDiffPixels} different pixels`);

      // Cluster diff pixels into regions
      const regions = this.clusterDiffPixels(diff.data, targetWidth, targetHeight);

      // Identify what changed in each region
      const differences = await this.identifyRegionChanges(page1, page2, regions);

      // Create annotated versions with colored boxes
      const annotatedPath1 = join(SCREENSHOTS_DIR, `${timestamp}_url1_highlighted.png`);
      const annotatedPath2 = join(SCREENSHOTS_DIR, `${timestamp}_url2_highlighted.png`);
      const diffPath = join(SCREENSHOTS_DIR, `${timestamp}_diff.png`);

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
        pixelDifferences: numDiffPixels,
        differences
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

      // Create SVG overlay with bounding boxes and badges
      const severityColors = {
        high: { color: '#ff453a', label: 'HIGH' },
        medium: { color: '#ff9f0a', label: 'MED' },
        low: { color: '#0a84ff', label: 'LOW' }
      };

      // Draw bounding boxes around differences (NO SIDEBAR BADGES)
      const boundingBoxes = [];

      differences.forEach((diff, index) => {
        const colorInfo = severityColors[diff.severity] || severityColors.low;

        // Draw bounding boxes if coordinates are available
        if (diff.coordinates && Array.isArray(diff.coordinates)) {
          diff.coordinates.forEach(coord => {
            const bounds = coord[urlType]; // Get bounds for current URL (url1 or url2)
            if (bounds) {
              boundingBoxes.push(`
                <rect
                  x="${bounds.x}"
                  y="${bounds.y}"
                  width="${bounds.width}"
                  height="${bounds.height}"
                  fill="none"
                  stroke="${colorInfo.color}"
                  stroke-width="3"
                  stroke-opacity="0.9"
                  rx="4"
                />
                <rect
                  x="${bounds.x}"
                  y="${bounds.y}"
                  width="${bounds.width}"
                  height="${bounds.height}"
                  fill="${colorInfo.color}"
                  fill-opacity="0.15"
                  rx="4"
                />
                <!-- Label badge inside box -->
                <text
                  x="${bounds.x + 5}"
                  y="${bounds.y + 20}"
                  font-family="Arial, sans-serif"
                  font-size="12"
                  font-weight="bold"
                  fill="${colorInfo.color}"
                  style="text-shadow: 1px 1px 3px rgba(0,0,0,0.8);"
                >
                  ${colorInfo.label} ${index + 1}
                </text>
              `);
            }
          });
        }
      });

      const svgOverlay = `
        <svg width="${metadata.width}" height="${metadata.height}">
          ${boundingBoxes.join('\n')}
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
    this.emit('step', { step: 1, detail: 'Launching browser...' });
    const browser = await chromium.launch({ headless: true });
    const timestamp = Date.now();

    try {
      this.emit('step', { step: 1, detail: 'Opening both URLs in browser...' });
      const context1 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      const context2 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // Capture data and screenshots
      this.emit('step', { step: 1, detail: 'Navigating to URLs and waiting for load...' });
      const [data1, data2] = await Promise.all([
        this.capturePageData(page1, this.config.url1),
        this.capturePageData(page2, this.config.url2)
      ]);

      this.emit('step', { step: 4, detail: '📸 Capturing page 1 screenshot...' });
      const screenshotPath1 = join(SCREENSHOTS_DIR, `${timestamp}_url1.png`);
      const screenshotPath2 = join(SCREENSHOTS_DIR, `${timestamp}_url2.png`);

      await page1.screenshot({ path: screenshotPath1, fullPage: true });

      this.emit('step', { step: 4, detail: '📸 Capturing page 2 screenshot...' });
      await page2.screenshot({ path: screenshotPath2, fullPage: true });

      this.emit('step', { step: 5, detail: '🔬 Analyzing page elements...' });
      // SIMPLE APPROACH: Direct DOM comparison
      const differences = await this.comparePageElements(page1, page2);

      this.emit('step', { step: 5, detail: `🎯 Found ${differences.length} differences` });
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause to show the count

      this.emit('step', { step: 6, detail: `✏️ Drawing ${differences.length} difference boxes...` });
      // Create highlighted screenshots with bounding boxes
      const highlightedResults = await this.createSimpleHighlightedScreenshots(
        screenshotPath1,
        screenshotPath2,
        differences,
        timestamp
      );

      await context1.close();
      await context2.close();
      await browser.close();

      return {
        timestamp,
        config: this.config,
        screenshots: {
          url1: `screenshots/${screenshotPath1.split('/').pop()}`,
          url2: `screenshots/${screenshotPath2.split('/').pop()}`,
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
// Store socket connections for real-time updates
let activeSocket = null;

io.on('connection', (socket) => {
  console.log('✅ Client connected for real-time updates');
  activeSocket = socket;

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected');
    if (activeSocket === socket) {
      activeSocket = null;
    }
  });
});

app.post('/api/compare', async (req, res) => {
  try {
    const { url1, url2, description, clickAction } = req.body;

    if (!url1 || !url2) {
      return res.status(400).json({ error: 'Both URLs are required' });
    }

    // Check if URLs are identical
    if (url1.trim() === url2.trim()) {
      console.log(`\n⚠️  WARNING: Both URLs are identical - no comparison needed`);
      return res.status(400).json({
        error: 'Both URLs are identical. Please provide two different URLs to compare.',
        identical: true
      });
    }

    console.log(`\n🔍 Starting comparison: ${url1} vs ${url2}`);

    // Parse multiple click actions separated by commas
    // ALWAYS compare default view first, then compare button states if provided
    const buttonActions = clickAction
      ? clickAction.split(',').map(action => action.trim()).filter(Boolean)
      : [];

    // Build comparison list: [null (default), ...buttonActions]
    const clickActions = [null, ...buttonActions];

    if (buttonActions.length > 0) {
      console.log(`  🖱️  Will compare: Default view + [${buttonActions.join(', ')}]`);
    } else {
      console.log(`  📍 Will compare: Default view only`);
    }

    // Run comparison for each state (default + button states)
    const results = [];
    for (const action of clickActions) {
      console.log(action ? `\n  📍 Comparing with "${action}" clicked...` : '\n  📍 Comparing default view...');

      const engine = new UIComparisonEngine({ url1, url2, description, clickAction: action }, activeSocket);
      const result = await engine.run();

      results.push({
        ...result,
        clickedButton: action || 'Default View'
      });
    }

    // Save combined results
    const timestamp = Date.now();
    const combinedResult = {
      timestamp,
      config: { url1, url2, description, clickActions: clickActions },
      comparisons: results,
      totalComparisons: results.length
    };

    const resultPath = join(RESULTS_DIR, `${timestamp}.json`);
    writeFileSync(resultPath, JSON.stringify(combinedResult, null, 2));

    console.log(`✅ All comparisons completed: ${results.length} states compared`);

    res.json({
      success: true,
      result: combinedResult
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
    const resultPath = join(RESULTS_DIR, `${req.params.id}.json`);
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
httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     🤖 UI Comparison Web App - Running                    ║
║     ⚡ Real-time Progress Updates Enabled                  ║
║                                                            ║
║     📍 Server: http://localhost:${PORT}                        ║
║     📊 API: http://localhost:${PORT}/api/compare               ║
║                                                            ║
║     Drop any two URLs to compare their UI!                ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
