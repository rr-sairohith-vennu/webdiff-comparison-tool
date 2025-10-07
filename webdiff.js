#!/usr/bin/env node
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import chalk from 'chalk';

class WebDiff {
  constructor(previewUrl, productionUrl) {
    this.previewUrl = previewUrl;
    this.productionUrl = productionUrl;
  }

  async fetchPage(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      throw new Error(`Failed to fetch ${url}: ${error.message}`);
    }
  }

  extractPageData($) {
    const data = {
      title: $('title').text(),
      headings: [],
      paragraphs: [],
      links: [],
      colors: new Set(),
      classes: new Set(),
      ids: new Set(),
      structure: []
    };

    // Extract headings
    $('h1, h2, h3, h4, h5, h6').each((i, el) => {
      data.headings.push({
        tag: el.name,
        text: $(el).text().trim(),
        class: $(el).attr('class') || ''
      });
    });

    // Extract paragraphs
    $('p').each((i, el) => {
      const text = $(el).text().trim();
      if (text) data.paragraphs.push(text);
    });

    // Extract links
    $('a').each((i, el) => {
      data.links.push({
        text: $(el).text().trim(),
        href: $(el).attr('href') || ''
      });
    });

    // Extract colors from inline styles
    $('[style]').each((i, el) => {
      const style = $(el).attr('style') || '';
      const colorMatches = style.match(/(?:color|background-color|border-color):\s*([^;]+)/gi);
      if (colorMatches) {
        colorMatches.forEach(match => {
          const color = match.split(':')[1].trim();
          data.colors.add(color);
        });
      }
    });

    // Extract classes and IDs
    $('[class]').each((i, el) => {
      const classes = $(el).attr('class').split(' ').filter(c => c);
      classes.forEach(c => data.classes.add(c));
    });

    $('[id]').each((i, el) => {
      data.ids.add($(el).attr('id'));
    });

    // Extract structure (body children)
    $('body').children().each((i, el) => {
      data.structure.push({
        tag: el.name,
        class: $(el).attr('class') || '',
        id: $(el).attr('id') || ''
      });
    });

    return {
      ...data,
      colors: Array.from(data.colors),
      classes: Array.from(data.classes),
      ids: Array.from(data.ids)
    };
  }

  compareSets(set1, set2, label) {
    const added = set2.filter(item => !set1.includes(item));
    const removed = set1.filter(item => !set2.includes(item));

    return { label, added, removed, hasChanges: added.length > 0 || removed.length > 0 };
  }

  compareText(arr1, arr2, label) {
    const text1 = arr1.map(item => typeof item === 'string' ? item : JSON.stringify(item));
    const text2 = arr2.map(item => typeof item === 'string' ? item : JSON.stringify(item));

    const added = text2.filter((item, idx) => text1[idx] !== item || idx >= text1.length);
    const removed = text1.filter((item, idx) => text2[idx] !== item || idx >= text2.length);

    return { label, added, removed, hasChanges: added.length > 0 || removed.length > 0 };
  }

  async compare() {
    console.log(chalk.blue.bold('\n🔍 WebDiff - Comparing Pages...\n'));
    console.log(chalk.gray(`Preview:    ${this.previewUrl}`));
    console.log(chalk.gray(`Production: ${this.productionUrl}\n`));

    // Fetch both pages
    console.log(chalk.yellow('Fetching pages...'));
    const [previewHtml, productionHtml] = await Promise.all([
      this.fetchPage(this.previewUrl),
      this.fetchPage(this.productionUrl)
    ]);

    // Parse HTML
    const $preview = cheerio.load(previewHtml);
    const $production = cheerio.load(productionHtml);

    // Extract data
    const previewData = this.extractPageData($preview);
    const productionData = this.extractPageData($production);

    // Generate comparison report
    const report = {
      title: this.compareSets([previewData.title], [productionData.title], 'Page Title'),
      headings: this.compareText(previewData.headings, productionData.headings, 'Headings'),
      paragraphs: this.compareText(previewData.paragraphs, productionData.paragraphs, 'Paragraphs'),
      links: this.compareText(previewData.links, productionData.links, 'Links'),
      colors: this.compareSets(previewData.colors, productionData.colors, 'Colors'),
      classes: this.compareSets(previewData.classes, productionData.classes, 'CSS Classes'),
      ids: this.compareSets(previewData.ids, productionData.ids, 'Element IDs'),
      structure: this.compareText(previewData.structure, productionData.structure, 'Layout Structure')
    };

    this.printReport(report);
    return report;
  }

  printReport(report) {
    console.log(chalk.green.bold('\n✅ Comparison Complete!\n'));
    console.log(chalk.bold('═'.repeat(60)));

    Object.values(report).forEach(section => {
      if (!section.hasChanges) return;

      console.log(chalk.bold(`\n${section.label}:`));

      if (section.removed.length > 0) {
        console.log(chalk.red(`  ❌ Removed (${section.removed.length}):`));
        section.removed.slice(0, 5).forEach(item => {
          console.log(chalk.red(`     - ${typeof item === 'string' ? item : JSON.stringify(item).substring(0, 80)}`));
        });
        if (section.removed.length > 5) {
          console.log(chalk.red(`     ... and ${section.removed.length - 5} more`));
        }
      }

      if (section.added.length > 0) {
        console.log(chalk.green(`  ✅ Added (${section.added.length}):`));
        section.added.slice(0, 5).forEach(item => {
          console.log(chalk.green(`     + ${typeof item === 'string' ? item : JSON.stringify(item).substring(0, 80)}`));
        });
        if (section.added.length > 5) {
          console.log(chalk.green(`     ... and ${section.added.length - 5} more`));
        }
      }
    });

    const totalChanges = Object.values(report).filter(s => s.hasChanges).length;
    if (totalChanges === 0) {
      console.log(chalk.yellow('\n⚠️  No differences detected between pages.'));
    } else {
      console.log(chalk.bold(`\n${totalChanges} section(s) with differences detected.`));
    }
    console.log(chalk.bold('═'.repeat(60) + '\n'));
  }
}

// CLI Usage
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log(chalk.yellow('Usage: node webdiff.js <preview-url> <production-url>'));
  console.log(chalk.gray('\nExample:'));
  console.log(chalk.gray('  node webdiff.js https://preview.example.com https://example.com'));
  process.exit(1);
}

const [previewUrl, productionUrl] = args;
const differ = new WebDiff(previewUrl, productionUrl);

differ.compare().catch(error => {
  console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
  process.exit(1);
});
