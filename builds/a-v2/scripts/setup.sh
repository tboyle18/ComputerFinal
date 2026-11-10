#!/bin/bash

# MarketHub Setup Script
# This script helps set up the development environment

set -e

echo "🚀 MarketHub Setup"
echo "=================="
echo ""

# Check Node version
NODE_VERSION=$(node -v)
echo "✓ Node version: $NODE_VERSION"

# Check if Node is 18+
NODE_MAJOR=$(node -v | cut -d'.' -f1 | cut -dv -f2)
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo "❌ Node 18+ required (you have $NODE_VERSION)"
    exit 1
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo ""
    echo "📝 Creating .env.local..."
    cp .env.example .env.local
    echo ""
    echo "⚠️  Update .env.local with your Supabase credentials:"
    echo "   - VITE_SUPABASE_URL"
    echo "   - VITE_SUPABASE_ANON_KEY"
    echo ""
    echo "Get these from: https://supabase.com/dashboard"
fi

# Type check
echo ""
echo "🔍 Type checking..."
npm run type-check

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env.local with Supabase credentials"
echo "2. Create database: Run SQL migration in Supabase"
echo "3. Create storage bucket: listing-images (public)"
echo "4. Run: npm run dev"
echo ""
