# Percy Visual Regression Testing - Documentation

## Overview

Automated visual regression testing solution using Percy.io to detect UI changes between different environments (prod vs preview, before vs after deployments).

---

## What is Percy?

Percy is an all-in-one visual testing and review platform that captures screenshots, compares them against baseline images, and highlights visual changes automatically.

### Key Features
- **Pixel-perfect comparisons** - Detects even 1-pixel differences
- **Baseline management** - Approve/reject visual changes
- **Multi-state testing** - Test button clicks, popups, modals
- **Cross-browser testing** - Chrome, Firefox, Safari, Edge
- **CI/CD integration** - GitHub Actions, Jenkins, CircleCI
- **Team collaboration** - Review, comment, approve changes

---

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Browser Automation** | Playwright | Captures screenshots and interacts with pages |
| **Visual Testing** | Percy.io API | Compares screenshots and detects differences |
| **Runtime** | Node.js v18+ | Executes test scripts |
| **Language** | JavaScript (ES Modules) | Script implementation |
| **CLI** | @percy/cli | Percy command-line interface |
| **Integration** | @percy/playwright | Percy + Playwright connector |

### Dependencies
```json
{
  "@percy/cli": "^1.29.3",
  "@percy/playwright": "^1.0.6",
  "playwright": "^1.56.0",
  "chalk": "^5.3.0",
  "dotenv": "^16.4.7"
}
```

---

## How It Works

### Architecture Flow

```
┌─────────────────┐
│   Test Script   │
│  (percy-test.js)│
└────────┬────────┘
         │
         ├──► 1. Launch Playwright Browser
         │
         ├──► 2. Navigate to URL
         │
         ├──► 3. Handle Popups/Modals
         │
         ├──► 4. Click Buttons (if configured)
         │
         ├──► 5. Capture DOM Snapshot
         │
         └──► 6. Send to Percy API
                     │
                     ▼
         ┌─────────────────────┐
         │   Percy Platform    │
         │  (percy.io)         │
         └─────────┬───────────┘
                   │
                   ├──► First Run: Create Baseline
                   │
                   └──► Subsequent Runs: Compare vs Baseline
                             │
                             ▼
                   ┌─────────────────────┐
                   │  Visual Diff Report │
                   │  - Highlights changes│
                   │  - Side-by-side view │
                   │  - Pixel differences │
                   └─────────────────────┘
```

### Workflow Steps

**Step 1: Baseline Creation**
```bash
# Configure first URL (e.g., preview environment)
TEST_URL=https://preview.example.com
PERCY_PROJECT=my-app-comparison

# Run test
npm start

# Result: Creates baseline snapshot
```

**Step 2: Baseline Approval**
- Go to Percy dashboard
- Review screenshots
- Click "Approve" to set as baseline

**Step 3: Comparison**
```bash
# Change to second URL (e.g., production)
TEST_URL=https://prod.example.com
PERCY_PROJECT=my-app-comparison  # Same project name!

# Run test again
npm start

# Result: Percy compares prod vs preview and shows differences
```

---

## Configuration

### Environment Variables (.env)

```bash
# Required: Percy API token from https://percy.io/settings
PERCY_TOKEN=your_percy_token_here

# Required: URL to test
TEST_URL=https://your-website.com

# Optional: Buttons to click (comma-separated)
BUTTONS=All,Pending,Completed,Rejected

# Optional: Project name (groups related tests)
PERCY_PROJECT=my-project-name
```

### Project Structure

```
percy-visual-testing/
├── percy-test.js          # Main test script
├── package.json           # Dependencies
├── .env                   # Configuration (not committed)
├── .env.example           # Example configuration
├── .gitignore            # Git ignore rules
├── screenshots/          # Local screenshot backups
└── README.md             # Documentation
```

---

## Use Cases

### Use Case 1: Compare Preview vs Production

**Scenario:** Test if preview changes match production

**Steps:**
1. Run test with preview URL → Approve baseline
2. Change to production URL → Run again
3. Percy shows differences

**Example:**
```bash
# Run 1: Preview (baseline)
TEST_URL=https://preview-www.rakuten.com
npm start → Approve in Percy

# Run 2: Production (comparison)
TEST_URL=https://www.rakuten.com
npm start → Percy shows diff
```

### Use Case 2: Before/After Deployment

**Scenario:** Verify deployment didn't break UI

**Steps:**
1. Before deployment: Run test → Approve baseline
2. After deployment: Run test again
3. Percy highlights any unintended changes

### Use Case 3: Multi-State Testing

**Scenario:** Test different UI states (tabs, filters, modals)

**Configuration:**
```bash
TEST_URL=https://dashboard.example.com
BUTTONS=All Tasks,Pending,Completed,Archived
```

**Result:** Percy captures 5 snapshots:
- Default view
- "All Tasks" state
- "Pending" state
- "Completed" state
- "Archived" state

---

## Benefits of Percy

### 1. **Automated Visual Testing**
- Catches visual bugs that unit/integration tests miss
- No manual screenshot comparison needed
- Runs in CI/CD pipeline automatically

### 2. **Faster Reviews**
- Visual diff highlights changes instantly
- Team can review and approve remotely
- No need to check out branches locally

### 3. **Cross-Browser Coverage**
- Test on Chrome, Firefox, Safari, Edge simultaneously
- Catch browser-specific rendering issues

### 4. **Historical Tracking**
- Every build is saved with screenshots
- Easy to compare against any previous version
- Audit trail of visual changes

### 5. **Integration with Development Workflow**
- GitHub/GitLab PR comments with Percy results
- Slack/email notifications
- Block merges if visual changes not approved

### 6. **Popup/Modal Handling**
- Automatically detects and closes popups
- Tests actual user experience
- No flaky tests from cookie banners

---

## Pricing & Cost

### Percy Pricing Tiers (2025)

| Plan | Price | Snapshots/Month | Users | Support |
|------|-------|-----------------|-------|---------|
| **Free** | $0 | 5,000 | 1 | Community |
| **Starter** | $29/mo | 15,000 | 3 | Email |
| **Growth** | $149/mo | 100,000 | 10 | Email + Chat |
| **Enterprise** | Custom | Unlimited | Unlimited | Dedicated |

### Cost Calculation

**Example: Small team with 2 projects**
- 2 projects × 5 snapshots per run × 20 runs/month = 200 snapshots/month
- **Fits in Free tier** ✅

**Example: Medium team with 5 projects**
- 5 projects × 10 snapshots per run × 50 runs/month = 2,500 snapshots/month
- **Fits in Free tier** ✅

**Example: Large team with CI/CD**
- 10 projects × 15 snapshots × 200 runs/month = 30,000 snapshots/month
- **Requires Growth plan ($149/mo)**

### Cost Optimization Tips

1. **Combine related tests** - Use same project for related URLs
2. **Limit button states** - Only test critical UI states
3. **Run on key branches** - Only run Percy on main/staging branches
4. **Use conditionals in CI** - Skip Percy for draft PRs

---

## CI/CD Integration

### GitHub Actions

**File:** `.github/workflows/percy.yml`

```yaml
name: Percy Visual Tests

on:
  pull_request:
    branches: [main, staging]
  push:
    branches: [main]

jobs:
  visual-tests:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        working-directory: ./percy-visual-testing
        run: npm install

      - name: Run Percy tests
        working-directory: ./percy-visual-testing
        env:
          PERCY_TOKEN: ${{ secrets.PERCY_TOKEN }}
          TEST_URL: https://staging.example.com
          BUTTONS: "All,Pending,Completed"
          PERCY_PROJECT: my-app-staging
        run: npm start

      - name: Comment PR with Percy results
        uses: percy/percy-action@v1
        if: github.event_name == 'pull_request'
```

### Setup Steps for GitHub Actions

**Step 1: Add Percy Token to GitHub Secrets**
1. Go to GitHub repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `PERCY_TOKEN`
4. Value: Your Percy token from https://percy.io/settings
5. Click "Add secret"

**Step 2: Create Workflow File**
```bash
mkdir -p .github/workflows
# Create percy.yml with content above
```

**Step 3: Commit and Push**
```bash
git add .github/workflows/percy.yml
git commit -m "Add Percy visual testing to CI"
git push
```

**Step 4: Verify**
- Go to GitHub → Actions tab
- Percy tests run automatically on PRs
- Results appear as PR comments

---

### Jenkins Integration

**Jenkinsfile:**

```groovy
pipeline {
    agent any

    environment {
        PERCY_TOKEN = credentials('percy-token')
        NODE_VERSION = '18'
    }

    stages {
        stage('Setup') {
            steps {
                sh 'nvm use ${NODE_VERSION}'
                dir('percy-visual-testing') {
                    sh 'npm install'
                }
            }
        }

        stage('Percy Visual Tests') {
            steps {
                dir('percy-visual-testing') {
                    sh '''
                        export TEST_URL=https://staging.example.com
                        export BUTTONS="All,Pending,Completed"
                        export PERCY_PROJECT=my-app-staging
                        npm start
                    '''
                }
            }
        }
    }

    post {
        always {
            echo "Percy build URL: Check Percy dashboard at https://percy.io"
        }
        failure {
            emailext (
                subject: "Percy Visual Tests Failed",
                body: "Visual regression detected. Check Percy dashboard.",
                to: "team@example.com"
            )
        }
    }
}
```

**Setup:**
1. Jenkins → Credentials → Add → Secret text
2. ID: `percy-token`
3. Secret: Your Percy token
4. Save

---

### GitLab CI

**File:** `.gitlab-ci.yml`

```yaml
percy-tests:
  stage: test
  image: node:18

  variables:
    TEST_URL: "https://staging.example.com"
    BUTTONS: "All,Pending,Completed"
    PERCY_PROJECT: "my-app-staging"

  script:
    - cd percy-visual-testing
    - npm install
    - npm start

  only:
    - merge_requests
    - main

  artifacts:
    paths:
      - percy-visual-testing/screenshots/
    expire_in: 1 week
```

**Setup:**
1. GitLab → Settings → CI/CD → Variables
2. Add variable: `PERCY_TOKEN` (Protected, Masked)
3. Save

---

### CircleCI

**File:** `.circleci/config.yml`

```yaml
version: 2.1

jobs:
  percy-tests:
    docker:
      - image: cimg/node:18.0

    steps:
      - checkout

      - restore_cache:
          keys:
            - v1-deps-{{ checksum "percy-visual-testing/package-lock.json" }}

      - run:
          name: Install dependencies
          command: |
            cd percy-visual-testing
            npm install

      - save_cache:
          paths:
            - percy-visual-testing/node_modules
          key: v1-deps-{{ checksum "percy-visual-testing/package-lock.json" }}

      - run:
          name: Run Percy tests
          command: |
            cd percy-visual-testing
            npm start
          environment:
            TEST_URL: https://staging.example.com
            BUTTONS: All,Pending,Completed
            PERCY_PROJECT: my-app-staging

workflows:
  version: 2
  test:
    jobs:
      - percy-tests:
          filters:
            branches:
              only:
                - main
                - staging
```

---

## Quick Reference

### Common Commands

```bash
# Install dependencies
npm install

# Run test with .env configuration
npm start

# Run test with environment variables
PERCY_TOKEN=xxx TEST_URL=https://example.com npm start

# Clean up background processes
pkill -9 node

# View local screenshots
open screenshots/
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| "PERCY_TOKEN not set" | Add token to `.env` file |
| "Page load timeout" | Increase timeout in percy-test.js or check URL |
| "Button not found" | Verify button text matches exactly (case-sensitive) |
| "No comparison run" | Approve baseline first, then run again |
| Background processes stuck | Run `pkill -9 node` |

### Percy Dashboard Features

**Build Status:**
- 🟢 **No changes** - Matches baseline perfectly
- 🟡 **Unreviewed** - Changes detected, needs review
- 🔴 **Changes requested** - Reviewer requested changes
- ✅ **Approved** - Changes approved

**Comparison Views:**
- **Side-by-side** - Baseline vs new screenshot
- **Diff only** - Highlighted changes
- **Swipe** - Interactive before/after slider
- **Split** - Split view comparison

---

## Best Practices

### 1. Project Organization
- Use descriptive project names: `checkout-flow`, `dashboard`, `landing-page`
- Group related tests in same project
- Separate projects for different apps

### 2. Baseline Management
- Review baselines carefully before approving
- Update baseline after intentional UI changes
- Don't auto-approve in production CI/CD

### 3. Test Strategy
- Test critical user journeys first
- Add visual tests for components changed in PR
- Run on staging before production

### 4. Performance
- Limit snapshots to essential views
- Use parallel jobs for multiple projects
- Cache dependencies in CI/CD

### 5. Team Workflow
- Assign reviewers for visual changes
- Add comments in Percy for context
- Block PR merges if Percy not approved

---

## Comparison: Percy vs Manual Testing

| Aspect | Manual Testing | Percy Automated |
|--------|----------------|-----------------|
| **Time per test** | 10-30 minutes | 1-2 minutes |
| **Consistency** | Varies by tester | 100% consistent |
| **Coverage** | Limited browsers | All browsers |
| **Documentation** | Screenshots in folders | Organized dashboard |
| **Collaboration** | Email screenshots | Built-in review tool |
| **CI/CD integration** | Manual | Automatic |
| **Cost** | Engineer time | $0-$149/month |

---

## Support & Resources

### Documentation
- **Percy Docs:** https://docs.percy.io
- **Percy API:** https://docs.percy.io/reference
- **Playwright Docs:** https://playwright.dev

### Getting Help
- **Percy Support:** support@percy.io
- **Community Slack:** https://percy.io/slack
- **Status Page:** https://status.percy.io

### Internal Contacts
- **Tool Owner:** Sai Rohith Vennu
- **Percy Account Admin:** [Your Team Lead]
- **Project Location:** `/percy-visual-testing/`

---

## FAQs

**Q: How is Percy different from our current webdiff tool?**

A:
- **Webdiff:** Compares two URLs side-by-side RIGHT NOW
- **Percy:** Tracks same URL over TIME and integrates with CI/CD

Both tools serve different purposes and can be used together.

**Q: What happens if we exceed free tier limits?**

A: Percy shows a warning at 80% usage. Tests continue to run but you'll need to upgrade for next month.

**Q: Can Percy test pages behind authentication?**

A: Yes, the script can be extended to handle login flows before taking screenshots.

**Q: How long are Percy builds retained?**

A:
- Free tier: 30 days
- Paid tiers: Unlimited retention

**Q: Can we test mobile viewports?**

A: Yes, configure Playwright to use mobile viewports in percy-test.js.

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-01-14 | 1.0.0 | Initial Percy integration |
|  |  | - Playwright automation |
|  |  | - Popup handling |
|  |  | - Multi-state testing |
|  |  | - CI/CD examples |

---

**Last Updated:** January 14, 2025
**Document Owner:** Sai Rohith Vennu
**Next Review:** March 2025
