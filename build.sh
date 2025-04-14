#!/bin/bash
# Clean any existing build artifacts
rm -rf .next
rm -rf node_modules

# Install dependencies
npm install

# Build the application
npm run build

# Clean up any temporary files
find . -type f -name "*.log" -delete
find . -type f -name "*.tmp" -delete 