#!/usr/bin/env bash
# Render build script for Playwright

set -e

echo "Installing npm dependencies..."
npm install

echo "Installing Playwright Chromium..."
npx playwright install chromium

echo "Build complete!"
