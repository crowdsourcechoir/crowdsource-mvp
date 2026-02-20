#!/bin/bash
# Clear everything and reinstall so localhost works
cd "$(dirname "$0")/.."
echo "Removing node_modules..."
rm -rf node_modules
echo "Removing .next build cache..."
rm -rf .next
echo "Installing dependencies..."
npm install
echo "Done. Run: npm run dev"
