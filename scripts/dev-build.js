#!/usr/bin/env node

/**
 * Automated Development Build Script
 * This script handles the complete build and deployment process
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const colors = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

function log(message, color = 'blue') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, description) {
  log(`🔄 ${description}...`, 'yellow');
  try {
    execSync(command, { stdio: 'inherit' });
    log(`✅ ${description} completed`, 'green');
  } catch (error) {
    log(`❌ ${description} failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

function main() {
  log('🚀 Starting automated build process...', 'blue');
  
  // Step 1: Clean old files
  runCommand('npm run clean', 'Cleaning old build files');
  
  // Step 2: Build the application
  runCommand('npm run build', 'Building application');
  
  // Step 3: Verify build output
  const backendPath = 'backend/public';
  const assetsPath = path.join(backendPath, 'assets');
  const indexPath = path.join(backendPath, 'index.html');
  
  if (fs.existsSync(assetsPath) && fs.existsSync(indexPath)) {
    log('✅ Build files successfully deployed to backend/public', 'green');
    
    // List generated files
    const files = fs.readdirSync(assetsPath);
    log(`📁 Generated ${files.length} asset files:`, 'blue');
    files.forEach(file => {
      const filePath = path.join(assetsPath, file);
      const stats = fs.statSync(filePath);
      const size = (stats.size / 1024).toFixed(1);
      log(`   - ${file} (${size} KB)`, 'blue');
    });
  } else {
    log('❌ Build failed - files not found in backend/public', 'red');
    process.exit(1);
  }
  
  log('🎉 Build process completed successfully!', 'green');
  log('💡 Your application is now ready at backend/public/', 'blue');
}

main();
