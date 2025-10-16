#!/bin/bash

# Script to compare two URLs using Percy
# This runs Percy twice - once for each URL

echo "================================================"
echo "   Percy Two-URL Comparison Script"
echo "================================================"
echo ""

# Get URLs from command line or use defaults
PROD_URL="${1:-https://www.rakuten.com}"
PREVIEW_URL="${2:-https://preview-www.rakuten.com}"

echo "🔵 Production URL: $PROD_URL"
echo "🟢 Preview URL: $PREVIEW_URL"
echo ""

# Test Production URL
echo "================================================"
echo "📸 Testing PRODUCTION URL..."
echo "================================================"
export TEST_URL="$PROD_URL"
export PERCY_PROJECT="rakuten-production"
npm start

echo ""
echo "================================================"
echo "📸 Testing PREVIEW URL..."
echo "================================================"
export TEST_URL="$PREVIEW_URL"
export PERCY_PROJECT="rakuten-preview"
npm start

echo ""
echo "================================================"
echo "✅ Both URLs tested!"
echo "================================================"
echo ""
echo "📊 View results at: https://percy.io"
echo ""
echo "You'll see TWO separate projects:"
echo "  1. rakuten-production - Screenshots of $PROD_URL"
echo "  2. rakuten-preview - Screenshots of $PREVIEW_URL"
echo ""
echo "⚠️  Note: Percy doesn't compare these side-by-side."
echo "    For side-by-side comparison, use the main webdiff tool on localhost:4000"
