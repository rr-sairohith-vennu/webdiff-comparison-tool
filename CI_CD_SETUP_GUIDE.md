# 🚀 WebDiff CI/CD Integration Guide

## Overview
This guide helps you integrate WebDiff visual testing into your GitHub Actions CI/CD pipeline.

---

## 📋 Prerequisites

Before starting, ensure you have:

1. **Two environments to compare:**
   - Production URL (e.g., `https://www.rakuten.com/account/activity`)
   - Preview/QA URL (e.g., `https://preview-www.rakuten.com/account/activity`)

2. **GitHub repository with GitHub Actions enabled**

3. **Authentication cookies (if testing authenticated pages)**
   - Cookies in JSON format

4. **WebDiff deployed and accessible:**
   - Current: `https://1-summer-sea-3563.fly.dev`

---

## 🛠️ Setup Steps

### Step 1: Copy Workflow File to Target Repo

Copy `.github/workflows/visual-testing.yml` to the repository you want to test.

```bash
# In the target repo
mkdir -p .github/workflows
cp /path/to/webdiff/.github/workflows/visual-testing.yml .github/workflows/
```

### Step 2: Configure GitHub Secrets (For Authenticated Pages)

If your pages require authentication, add cookies as a GitHub secret:

1. Go to your repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `RAKUTEN_AUTH_COOKIES`
4. Value: Your cookies in JSON format

**Example cookie format:**
```json
[
  {"name": "_dd_s", "value": "logs=1&id=abc123...", "domain": ".rakuten.com", "path": "/"},
  {"name": "_ga", "value": "GA1.1.1234567890", "domain": ".rakuten.com", "path": "/"}
]
```

**How to get cookies:**
1. Open DevTools → Application tab → Cookies → https://www.rakuten.com
2. Copy important cookies (session, auth tokens, etc.)
3. Format as JSON array

### Step 3: Customize URLs in Workflow

Edit `.github/workflows/visual-testing.yml`:

```yaml
env:
  PROD_URL: 'https://www.rakuten.com/your/page/here'
  PREVIEW_URL: 'https://preview-www.rakuten.com/your/page/here'
```

Or set them when manually triggering the workflow.

### Step 4: Test the Workflow

**Option A: Manual Trigger (Recommended First)**
1. Go to **Actions** tab in GitHub
2. Click **Visual Regression Testing with WebDiff**
3. Click **Run workflow**
4. Enter URLs and click **Run**

**Option B: Automatic on PR**
1. Create a new branch
2. Make any change and push
3. Open a Pull Request
4. Workflow runs automatically

---

## 📊 What Happens During CI/CD Run?

1. **GitHub Action triggers** (on PR or manual)
2. **Calls WebDiff API** at `https://1-summer-sea-3563.fly.dev/api/compare`
3. **WebDiff:**
   - Launches 2 Chrome browsers
   - Injects cookies (if provided)
   - Loads both URLs
   - Extracts and compares all DOM elements
   - Takes screenshots
   - Draws red boxes on differences
4. **GitHub Action receives results:**
   - Difference count
   - Comparison ID
   - Screenshot URLs
5. **Posts comment on PR** with:
   - Number of differences
   - Links to screenshots
   - Warning if too many changes

---

## 🎯 Example Workflow Run Output

```
✅ Comparison complete!
📊 Differences found: 47
🔗 Comparison ID: 1760633610066

🎨 Visual Regression Test Results
Differences Found: 47
View screenshots: https://1-summer-sea-3563.fly.dev/screenshots/1760633610066/
```

---

## 🔧 Customization Options

### Change Difference Threshold

Edit the workflow to fail if too many differences:

```yaml
- name: Check Results
  run: |
    if [ $DIFF_COUNT -gt 50 ]; then
      echo "Too many differences detected!"
      exit 1  # Fail the build
    fi
```

### Add Multiple Page Tests

Test multiple pages in one workflow:

```yaml
- name: Test Home Page
  run: |
    curl -X POST "$WEBDIFF_URL/api/compare" \
      -d '{"url1": "https://prod.com/", "url2": "https://preview.com/"}'

- name: Test Account Page
  run: |
    curl -X POST "$WEBDIFF_URL/api/compare" \
      -d '{"url1": "https://prod.com/account", "url2": "https://preview.com/account"}'
```

### Schedule Nightly Runs

Add to workflow:

```yaml
on:
  schedule:
    - cron: '0 2 * * *'  # Run at 2 AM daily
```

---

## 🐛 Troubleshooting

### Issue: "Screenshot not found"
**Cause:** Multiple Fly.io machines running
**Fix:** Already resolved - scaled to 1 machine

### Issue: "CORS error"
**Cause:** WebDiff API needs CORS headers
**Fix:** Already handled in server.js

### Issue: "Cookies not working"
**Check:**
- Cookies are properly formatted JSON
- Cookie domain matches target URL
- Cookies aren't expired

### Issue: "Timeout errors"
**Solution:** Increase timeout in workflow:
```yaml
env:
  TIMEOUT: 300000  # 5 minutes
```

---

## 📈 Cost & Performance

**Current Setup:**
- **Fly.io:** $5-10/month (1 machine, 3GB storage)
- **Comparison time:** 15-25 seconds per run
- **Storage:** 3GB for screenshots (auto-cleanup needed)

**Scaling:**
- For high traffic: Upgrade to 2-4 CPUs ($15-30/month)
- Add auto-cleanup job to delete old screenshots

---

## 🎬 Next Steps

1. **Meet with Arjun** to identify first repo to test
2. **Copy workflow file** to that repo
3. **Set up GitHub Secrets** (if auth needed)
4. **Run test manually** first to verify
5. **Review results** with team
6. **Enable for all PRs** once validated

---

## 📚 Additional Resources

- **WebDiff README:** See main README.md for detailed tech docs
- **Confluence Doc:** Business-focused overview with ROI
- **Fly.io Dashboard:** https://fly.io/dashboard
- **GitHub Actions Docs:** https://docs.github.com/en/actions

---

## 💬 Questions?

Contact: Sai Rohith Vennu (@sairohith.vennu)

**Slack Thread:** https://rakutenrewards.slack.com/archives/C08THU97HAP/p1760636615308979
