#!/usr/bin/env node
/* Cross-platform clean: removes node_modules and reinstalls */
const { rmSync } = require('fs');
const { execSync } = require('child_process');

try {
  console.log('🧹 Removing node_modules …');
  rmSync('node_modules', { recursive: true, force: true });
  console.log('🧹 Removing package-lock.json …');
  rmSync('package-lock.json', { force: true });
} catch (e) {
  console.warn('Warning: failed to remove node_modules:', e.message);
}

try {
  console.log('📦 Installing dependencies …');
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Clean complete');
} catch (e) {
  console.error('❌ npm install failed');
  process.exitCode = 1;
}
