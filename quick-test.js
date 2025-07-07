const { createTask } = require('./utils/clickup-client');

// Known list ID from your recent class creation (update this if needed)
const TEST_LIST_ID = '901409267881'; // This was the Class Details list ID I saw in your code

async function quickDateTimeTest() {
  console.log('🧪 Quick Date/Time Test...\n');
  
  // Test the date parsing logic first
  const startDateStr = '2025-07-07'; // Monday
  console.log(`📅 Input: ${startDateStr}`);
  
  // Original method (potentially buggy)
  const originalDate = new Date(startDateStr);
  console.log(`❌ Original: ${originalDate.toDateString()} (day ${originalDate.getDay()})`);
  
  // Fixed method 
  const [year, month, day] = startDateStr.split('-').map(Number);
  const fixedDate = new Date(year, month - 1, day);
  console.log(`✅ Fixed: ${fixedDate.toDateString()} (day ${fixedDate.getDay()})\n`);
  
  // Create test task with timing
  const testDate = new Date(fixedDate);
  testDate.setHours(14, 30, 0, 0); // 2:30 PM
  
  const dueDate = new Date(fixedDate);
  dueDate.setHours(15, 30, 0, 0); // 3:30 PM
  
  console.log(`📅 Test task timing:`);
  console.log(`   Local: ${testDate.toLocaleString()} → ${dueDate.toLocaleString()}`);
  console.log(`   UTC: ${testDate.toISOString()} → ${dueDate.toISOString()}`);
  console.log(`   Timestamps: ${testDate.getTime()} → ${dueDate.getTime()}\n`);
  
  console.log(`🚀 Creating test task in list ${TEST_LIST_ID}...`);
  
  try {
    const task = await createTask(TEST_LIST_ID, {
      name: `DATETIME TEST - ${new Date().toISOString()}`,
      description: 'Testing datetime - safe to delete',
      start_date: testDate.getTime(),
      due_date: dueDate.getTime()
    });
    
    console.log(`✅ Test task created: ${task.id}`);
    console.log(`\n🔍 Check ClickUp for this task:`);
    console.log(`   Expected start: 2:30 PM on ${fixedDate.toDateString()}`);
    console.log(`   Expected due: 3:30 PM on ${fixedDate.toDateString()}`);
    console.log(`   If times are blank or wrong, we've found the issue!`);
    
  } catch (error) {
    console.error(`❌ Failed to create test task:`, error.message);
    console.log(`\n💡 The list ID ${TEST_LIST_ID} might not exist.`);
    console.log(`   Try updating the TEST_LIST_ID in quick-test.js with a valid one.`);
  }
}

quickDateTimeTest().catch(console.error); 