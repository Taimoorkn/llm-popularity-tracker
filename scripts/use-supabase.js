#!/usr/bin/env node

/**
 * Script to switch the app to use Supabase instead of the complex backend
 * Run: npm run use-supabase
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Switching to Supabase real-time architecture...\n');

// Files to update
const filesToUpdate = [
  {
    original: 'app/page.js',
    supabase: 'app/page-supabase.js',
    backup: 'app/page-old.js'
  },
  {
    original: 'store/useVoteStore.js',
    supabase: 'store/useVoteStoreSupabase.js',
    backup: 'store/useVoteStore-old.js'
  }
];

// Backup and replace files
filesToUpdate.forEach(({ original, supabase, backup }) => {
  const originalPath = path.join(process.cwd(), original);
  const supabasePath = path.join(process.cwd(), supabase);
  const backupPath = path.join(process.cwd(), backup);
  
  try {
    // Create backup of original
    if (fs.existsSync(originalPath) && !fs.existsSync(backupPath)) {
      fs.copyFileSync(originalPath, backupPath);
      console.log(`✅ Backed up ${original} to ${backup}`);
    }
    
    // Replace with Supabase version
    if (fs.existsSync(supabasePath)) {
      fs.copyFileSync(supabasePath, originalPath);
      console.log(`✅ Updated ${original} to use Supabase`);
    } else {
      console.log(`⚠️  Supabase version not found: ${supabase}`);
    }
  } catch (error) {
    console.error(`❌ Error updating ${original}:`, error.message);
  }
});

// Check for .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.log('\n⚠️  No .env.local file found!');
  console.log('📝 Creating .env.local from template...');
  
  const envExample = `# Supabase Configuration (Required)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here

# Optional
NODE_ENV=development`;
  
  fs.writeFileSync(envPath, envExample);
  console.log('✅ Created .env.local - Please add your Supabase credentials!');
}

console.log('\n' + '='.repeat(60));
console.log('🎉 Successfully switched to Supabase architecture!');
console.log('='.repeat(60));
console.log('\n📋 Next Steps:');
console.log('1. Set up your Supabase project: https://app.supabase.com');
console.log('2. Run the schema.sql in Supabase SQL Editor');
console.log('3. Add your Supabase credentials to .env.local');
console.log('4. Run: npm run dev');
console.log('\nSee SUPABASE_SETUP.md for detailed instructions');
console.log('\n💡 To revert to old system: npm run use-old-system');