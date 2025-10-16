import { chromium } from 'playwright';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import percySnapshot from '@percy/playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config();

// Configuration
const config = {
  url: process.env.TEST_URL || 'https://example.com',
  buttons: process.env.BUTTONS ? process.env.BUTTONS.split(',').map(b => b.trim()) : [],
  percyToken: process.env.PERCY_TOKEN,
  projectName: process.env.PERCY_PROJECT || 'percy-visual-testing',
  screenshotDir: path.join(__dirname, 'screenshots'),

  // Authentication config
  loginUrl: process.env.LOGIN_URL,
  username: process.env.AUTH_USERNAME,
  password: process.env.AUTH_PASSWORD,
  usernameSelector: process.env.USERNAME_SELECTOR || 'input[name="username"]',
  passwordSelector: process.env.PASSWORD_SELECTOR || 'input[name="password"]',
  submitSelector: process.env.SUBMIT_SELECTOR || 'button[type="submit"]',

  waitForPopups: 2000,
  popupSelectors: [
    '[role="dialog"]',
    '[class*="modal"]',
    '[class*="popup"]',
    '[class*="banner"]',
    '[class*="cookie"]',
    '.modal',
    '.popup',
    '#popup',
    '[aria-modal="true"]'
  ]
};

// Validate Percy token
if (!config.percyToken) {
  console.error(chalk.red('\n❌ ERROR: PERCY_TOKEN environment variable not set!'));
  console.log(chalk.yellow('\nPlease set your Percy token in .env file:'));
  console.log(chalk.cyan('  PERCY_TOKEN=your_percy_token_here\n'));
  process.exit(1);
}

class PercyVisualTester {
  constructor(config) {
    this.config = config;
    this.browser = null;
    this.page = null;
    this.context = null;
  }

  // Initialize browser
  async initBrowser() {
    console.log(chalk.blue('\n🌐 Launching browser...'));
    this.browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage'] // Helps with timeouts
    });

    // Create context with longer timeout
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // Set default navigation timeout to 90 seconds
    this.context.setDefaultNavigationTimeout(90000);

    this.page = await this.context.newPage();
    console.log(chalk.green('✅ Browser launched'));
  }

  // Login to website
  async login() {
    if (!this.config.loginUrl || !this.config.username || !this.config.password) {
      console.log(chalk.gray('  ℹ️  No authentication configured, skipping login'));
      return true;
    }

    console.log(chalk.blue('\n🔐 Logging in...'));

    try {
      // Navigate to login page
      await this.page.goto(this.config.loginUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 90000
      });

      console.log(chalk.gray('  📍 Login page loaded'));

      // Wait for login form
      await this.page.waitForSelector(this.config.usernameSelector, { timeout: 10000 });

      // Fill username
      await this.page.fill(this.config.usernameSelector, this.config.username);
      console.log(chalk.gray('  ✍️  Username entered'));

      // Fill password
      await this.page.fill(this.config.passwordSelector, this.config.password);
      console.log(chalk.gray('  ✍️  Password entered'));

      // Click submit
      await this.page.click(this.config.submitSelector);
      console.log(chalk.gray('  🖱️  Submit clicked'));

      // Wait for navigation after login
      await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
        console.log(chalk.yellow('  ⚠️  Network not idle, but continuing...'));
      });

      // Wait additional time for session to establish
      await this.page.waitForTimeout(3000);

      console.log(chalk.green('✅ Login successful'));
      return true;
    } catch (error) {
      console.error(chalk.red(`❌ Login failed: ${error.message}`));
      return false;
    }
  }

  // Handle popups and modals
  async handlePopups() {
    console.log(chalk.yellow('  🔍 Checking for popups/modals...'));

    await this.page.waitForTimeout(this.config.waitForPopups);

    let closedCount = 0;
    for (const selector of this.config.popupSelectors) {
      try {
        const elements = await this.page.$$(selector);
        for (const element of elements) {
          const isVisible = await element.isVisible();
          if (isVisible) {
            const closeButton = await element.$('button, [role="button"], [aria-label*="close" i], [aria-label*="dismiss" i], .close');
            if (closeButton) {
              await closeButton.click();
              closedCount++;
              console.log(chalk.green(`  ✅ Closed popup: ${selector}`));
              await this.page.waitForTimeout(500);
            }
          }
        }
      } catch (err) {
        // Ignore errors
      }
    }

    if (closedCount === 0) {
      console.log(chalk.gray('  ℹ️  No popups detected'));
    }
  }

  // Navigate to URL and wait for load
  async navigateToPage(url) {
    console.log(chalk.blue(`\n📍 Navigating to: ${url}`));
    try {
      await this.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 90000
      });

      // Wait for network to be mostly idle (but don't fail if it takes too long)
      await this.page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {
        console.log(chalk.yellow('  ⚠️  Network still active, but continuing...'));
      });

      // Wait additional time for page to fully render
      await this.page.waitForTimeout(3000);

      console.log(chalk.green('✅ Page loaded'));

      // Handle popups after page load
      await this.handlePopups();

      return true;
    } catch (error) {
      console.error(chalk.red(`❌ Failed to load page: ${error.message}`));
      return false;
    }
  }

  // Click button and wait for changes
  async clickButton(buttonText) {
    console.log(chalk.blue(`\n🖱️  Clicking button: "${buttonText}"`));
    try {
      const selectors = [
        `button:has-text("${buttonText}")`,
        `[role="button"]:has-text("${buttonText}")`,
        `a:has-text("${buttonText}")`,
        `[aria-label*="${buttonText}" i]`,
        `text="${buttonText}"`
      ];

      let clicked = false;
      for (const selector of selectors) {
        try {
          const element = await this.page.waitForSelector(selector, { timeout: 5000 });
          if (element) {
            await element.click();
            clicked = true;
            console.log(chalk.green(`✅ Button "${buttonText}" clicked`));
            break;
          }
        } catch (err) {
          // Try next selector
        }
      }

      if (!clicked) {
        console.log(chalk.yellow(`⚠️  Button "${buttonText}" not found, skipping...`));
        return false;
      }

      // Wait for any network activity to settle
      await this.page.waitForTimeout(2000);

      // Handle any new popups that appeared after click
      await this.handlePopups();

      return true;
    } catch (error) {
      console.error(chalk.red(`❌ Error clicking button: ${error.message}`));
      return false;
    }
  }

  // Take Percy snapshot
  async takePercySnapshot(name) {
    console.log(chalk.blue(`\n📸 Taking Percy snapshot: "${name}"`));

    try {
      // Take Percy snapshot using @percy/playwright
      await percySnapshot(this.page, name);

      // Also take a regular screenshot for local reference
      const screenshotPath = path.join(this.config.screenshotDir, `${name.replace(/[^a-z0-9]/gi, '_')}.png`);
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(chalk.gray(`  💾 Local screenshot saved: ${screenshotPath}`));

      console.log(chalk.green(`✅ Percy snapshot captured: "${name}"`));
      return true;
    } catch (error) {
      console.error(chalk.red(`❌ Error taking Percy snapshot: ${error.message}`));
      return false;
    }
  }

  // Run visual test workflow
  async runTest() {
    try {
      // Create screenshots directory
      if (!fs.existsSync(this.config.screenshotDir)) {
        fs.mkdirSync(this.config.screenshotDir, { recursive: true });
      }

      // Initialize browser
      await this.initBrowser();

      // Login if authentication is configured
      const loginSuccess = await this.login();
      if (!loginSuccess && this.config.loginUrl) {
        throw new Error('Login required but failed');
      }

      // Navigate to main page
      const loaded = await this.navigateToPage(this.config.url);
      if (!loaded) {
        throw new Error('Failed to load main page');
      }

      // Take default view snapshot
      await this.takePercySnapshot(`Default View - ${this.config.projectName}`);

      // Test button states if configured
      if (this.config.buttons && this.config.buttons.length > 0) {
        console.log(chalk.blue(`\n📋 Testing ${this.config.buttons.length} button state(s)...`));

        for (const button of this.config.buttons) {
          // Reload page for each button test (keeps auth session)
          await this.navigateToPage(this.config.url);

          // Click button
          const clicked = await this.clickButton(button);

          if (clicked) {
            // Take snapshot of button state
            await this.takePercySnapshot(`${button} - ${this.config.projectName}`);
          }
        }
      }

      console.log(chalk.green('\n✅ Visual testing completed successfully!'));
      console.log(chalk.cyan('\n📊 View results at: https://percy.io'));
      console.log(chalk.yellow('\n💡 Next steps:'));
      console.log(chalk.white('   1. Go to Percy dashboard'));
      console.log(chalk.white('   2. Review and approve the baseline snapshots'));
      console.log(chalk.white('   3. Run this script again to compare against baseline'));

    } catch (error) {
      console.error(chalk.red('\n❌ Test failed:'), error.message);
      throw error;
    } finally {
      // Cleanup
      await this.cleanup();
    }
  }

  // Cleanup resources
  async cleanup() {
    console.log(chalk.blue('\n🧹 Cleaning up...'));

    if (this.page) {
      await this.page.close();
    }

    if (this.context) {
      await this.context.close();
    }

    if (this.browser) {
      await this.browser.close();
    }

    console.log(chalk.green('✅ Cleanup complete'));
  }
}

// Main execution
(async () => {
  console.log(chalk.bold.blue('\n╔════════════════════════════════════════╗'));
  console.log(chalk.bold.blue('║   Percy Visual Testing Script v1.1    ║'));
  console.log(chalk.bold.blue('║   (With Authentication Support)       ║'));
  console.log(chalk.bold.blue('╚════════════════════════════════════════╝\n'));

  console.log(chalk.cyan('📋 Configuration:'));
  console.log(chalk.white(`   URL: ${config.url}`));
  console.log(chalk.white(`   Login: ${config.loginUrl ? 'Enabled' : 'Disabled'}`));
  console.log(chalk.white(`   Buttons: ${config.buttons.length > 0 ? config.buttons.join(', ') : 'None'}`));
  console.log(chalk.white(`   Project: ${config.projectName}`));

  const tester = new PercyVisualTester(config);

  try {
    await tester.runTest();
    process.exit(0);
  } catch (error) {
    console.error(chalk.red('\n❌ Fatal error:'), error);
    process.exit(1);
  }
})();
