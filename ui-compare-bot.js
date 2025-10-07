#!/usr/bin/env node
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

class UICompareBot {
  constructor(config) {
    this.baseUrl1 = config.baseUrl1;
    this.baseUrl2 = config.baseUrl2;
    this.ebtoken1 = config.ebtoken1;
    this.ebtoken2 = config.ebtoken2;
    this.pages = config.pages;
    this.report = [];
    this.screenshotDir = 'screenshots';

    // Create screenshots directory
    try {
      mkdirSync(this.screenshotDir, { recursive: true });
    } catch (e) {
      // Directory might already exist
    }
  }

  async capturePageData(page, url, ebtoken) {
    // Append ebtoken as query parameter (Rakuten authentication method)
    const urlWithToken = url.includes('?')
      ? `${url}&ebtoken=${ebtoken}`
      : `${url}?ebtoken=${ebtoken}`;

    console.log(`  Loading ${url}...`);

    try {
      await page.goto(urlWithToken, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (error) {
      // Try with load event if domcontentloaded fails
      await page.goto(urlWithToken, { waitUntil: 'load', timeout: 30000 });
    }
    await page.waitForTimeout(3000);

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
        tabs: [],
        dynamicElements: [],
        structure: []
      };

      // Extract headings
      document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(el => {
        if (isVisible(el)) {
          data.headings.push({
            tag: el.tagName.toLowerCase(),
            text: extractText(el),
            class: el.className
          });
        }
      });

      // Extract visible text
      document.querySelectorAll('p, div, span, li').forEach(el => {
        if (isVisible(el) && el.innerText) {
          const text = extractText(el);
          if (text.length > 5 && text.length < 200 && !text.includes('\n\n')) {
            data.visibleText.push(text);
          }
        }
      });

      // Extract buttons
      document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]').forEach(el => {
        if (isVisible(el)) {
          data.buttons.push({
            text: extractText(el) || el.value || el.getAttribute('aria-label') || 'Unlabeled',
            class: el.className,
            role: el.getAttribute('role') || 'button'
          });
        }
      });

      // Extract links
      document.querySelectorAll('a[href]').forEach(el => {
        if (isVisible(el)) {
          const href = el.getAttribute('href');
          // Filter out analytics/tracking links
          if (!href.includes('analytics') && !href.includes('tracking')) {
            data.links.push({
              text: extractText(el),
              href: href,
              class: el.className
            });
          }
        }
      });

      // Extract tabs and interactive elements
      document.querySelectorAll('[role="tab"], .tab, [data-tab]').forEach(el => {
        if (isVisible(el)) {
          data.tabs.push({
            text: extractText(el),
            role: el.getAttribute('role'),
            class: el.className,
            ariaSelected: el.getAttribute('aria-selected')
          });
        }
      });

      // Extract main structure
      const bodyChildren = document.querySelectorAll('body > *');
      bodyChildren.forEach(el => {
        if (isVisible(el) && el.tagName !== 'SCRIPT') {
          data.structure.push({
            tag: el.tagName.toLowerCase(),
            class: el.className,
            id: el.id
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

  async detectAndClickInteractiveElements(page) {
    console.log(`  Detecting interactive elements...`);

    const interactionResults = [];

    // Find all tabs/buttons that might reveal content
    const interactiveSelectors = [
      '[role="tab"]',
      'button[data-tab]',
      'a[role="tab"]',
      '.tab-button',
      '[aria-controls]'
    ];

    for (const selector of interactiveSelectors) {
      try {
        const elements = await page.$$(selector);

        for (let i = 0; i < Math.min(elements.length, 5); i++) {
          const element = elements[i];
          const isVisible = await element.isVisible();

          if (isVisible) {
            const text = await element.innerText().catch(() => '');
            const ariaLabel = await element.getAttribute('aria-label').catch(() => '');
            const label = text || ariaLabel || `Element ${i}`;

            console.log(`    Clicking: ${label}`);

            try {
              await element.click();
              await page.waitForTimeout(1500);

              // Capture content after click
              const content = await page.evaluate(() => {
                const mainContent = document.querySelector('main, [role="main"], .main-content, #content');
                return mainContent ? mainContent.innerText : document.body.innerText;
              });

              interactionResults.push({
                label,
                selector,
                content: content.substring(0, 500)
              });
            } catch (clickError) {
              console.log(`    Could not click ${label}: ${clickError.message}`);
            }
          }
        }
      } catch (error) {
        // Selector not found, continue
      }
    }

    return interactionResults;
  }

  compareData(data1, data2) {
    const differences = [];

    // Compare titles
    if (data1.title !== data2.title) {
      differences.push({
        type: 'Text',
        category: 'Page Title',
        detail: `Production: "${data1.title}" vs Preview: "${data2.title}"`
      });
    }

    // Compare headings
    const headings1 = data1.headings.map(h => `${h.tag}: ${h.text}`);
    const headings2 = data2.headings.map(h => `${h.tag}: ${h.text}`);
    const headingsAdded = headings2.filter(h => !headings1.includes(h));
    const headingsRemoved = headings1.filter(h => !headings2.includes(h));

    if (headingsAdded.length > 0) {
      differences.push({
        type: 'Text',
        category: 'Headings Added',
        detail: headingsAdded.slice(0, 5).join('; ')
      });
    }

    if (headingsRemoved.length > 0) {
      differences.push({
        type: 'Text',
        category: 'Headings Removed',
        detail: headingsRemoved.slice(0, 5).join('; ')
      });
    }

    // Compare visible text
    const textAdded = data2.visibleText.filter(t => !data1.visibleText.includes(t));
    const textRemoved = data1.visibleText.filter(t => !data2.visibleText.includes(t));

    if (textAdded.length > 0) {
      differences.push({
        type: 'Text',
        category: 'Content Added',
        detail: `${textAdded.length} new text elements. Examples: ${textAdded.slice(0, 3).map(t => `"${t.substring(0, 50)}"`).join('; ')}`
      });
    }

    if (textRemoved.length > 0) {
      differences.push({
        type: 'Text',
        category: 'Content Removed',
        detail: `${textRemoved.length} text elements removed. Examples: ${textRemoved.slice(0, 3).map(t => `"${t.substring(0, 50)}"`).join('; ')}`
      });
    }

    // Compare buttons
    const buttons1 = data1.buttons.map(b => b.text);
    const buttons2 = data2.buttons.map(b => b.text);
    const buttonsAdded = buttons2.filter(b => !buttons1.includes(b));
    const buttonsRemoved = buttons1.filter(b => !buttons2.includes(b));

    if (buttonsAdded.length > 0) {
      differences.push({
        type: 'Layout',
        category: 'Buttons Added',
        detail: buttonsAdded.slice(0, 5).map(b => `"${b}"`).join('; ')
      });
    }

    if (buttonsRemoved.length > 0) {
      differences.push({
        type: 'Layout',
        category: 'Buttons Removed',
        detail: buttonsRemoved.slice(0, 5).map(b => `"${b}"`).join('; ')
      });
    }

    // Compare structure
    const struct1 = data1.structure.map(s => s.tag);
    const struct2 = data2.structure.map(s => s.tag);

    if (JSON.stringify(struct1) !== JSON.stringify(struct2)) {
      differences.push({
        type: 'Layout',
        category: 'Page Structure',
        detail: `Different DOM structure detected. Production: ${struct1.length} top-level elements, Preview: ${struct2.length} top-level elements`
      });
    }

    return differences;
  }

  compareInteractions(interactions1, interactions2) {
    const differences = [];

    const labels1 = interactions1.map(i => i.label);
    const labels2 = interactions2.map(i => i.label);

    const added = labels2.filter(l => !labels1.includes(l));
    const removed = labels1.filter(l => !labels2.includes(l));

    if (added.length > 0) {
      differences.push({
        type: 'Behavior',
        category: 'Interactive Elements Added',
        detail: added.join('; ')
      });
    }

    if (removed.length > 0) {
      differences.push({
        type: 'Behavior',
        category: 'Interactive Elements Removed',
        detail: removed.join('; ')
      });
    }

    // Compare content for common elements
    for (const int1 of interactions1) {
      const int2 = interactions2.find(i => i.label === int1.label);
      if (int2 && int1.content !== int2.content) {
        differences.push({
          type: 'Behavior',
          category: `Content differs for "${int1.label}"`,
          detail: `Different content loaded after interaction`
        });
      }
    }

    return differences;
  }

  generateMarkdownReport() {
    let markdown = '# UI Comparison Report: Production vs Preview\n\n';
    markdown += `**Generated:** ${new Date().toLocaleString()}\n\n`;
    markdown += `**Production:** ${this.baseUrl1}\n`;
    markdown += `**Preview:** ${this.baseUrl2}\n\n`;
    markdown += '---\n\n';

    for (const pageReport of this.report) {
      markdown += `## Page: ${pageReport.path}\n\n`;
      markdown += `**Production URL:** ${pageReport.prodUrl}\n`;
      markdown += `**Preview URL:** ${pageReport.previewUrl}\n\n`;

      // Add screenshot links
      if (pageReport.screenshots) {
        markdown += `### 📸 Visual Comparison\n\n`;
        markdown += `**Production Screenshot:**\n`;
        markdown += `![Production](${pageReport.screenshots.production})\n\n`;
        markdown += `**Preview Screenshot:**\n`;
        markdown += `![Preview](${pageReport.screenshots.preview})\n\n`;
      }

      if (pageReport.differences.length === 0) {
        markdown += '✅ **No differences detected**\n\n';
      } else {
        markdown += `### Summary: ${pageReport.differences.length} difference(s) found\n\n`;

        // Group by type
        const byType = {};
        pageReport.differences.forEach(diff => {
          if (!byType[diff.type]) byType[diff.type] = [];
          byType[diff.type].push(diff);
        });

        for (const [type, diffs] of Object.entries(byType)) {
          markdown += `#### ${type} Differences\n\n`;
          markdown += '| Category | Details |\n';
          markdown += '|----------|----------|\n';

          diffs.forEach(diff => {
            markdown += `| ${diff.category} | ${diff.detail} |\n`;
          });

          markdown += '\n';
        }
      }

      // Add interaction differences if present
      if (pageReport.interactionDifferences && pageReport.interactionDifferences.length > 0) {
        markdown += '### Dynamic Content Differences\n\n';
        markdown += '| Category | Details |\n';
        markdown += '|----------|----------|\n';

        pageReport.interactionDifferences.forEach(diff => {
          markdown += `| ${diff.category} | ${diff.detail} |\n`;
        });

        markdown += '\n';
      }

      markdown += '---\n\n';
    }

    return markdown;
  }

  async run() {
    console.log('\n🤖 UICompareBot - Starting UI Comparison\n');
    console.log(`Production: ${this.baseUrl1}`);
    console.log(`Preview: ${this.baseUrl2}`);
    console.log(`Pages to compare: ${this.pages.join(', ')}\n`);

    const browser = await chromium.launch({ headless: true });

    try {
      for (const pagePath of this.pages) {
        console.log(`\n📄 Comparing page: ${pagePath}`);

        const prodUrl = this.baseUrl1 + pagePath;
        const previewUrl = this.baseUrl2 + pagePath;

        // Create contexts
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();

        const page1 = await context1.newPage();
        const page2 = await context2.newPage();

        // Capture static content
        console.log('\n  🔍 Capturing static content...');
        const [prodData, previewData] = await Promise.all([
          this.capturePageData(page1, prodUrl, this.ebtoken1),
          this.capturePageData(page2, previewUrl, this.ebtoken2)
        ]);

        // Capture screenshots
        console.log('\n  📸 Capturing screenshots...');
        const screenshotName = pagePath.replace(/\//g, '_') || 'home';
        const prodScreenshot = join(this.screenshotDir, `${screenshotName}_prod.png`);
        const previewScreenshot = join(this.screenshotDir, `${screenshotName}_preview.png`);

        await Promise.all([
          page1.screenshot({ path: prodScreenshot, fullPage: true }),
          page2.screenshot({ path: previewScreenshot, fullPage: true })
        ]);

        console.log(`    Production: ${prodScreenshot}`);
        console.log(`    Preview: ${previewScreenshot}`);

        // Compare static content
        const differences = this.compareData(prodData, previewData);

        // Detect and interact with dynamic elements
        console.log('\n  🖱️  Testing dynamic interactions...');
        const [prodInteractions, previewInteractions] = await Promise.all([
          this.detectAndClickInteractiveElements(page1),
          this.detectAndClickInteractiveElements(page2)
        ]);

        // Compare interactions
        const interactionDifferences = this.compareInteractions(prodInteractions, previewInteractions);

        // Store results
        this.report.push({
          path: pagePath,
          prodUrl,
          previewUrl,
          differences,
          interactionDifferences,
          screenshots: {
            production: prodScreenshot,
            preview: previewScreenshot
          }
        });

        await context1.close();
        await context2.close();

        console.log(`  ✅ Completed: ${differences.length} static differences, ${interactionDifferences.length} interaction differences`);
      }

      await browser.close();

      // Generate and save report
      console.log('\n📝 Generating Markdown report...');
      const markdown = this.generateMarkdownReport();
      writeFileSync('ui_comparison_report.md', markdown);
      console.log('✅ Report saved to: ui_comparison_report.md\n');

      // Print summary
      console.log('📊 Summary:');
      this.report.forEach(page => {
        const totalDiffs = page.differences.length + (page.interactionDifferences?.length || 0);
        console.log(`  ${page.path}: ${totalDiffs} total difference(s)`);
      });
      console.log('');

    } catch (error) {
      await browser.close();
      throw error;
    }
  }
}

// Configuration
const config = {
  baseUrl1: "https://www.rakuten.com",
  baseUrl2: "https://preview-www.rakuten.com",
  ebtoken1: "eyJhbGciOiJSUzI1NiJ9.eyJjcnQiOjE3NTgxNTQzNDQxNzcsImxsdCI6MTc1ODE1NDM0NDE3NywibUlkIjoiMTQ1Mzg2MzZBRTQzQjRDOTI4QUJCQzYifQ.rfgcLkNDYRB3SIpTU0upuCQ4nlHalSmRV_0tGdT_yi-yUOPJSe0VyyQ2fGtutdcf9UAI2xaXTYtsHiIDrYUY_7DyfUBk5dtynELqqS4pPcgWixQUr62s7VsJz05CWHYDOn47MyDabCRoV7rwYHqhG3FccrF3TUECwnGmLFunXiA",
  ebtoken2: "eyJhbGciOiJSUzI1NiJ9.eyJjcnQiOjE3NTgxNTQzNDQxNzcsImxsdCI6MTc1ODE1NDM0NDE3NywibUlkIjoiMTQ1Mzg2MzZBRTQzQjRDOTI4QUJCQzYifQ.rfgcLkNDYRB3SIpTU0upuCQ4nlHalSmRV_0tGdT_yi-yUOPJSe0VyyQ2fGtutdcf9UAI2xaXTYtsHiIDrYUY_7DyfUBk5dtynELqqS4pPcgWixQUr62s7VsJz05CWHYDOn47MyDabCRoV7rwYHqhG3FccrF3TUECwnGmLFunXiA",
  pages: ["/", "/account", "/account/cash-back-activity"]
};

// Run the bot
const bot = new UICompareBot(config);
bot.run().catch(error => {
  console.error(`\n❌ Error: ${error.message}\n`);
  process.exit(1);
});
