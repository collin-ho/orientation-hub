'use strict';

// Export ClickUp users → JSON file + SQLite instructors table
// Usage:  node scripts/export-clickup-users.js

require('dotenv').config();
// Force-enable ClickUp so user-discovery loads the real client
process.env.USE_CLICKUP = 'true';

const fs = require('fs');
const path = require('path');
const { userDiscovery } = require('../services/user-discovery');
const { replaceAllInstructors } = require('../services/instructor-store');

async function main() {
  console.log('🔍 Fetching ClickUp users…');
  const result = await userDiscovery.discoverUsers();
  const users = result.users;
  console.log(`✅ Retrieved ${users.length} users`);

  // Write JSON snapshot (version-controlled)
  const outDir = path.join(__dirname, '..', 'data', 'bootstrap');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'instructors.json');
  fs.writeFileSync(outPath, JSON.stringify(users, null, 2), 'utf-8');
  console.log(`💾 Saved snapshot to ${outPath}`);

  // Replace instructors in DB
  replaceAllInstructors(users);
  console.log('📥 Loaded users into SQLite instructors table');

  console.log('🎉 Done');
}

main().catch((err) => {
  console.error('💥 User export failed:', err.message);
  process.exit(1);
}); 