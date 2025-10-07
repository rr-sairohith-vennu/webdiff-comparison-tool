#!/usr/bin/env node
import { chromium } from 'playwright';
import chalk from 'chalk';

class WebDiffPlaywright {
  constructor(previewUrl, productionUrl) {
    this.previewUrl = previewUrl;
    this.productionUrl = productionUrl;
  }

  async capturePageData(page, url) {
    console.log(chalk.gray(`  Loading ${url}...`));
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for page to be fully rendered
    await page.waitForTimeout(3000);

    const data = await page.evaluate(() => {
      const data = {
        title: document.title,
        headings: [],
        visibleText: [],
        links: [],
        buttons: [],
        images: [],
        colors: {
          backgrounds: new Set(),
          textColors: new Set(),
          borderColors: new Set()
        },
        classes: new Set(),
        structure: []
      };

      // Helper to check if element is visible
      const isVisible = (el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' &&
               style.visibility !== 'hidden' &&
               style.opacity !== '0' &&
               el.offsetWidth > 0 &&
               el.offsetHeight > 0;
      };

      // Extract headings
      document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(el => {
        if (isVisible(el)) {
          data.headings.push({
            tag: el.tagName.toLowerCase(),
            text: el.innerText.trim(),
            class: el.className
          });
        }
      });

      // Extract visible text from paragraphs and divs with text
      document.querySelectorAll('p, div, span, a, button, li').forEach(el => {
        if (isVisible(el) && el.innerText && el.innerText.trim().length > 0) {
          const text = el.innerText.trim();
          // Only direct text, not nested
          if (text.length < 300 && !text.includes('\n\n')) {
            data.visibleText.push(text);
          }
        }
      });

      // Extract links
      document.querySelectorAll('a[href]').forEach(el => {
        if (isVisible(el)) {
          data.links.push({
            text: el.innerText.trim(),
            href: el.getAttribute('href'),
            class: el.className
          });
        }
      });

      // Extract buttons
      document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]').forEach(el => {
        if (isVisible(el)) {
          data.buttons.push({
            text: el.innerText.trim() || el.value || el.getAttribute('aria-label') || '',
            class: el.className,
            type: el.tagName.toLowerCase()
          });
        }
      });

      // Extract images with alt text
      document.querySelectorAll('img').forEach(el => {
        if (isVisible(el)) {
          data.images.push({
            alt: el.alt || '',
            src: el.src.substring(0, 100),
            class: el.className
          });
        }
      });

      // Extract computed colors from visible elements
      document.querySelectorAll('*').forEach(el => {
        if (isVisible(el)) {
          const style = window.getComputedStyle(el);

          // Background colors
          const bgColor = style.backgroundColor;
          if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
            data.colors.backgrounds.add(bgColor);
          }

          // Text colors
          const textColor = style.color;
          if (textColor) {
            data.colors.textColors.add(textColor);
          }

          // Border colors
          const borderColor = style.borderColor;
          if (borderColor && borderColor !== 'rgb(0, 0, 0)') {
            data.colors.borderColors.add(borderColor);
          }

          // Classes
          if (el.className && typeof el.className === 'string') {
            el.className.split(' ').forEach(c => {
              if (c.trim()) data.classes.add(c.trim());
            });
          }
        }
      });

      // Extract main structure
      document.querySelectorAll('body > *').forEach(el => {
        if (isVisible(el)) {
          data.structure.push({
            tag: el.tagName.toLowerCase(),
            class: el.className,
            id: el.id,
            text: el.innerText?.substring(0, 50) || ''
          });
        }
      });

      return {
        ...data,
        visibleText: [...new Set(data.visibleText)].sort(),
        colors: {
          backgrounds: Array.from(data.colors.backgrounds).sort(),
          textColors: Array.from(data.colors.textColors).sort(),
          borderColors: Array.from(data.colors.borderColors).sort()
        },
        classes: Array.from(data.classes).sort()
      };
    });

    return data;
  }

  compareArrays(arr1, arr2, label, maxShow = 10) {
    const str1 = arr1.map(item => typeof item === 'string' ? item : JSON.stringify(item));
    const str2 = arr2.map(item => typeof item === 'string' ? item : JSON.stringify(item));

    const added = str2.filter(item => !str1.includes(item));
    const removed = str1.filter(item => !str2.includes(item));

    return {
      label,
      added: added.slice(0, maxShow),
      removed: removed.slice(0, maxShow),
      addedTotal: added.length,
      removedTotal: removed.length,
      hasChanges: added.length > 0 || removed.length > 0
    };
  }

  printComparison(comparison) {
    if (!comparison.hasChanges) return;

    console.log(chalk.bold(`\n📍 ${comparison.label}:`));

    if (comparison.removedTotal > 0) {
      console.log(chalk.red(`  ❌ Removed (${comparison.removedTotal} total):`));
      comparison.removed.forEach(item => {
        const display = item.length > 100 ? item.substring(0, 100) + '...' : item;
        console.log(chalk.red(`     - ${display}`));
      });
      if (comparison.removedTotal > comparison.removed.length) {
        console.log(chalk.red(`     ... and ${comparison.removedTotal - comparison.removed.length} more`));
      }
    }

    if (comparison.addedTotal > 0) {
      console.log(chalk.green(`  ✅ Added (${comparison.addedTotal} total):`));
      comparison.added.forEach(item => {
        const display = item.length > 100 ? item.substring(0, 100) + '...' : item;
        console.log(chalk.green(`     + ${display}`));
      });
      if (comparison.addedTotal > comparison.added.length) {
        console.log(chalk.green(`     ... and ${comparison.addedTotal - comparison.added.length} more`));
      }
    }
  }

  async compare() {
    console.log(chalk.blue.bold('\n🔍 WebDiff (Playwright) - Comparing Rendered Pages...\n'));
    console.log(chalk.gray(`Preview:    ${this.previewUrl}`));
    console.log(chalk.gray(`Production: ${this.productionUrl}\n`));

    const browser = await chromium.launch({ headless: true });

    try {
      // Create two contexts for parallel loading
      const [context1, context2] = await Promise.all([
        browser.newContext(),
        browser.newContext()
      ]);

      const [page1, page2] = await Promise.all([
        context1.newPage(),
        context2.newPage()
      ]);

      console.log(chalk.yellow('🌐 Loading pages with browser...'));

      // Capture both pages in parallel
      const [previewData, productionData] = await Promise.all([
        this.capturePageData(page1, this.previewUrl),
        this.capturePageData(page2, this.productionUrl)
      ]);

      await browser.close();

      // Compare all aspects
      console.log(chalk.green.bold('\n✅ Pages Loaded! Analyzing differences...\n'));
      console.log(chalk.bold('═'.repeat(70)));

      const comparisons = [
        this.compareArrays([previewData.title], [productionData.title], 'Page Title', 1),
        this.compareArrays(previewData.headings, productionData.headings, 'Headings (H1-H6)'),
        this.compareArrays(previewData.visibleText, productionData.visibleText, 'Visible Text Content', 15),
        this.compareArrays(previewData.buttons, productionData.buttons, 'Buttons'),
        this.compareArrays(previewData.links, productionData.links, 'Links', 20),
        this.compareArrays(previewData.images, productionData.images, 'Images', 10),
        this.compareArrays(previewData.colors.backgrounds, productionData.colors.backgrounds, 'Background Colors', 15),
        this.compareArrays(previewData.colors.textColors, productionData.colors.textColors, 'Text Colors', 15),
        this.compareArrays(previewData.classes, productionData.classes, 'CSS Classes', 20),
        this.compareArrays(previewData.structure, productionData.structure, 'Page Structure')
      ];

      const changesFound = comparisons.filter(c => c.hasChanges);

      if (changesFound.length === 0) {
        console.log(chalk.yellow('\n⚠️  No differences detected between pages.'));
      } else {
        changesFound.forEach(comparison => this.printComparison(comparison));

        console.log(chalk.bold(`\n📊 Summary: ${changesFound.length} section(s) with differences`));
      }

      console.log(chalk.bold('═'.repeat(70) + '\n'));

      return { comparisons, previewData, productionData };

    } catch (error) {
      await browser.close();
      throw error;
    }
  }
}

// CLI Usage
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log(chalk.yellow('Usage: node webdiff-playwright.js <preview-url> <production-url>'));
  console.log(chalk.gray('\nExample:'));
  console.log(chalk.gray('  node webdiff-playwright.js https://preview.example.com https://example.com'));
  process.exit(1);
}

const [previewUrl, productionUrl] = args;
const differ = new WebDiffPlaywright(previewUrl, productionUrl);

differ.compare().catch(error => {
  console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
  process.exit(1);
});
