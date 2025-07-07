const { getSpaceFolders, getFolderLists } = require('./utils/clickup-client');

async function findListIds() {
  try {
    console.log('🔍 Finding list IDs from existing classes...\n');
    
    const WORKSHOP_SPACE_ID = '14869535';
    console.log(`📡 Calling getSpaceFolders for space: ${WORKSHOP_SPACE_ID}`);
    
    const spaceFolders = await getSpaceFolders(WORKSHOP_SPACE_ID);
    
    // Debug: Show what we actually got back
    console.log('📡 API Response structure:', Array.isArray(spaceFolders) ? `Array[${spaceFolders.length}]` : Object.keys(spaceFolders || {}));
    console.log('📡 Full response:', JSON.stringify(spaceFolders, null, 2));
    
    // Handle both array response and object with folders property
    const folders = Array.isArray(spaceFolders) ? spaceFolders : spaceFolders?.folders;
    
    if (!folders || folders.length === 0) {
      console.log('❌ No classes found in Workshop space');
      console.log('   This might mean:');
      console.log('   - Wrong space ID');
      console.log('   - No permissions to view folders');
      console.log('   - API structure changed');
      return;
    }
    
    console.log('📁 Available classes and their list IDs:\n');
    
    for (const folder of folders.slice(0, 3)) { // Show first 3 classes
      console.log(`📂 ${folder.name} (${folder.id})`);
      
      // Check if lists are already in the folder response
      if (folder.lists && Array.isArray(folder.lists)) {
        folder.lists.forEach(list => {
          console.log(`   📋 ${list.name}: ${list.id}`);
        });
      } else {
        // Fallback to separate API call if lists not included
        try {
          const lists = await getFolderLists(folder.id);
          
          if (lists && lists.lists && Array.isArray(lists.lists)) {
            lists.lists.forEach(list => {
              console.log(`   📋 ${list.name}: ${list.id}`);
            });
          } else {
            console.log(`   ❌ Unexpected lists structure:`, lists);
          }
        } catch (error) {
          console.log(`   ❌ Error getting lists: ${error.message}`);
        }
      }
      
      console.log('');
    }
    
    // Show command examples
    const firstClass = folders[0];
    if (firstClass) {
      let scheduleList;
      
      // Try to find Schedule list in the folder response first
      if (firstClass.lists && Array.isArray(firstClass.lists)) {
        scheduleList = firstClass.lists.find(l => l.name === 'Schedule');
      }
      
      // Fallback to API call if not found
      if (!scheduleList) {
        try {
          const lists = await getFolderLists(firstClass.id);
          scheduleList = lists?.lists?.find(l => l.name === 'Schedule');
        } catch (error) {
          console.log(`💡 Could not generate example command: ${error.message}`);
        }
      }
      
      if (scheduleList) {
        console.log(`💡 Example test command:`);
        console.log(`   node test-datetime.js ${scheduleList.id}`);
        console.log(`   (Uses Schedule list from "${firstClass.name}")`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error finding list IDs:', error.message);
    console.error('❌ Full error:', error);
  }
}

findListIds(); 