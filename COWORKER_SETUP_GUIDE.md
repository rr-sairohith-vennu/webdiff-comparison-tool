# 🚀 WebDiff Tool - Coworker Setup Guide

## Overview
This guide helps your coworker set up the WebDiff visual comparison tool in their own environment for CI/CD testing.

---

## ✅ Option 1: Deploy to Their Own Fly.io (Recommended)

### Why This Approach?
- ✅ Their own isolated instance
- ✅ Their own authentication tokens/cookies
- ✅ No sharing credentials
- ✅ Full control over the deployment
- ✅ Free tier available

### Setup Steps:

#### 1. Clone the Repository
```bash
git clone https://github.com/rr-sairohith-vennu/webdiff-comparison-tool.git
cd webdiff-comparison-tool
```

#### 2. Install Fly.io CLI
```bash
# macOS/Linux
curl -L https://fly.io/install.sh | sh

# Windows
pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

#### 3. Login to Fly.io
```bash
fly auth login
```

#### 4. Deploy the App
```bash
# Launch the app (creates fly.toml)
fly launch

# When prompted:
# - App name: choose a unique name (e.g., "webdiff-teamname")
# - Region: choose closest to you
# - Add a Postgres database? → NO
# - Deploy now? → YES
```

#### 5. Create Persistent Storage
```bash
fly volumes create webdiff_screenshots --size 1 --region <your-region>
```

#### 6. Get Your App URL
```bash
fly info
# Look for: Hostname: your-app-name.fly.dev
```

#### 7. Test It
```bash
# Open in browser
fly open

# Or visit: https://your-app-name.fly.dev
```

---

## ✅ Option 2: Self-Hosted Runner + Local WebDiff

### Why This Approach?
- ✅ No external deployment needed
- ✅ Runs on your own infrastructure
- ✅ Complete control over security
- ✅ No internet-accessible endpoint needed

### Setup Steps:

#### 1. Clone the Repository
```bash
git clone https://github.com/rr-sairohith-vennu/webdiff-comparison-tool.git
cd webdiff-comparison-tool
```

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Set Up Self-Hosted Runner
Follow GitHub's guide: https://docs.github.com/en/actions/hosting-your-own-runners/adding-self-hosted-runners

```bash
# In your repo → Settings → Actions → Runners → New self-hosted runner
# Follow the setup instructions
```

#### 4. Create GitHub Actions Workflow

Create `.github/workflows/visual-testing-local.yml`:

```yaml
name: Visual Testing (Self-Hosted)

on:
  pull_request:
    branches: [main, develop]
  workflow_dispatch:
    inputs:
      production_url:
        description: 'Production URL'
        required: true
      preview_url:
        description: 'Preview URL'
        required: true

jobs:
  visual-diff:
    runs-on: self-hosted  # Uses your self-hosted runner

    steps:
      - name: Checkout WebDiff Tool
        uses: actions/checkout@v3
        with:
          repository: rr-sairohith-vennu/webdiff-comparison-tool
          path: webdiff-tool

      - name: Install Dependencies
        working-directory: ./webdiff-tool
        run: npm install

      - name: Start WebDiff Server
        working-directory: ./webdiff-tool
        run: |
          npm start &
          sleep 10  # Wait for server to start

      - name: Run Visual Comparison
        env:
          PROD_URL: ${{ github.event.inputs.production_url || 'https://www.rakuten.com/account/activity' }}
          PREVIEW_URL: ${{ github.event.inputs.preview_url || 'https://preview-www.rakuten.com/account/activity' }}
          AUTH_COOKIES: ${{ secrets.RAKUTEN_AUTH_COOKIES }}
        run: |
          curl -X POST "http://localhost:4000/api/compare" \
            -H "Content-Type: application/json" \
            -d "{
              \"url1\": \"$PROD_URL\",
              \"url2\": \"$PREVIEW_URL\",
              \"cookies\": $AUTH_COOKIES
            }" > result.json

          cat result.json

      - name: Upload Screenshots
        uses: actions/upload-artifact@v3
        with:
          name: visual-diff-screenshots
          path: webdiff-tool/screenshots/
          retention-days: 30

      - name: Stop WebDiff Server
        if: always()
        run: pkill -f "node.*server.js"
```

---

## ✅ Option 3: Docker Container (Advanced)

### Why This Approach?
- ✅ Portable and reproducible
- ✅ Can run anywhere (AWS, Azure, GCP, on-premise)
- ✅ Isolated environment

### Setup Steps:

#### 1. Clone the Repository
```bash
git clone https://github.com/rr-sairohith-vennu/webdiff-comparison-tool.git
cd webdiff-comparison-tool
```

#### 2. Build Docker Image
```bash
docker build -t webdiff-tool .
```

#### 3. Run Container
```bash
docker run -d \
  -p 4000:4000 \
  -v $(pwd)/screenshots:/app/screenshots \
  --name webdiff \
  webdiff-tool
```

#### 4. Use in CI/CD
Add to their workflow:

```yaml
jobs:
  visual-diff:
    runs-on: ubuntu-latest

    services:
      webdiff:
        image: webdiff-tool
        ports:
          - 4000:4000
        volumes:
          - screenshots:/app/screenshots

    steps:
      - name: Run Comparison
        run: |
          curl -X POST "http://localhost:4000/api/compare" \
            -H "Content-Type: application/json" \
            -d '{"url1": "$PROD_URL", "url2": "$PREVIEW_URL"}'
```

---

## 📊 Comparison of Options

| Feature | Fly.io | Self-Hosted | Docker |
|---------|--------|-------------|--------|
| **Setup Time** | 5 min | 15 min | 10 min |
| **Internet Access Required** | Yes | No | No |
| **Cost** | Free tier | Free | Free |
| **Maintenance** | Low | Medium | Medium |
| **Security** | Good | Best | Good |
| **Scalability** | High | Medium | High |
| **Best For** | Quick setup, remote teams | Strict security, existing infrastructure | Portability, multi-cloud |

---

## 🔐 Authentication Setup (All Options)

### Get Authentication Cookies:

1. **Open DevTools** → Application tab → Cookies
2. **Copy relevant cookies** (session, auth tokens)
3. **Format as JSON:**

```json
[
  {"name": "ebtoken", "value": "eyJhbGciOiJSUzI1NiJ9...", "domain": ".rakuten.com", "path": "/"},
  {"name": "_dd_s", "value": "logs=1&id=abc123...", "domain": ".rakuten.com", "path": "/"}
]
```

### Add to GitHub Secrets:

1. Go to repo → **Settings** → **Secrets** → **Actions**
2. Click **New repository secret**
3. Name: `RAKUTEN_AUTH_COOKIES`
4. Value: Paste the JSON array

---

## 📞 Support

If your coworker needs help:
- Check the main README.md
- See CI_CD_SETUP_GUIDE.md for detailed workflow setup
- Ask me for assistance!

---

## 🎯 Quick Start Recommendation

**For fastest setup:** Use Option 1 (Fly.io)
- Takes 5 minutes
- No infrastructure needed
- Just deploy and use

**For maximum security:** Use Option 2 (Self-Hosted)
- Keeps everything internal
- No external dependencies
- Full control
