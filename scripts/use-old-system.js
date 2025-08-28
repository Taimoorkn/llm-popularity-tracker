#!/usr/bin/env node

/**
 * Script to revert back to the old PostgreSQL/Redis system
 * Run: npm run use-old-system
 */

const fs = require('fs');
const path = require('path');

console.log('⏮️  Reverting to original PostgreSQL/Redis architecture...\n');

// Files to restore
const filesToRestore = [
  {
    backup: 'app/page-old.js',
    original: 'app/page.js'
  },
  {
    backup: 'store/useVoteStore-old.js',
    original: 'store/useVoteStore.js'
  }
];

// Restore files
filesToRestore.forEach(({ backup, original }) => {
  const backupPath = path.join(process.cwd(), backup);
  const originalPath = path.join(process.cwd(), original);
  
  try {
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, originalPath);
      console.log(`✅ Restored ${original} from backup`);
    } else {
      console.log(`⚠️  No backup found: ${backup}`);
      console.log('    The file may not have been backed up yet.');
    }
  } catch (error) {
    console.error(`❌ Error restoring ${original}:`, error.message);
  }
});

console.log('\n' + '='.repeat(60));
console.log('✅ Reverted to original PostgreSQL/Redis system');
console.log('='.repeat(60));
console.log('\n📋 Next Steps:');
console.log('1. Ensure Docker is running');
console.log('2. Run: docker-compose up -d');
console.log('3. Run: npm run dev');
console.log('\n💡 To use Supabase again: npm run use-supabase');