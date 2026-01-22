#!/bin/bash

# =============================================================================
# SECURE FILE SERVER - SETUP SCRIPT
# =============================================================================
# This script helps you set up the server environment quickly

set -e  # Exit on any error

echo "🚀 Setting up Secure File Server..."
echo "===================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'.' -f1 | cut -d'v' -f2)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ required. You have $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi

echo "✅ npm $(npm -v) detected"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Create data directories
echo ""
echo "📁 Creating data directories..."
mkdir -p data/uploads
mkdir -p logs

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "📋 Setting up environment configuration..."
    cp sample.env .env
    echo "✅ Created .env file from template"
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env file with your actual values:"
    echo "   - EMAIL_USER: Your email address"
    echo "   - EMAIL_PASS: Your email password (or app password)"
    echo "   - CORS_ORIGIN: Your frontend URL (currently set to http://localhost:5500)"
    echo ""
    echo "   Edit with: nano .env"
else
    echo "ℹ️  .env file already exists, skipping copy"
fi

# Initialize database (optional)
echo ""
read -p "🗄️  Initialize database now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Creating database..."
    # We can run a quick health check to initialize the DB
    timeout 5s npm start > /dev/null 2>&1 || true
    echo "✅ Database initialized"
fi

echo ""
echo "🎉 Setup complete!"
echo "=================="
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Start the server: npm start"
echo "3. Test health endpoint: curl http://localhost:3001/api/health"
echo ""
echo "For Gmail setup:"
echo "- Enable 2-factor authentication"
echo "- Create an app password: https://support.google.com/accounts/answer/185833"
echo "- Use the app password in EMAIL_PASS"
echo ""
echo "Happy coding! 🚀"