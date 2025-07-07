const { createFolder, createList, createTask, getCustomFields, createCustomField, getSpaceCustomFields, addCustomFieldToList, getUser, setListStatuses } = require('../utils/clickup-client');
const { CUSTOM_FIELD_IDS, weekDayMap, weekLabelMap, subjectMap, userMap } = require('../utils/clickup-maps');
const fs = require('fs').promises;
const path = require('path');
const { userDiscovery } = require('./user-discovery');
const { configLoader } = require('./config-loader');
const { copyFromTemplate } = require('./class-lesson-store');

const WORKSHOP_SPACE_ID = '14869535'; // The confirmed ID for the "1100: Workshop" space.

/**
 * Main function to create a complete orientation class in ClickUp
 * @param {string} startDate - ISO date string (YYYY-MM-DD) for the Monday start
 * @returns {object} - Result object with class details
 */
async function createOrientationClass(startDate) {
  console.log(`Creating orientation class for start date: ${startDate}`);
  
  try {
    // Generate class name from start date in MM.DD.YY format to match existing classes
    const date = new Date(startDate + 'T00:00:00');
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Zero-pad month (getMonth() is 0-indexed)
    const day = date.getDate().toString().padStart(2, '0'); // Zero-pad day
    const year = date.getFullYear().toString().slice(-2); // Get last 2 digits of year
    const className = `PD OTN ${month}.${day}.${year}`;
    console.log(`Class name will be: "${className}"`);
    
    // Step 1: Create the main folder
    console.log('Step 1: Creating folder...');
    const folder = await createFolder(WORKSHOP_SPACE_ID, className);
    console.log(`✓ Folder created: ${folder.id}`);
    
    // Step 2: Create the three required lists
    console.log('Step 2: Creating lists...');
    const scheduleList = await createList(folder.id, 'Schedule');
    console.log(`✓ Schedule list created: ${scheduleList.id}`);
    
    const classDetailsList = await createList(folder.id, 'Class Details');
    console.log(`✓ Class Details list created: ${classDetailsList.id}`);
    
    const feedbackGradesList = await createList(folder.id, 'Feedback & Grades');
    console.log(`✓ Feedback & Grades list created: ${feedbackGradesList.id}`);
    
    // Configure custom statuses for Schedule list
    try {
      await setListStatuses(scheduleList.id, [
        { status: 'Waiting', type: 'not_started', color: '#808080' },
        { status: 'Delayed', type: 'active', color: '#ffcc00' },
        { status: 'Done', type: 'complete', color: '#37b24d' }
      ]);
      console.log('✓ Schedule list statuses set (Waiting/Delayed/Done)');
    } catch (statusErr) {
      console.error('⚠️  Failed to set custom statuses on Schedule list:', statusErr.message);
    }
    
    // Step 3: Add existing custom fields to each list
    console.log('Step 3: Adding existing custom fields to lists...');
    console.log('Adding Schedule custom fields...');
    await addScheduleCustomFields(scheduleList.id);
    console.log('✓ Schedule custom fields added');
    
    console.log('Adding Class Details custom fields...');
    await addClassDetailsCustomFields(classDetailsList.id);
    console.log('✓ Class Details custom fields added');
    
    // Set statuses for Class Details list
    try {
      await setListStatuses(classDetailsList.id, [
        { status: 'Released', type: 'not_started', color: '#dc2626' },
        { status: 'Resigned', type: 'not_started', color: '#f59e0b' },
        { status: 'Graduated', type: 'active', color: '#3b82f6' }
      ]);
      console.log('✓ Class Details list statuses set (Released/Resigned/Graduated)');
    } catch (err) {
      console.error('⚠️  Failed to set statuses on Class Details list:', err.message);
    }
    
    console.log('Adding Feedback & Grades custom fields...');
    await addFeedbackGradesCustomFields(feedbackGradesList.id);
    console.log('✓ Feedback & Grades custom fields added');
    
    // Create default views for Feedback & Grades list
    try {
      const { createView } = require('../utils/clickup-client');
      // List views
      await createView({
        name: 'Daily Feedback',
        type: 'list',
        parent: { id: feedbackGradesList.id, type: 6 }
      });
      await createView({
        name: 'Homework Grades',
        type: 'list',
        parent: { id: feedbackGradesList.id, type: 6 }
      });
      // Embed views
      await createView({
        name: 'Daily Feedback Form',
        type: 'embed',
        embed_link: 'https://collin-ho.github.io/orientation-static/daily-feedback/',
        parent: { id: feedbackGradesList.id, type: 6 }
      });
      await createView({
        name: 'Homework Grades Form',
        type: 'embed',
        embed_link: 'https://collin-ho.github.io/orientation-static/homework-feedback/',
        parent: { id: feedbackGradesList.id, type: 6 }
      });
      console.log('✓ Feedback & Grades views created');
    } catch(viewErr) {
      console.error('⚠️  Failed to create views on Feedback & Grades list:', viewErr.message);
    }
    
    // Step 4: Create all lesson tasks
    console.log('Step 4: Creating lesson tasks...');
    await createLessonTasks(scheduleList.id, startDate);
    console.log('✓ Lesson tasks created');
    
    // Step 5: Create placeholder orientee
    console.log('Step 5: Creating placeholder orientee...');
    await createPlaceholderOrientee(classDetailsList.id);
    console.log('✓ Placeholder orientee created');
    
    // Step 6: Set up views (this would require additional ClickUp API calls)
    console.log('Step 6: Views will need to be configured manually in ClickUp UI for now...');
    
    // Save mapping for sync service
    const { addClassMapping } = require('./class-store');
    addClassMapping({ className, folderId: folder.id, scheduleListId: scheduleList.id });

    copyFromTemplate(className);

    return {
      success: true,
      className,
      folderId: folder.id,
      lists: {
        schedule: scheduleList.id,
        classDetails: classDetailsList.id,
        feedbackGrades: feedbackGradesList.id
      },
      message: 'Orientation class created successfully! Please configure views in ClickUp.'
    };
    
  } catch (error) {
    console.error('Error creating orientation class:', error);
    console.error('Error details:', error.response ? await error.response.text() : 'No response details');
    throw new Error(`Failed to create orientation class: ${error.message}`);
  }
}

  /**
   * Add existing custom fields to the Schedule list
   */
async function addScheduleCustomFields(listId) {
  // Use the known field IDs directly (getSpaceCustomFields doesn't return all fields)
  const scheduleFieldIds = [
    { name: 'Lead(s)', id: CUSTOM_FIELD_IDS.SCHEDULE.LEADS },
    { name: 'Week #', id: CUSTOM_FIELD_IDS.SCHEDULE.WEEK_NUM },
    { name: 'Week Day', id: CUSTOM_FIELD_IDS.SCHEDULE.WEEK_DAY },
    { name: 'Subject', id: CUSTOM_FIELD_IDS.SCHEDULE.SUBJECT },
    { name: 'Relevant Files', id: CUSTOM_FIELD_IDS.SCHEDULE.RELEVANT_FILES },
    { name: 'Send Invite', id: CUSTOM_FIELD_IDS.SCHEDULE.SEND_INVITE }
  ];
  
  for (const field of scheduleFieldIds) {
    try {
      await addCustomFieldToList(listId, field.id);
      console.log(`Added Schedule field: ${field.name}`);
    } catch (error) {
      console.error(`Error adding Schedule field ${field.name}:`, error.message);
    }
  }
}

/**
 * Add existing custom fields to the Class Details list  
 */
async function addClassDetailsCustomFields(listId) {
  // Use the known field IDs directly (getSpaceCustomFields doesn't return all fields)
  const classDetailsFieldIds = [
    { name: 'PD Orientee', id: CUSTOM_FIELD_IDS.CLASS_DETAILS.PD_ORIENTEE },
    { name: 'WK 1 Feedback for the AD', id: CUSTOM_FIELD_IDS.CLASS_DETAILS.WK_1_FEEDBACK },
    { name: 'WK 2 Feedback for the AD', id: CUSTOM_FIELD_IDS.CLASS_DETAILS.WK_2_FEEDBACK },
    { name: 'Pillar', id: CUSTOM_FIELD_IDS.CLASS_DETAILS.PILLAR },
    { name: 'Personality TAG', id: CUSTOM_FIELD_IDS.CLASS_DETAILS.PERSONALITY_TAG },
    { name: 'Cogent Email', id: CUSTOM_FIELD_IDS.CLASS_DETAILS.COGENT_EMAIL },
    { name: 'LinkedIn Profile', id: CUSTOM_FIELD_IDS.CLASS_DETAILS.LINKEDIN_PROFILE },
    { name: 'Market', id: CUSTOM_FIELD_IDS.CLASS_DETAILS.MARKET }
  ];
  
  for (const field of classDetailsFieldIds) {
    try {
      await addCustomFieldToList(listId, field.id);
      console.log(`Added Class Details field: ${field.name}`);
    } catch (error) {
      console.error(`Error adding Class Details field ${field.name}:`, error.message);
    }
  }
}

/**
 * Add existing custom fields to the Feedback & Grades list
 */
async function addFeedbackGradesCustomFields(listId) {
  // Use the known field IDs directly (getSpaceCustomFields doesn't return all fields)
  const feedbackGradesFieldIds = [
    { name: 'PD Orientee', id: CUSTOM_FIELD_IDS.FEEDBACK_GRADES.PD_ORIENTEE },
    { name: 'Comments', id: CUSTOM_FIELD_IDS.FEEDBACK_GRADES.COMMENTS },
    { name: 'Effort', id: CUSTOM_FIELD_IDS.FEEDBACK_GRADES.EFFORT },
    { name: 'Comp', id: CUSTOM_FIELD_IDS.FEEDBACK_GRADES.COMP },
    { name: 'Application', id: CUSTOM_FIELD_IDS.FEEDBACK_GRADES.APPLICATION },
    { name: 'Week #', id: CUSTOM_FIELD_IDS.FEEDBACK_GRADES.WEEK_NUM },
    { name: 'Week Day', id: CUSTOM_FIELD_IDS.FEEDBACK_GRADES.WEEK_DAY },
    { name: 'Assignment', id: CUSTOM_FIELD_IDS.FEEDBACK_GRADES.ASSIGNMENT },
    { name: 'Grade', id: CUSTOM_FIELD_IDS.FEEDBACK_GRADES.GRADE }
  ];
  
  for (const field of feedbackGradesFieldIds) {
    try {
      await addCustomFieldToList(listId, field.id);
      console.log(`Added Feedback & Grades field: ${field.name}`);
    } catch (error) {
      console.error(`Error adding Feedback & Grades field ${field.name}:`, error.message);
    }
  }
}

/**
 * Create lesson tasks with schedule and custom fields
 */
async function createLessonTasks(listId, startDateStr) {
  // Get lessons from app template system
  console.log('📋 Loading lessons from app template system...');
  if (!configLoader.loaded) {
    await configLoader.loadConfigurations();
  }
  
  const lessons = configLoader.getLessons({ isActive: true });
  
  // Fix date parsing - create date in local timezone to avoid Sunday shift
  console.log(`📅 Parsing start date: ${startDateStr}`);
  const [year, month, day] = startDateStr.split('-').map(Number);
  const startDate = new Date(year, month - 1, day); // month is 0-indexed
  console.log(`📅 Parsed start date: ${startDate.toDateString()} (day of week: ${startDate.getDay()})`); // 1 = Monday
  
  // Get dynamic user mapping from live ClickUp data
  console.log('🔍 Getting live user mapping from ClickUp...');
  const userResult = await userDiscovery.discoverUsers();
  const liveUserMap = {};
  
  // Build name-to-user-object mapping from live data
  userResult.users.forEach(user => {
    liveUserMap[user.name] = {
      id: user.id,
      username: user.name,
      email: user.email,
      color: user.color || '#808080',
      initials: user.initials || '',
      profilePicture: user.profilePicture || null
    };
  });
  
  console.log(`✅ Built live user mapping for ${Object.keys(liveUserMap).length} users`);
  console.log(`📚 Loaded ${lessons.length} lessons from app template`);
  
  console.log(`📅 Creating ${lessons.length} lessons with proper timing...`);
  
  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];
    
    try {
      // Calculate lesson date - fix the date calculation
      const lessonDate = new Date(startDate);
      lessonDate.setDate(startDate.getDate() + lesson.dayOffset);
      
      console.log(`📅 Lesson ${lesson.name}: Base date ${lessonDate.toDateString()} (day ${lessonDate.getDay()})`);
      
      // Apply specific times from template
      let dueDate = new Date(lessonDate);
      
      if (lesson.startTime && lesson.endTime) {
        // Parse template times (format: "HH:MM")
        const [startHour, startMinute] = lesson.startTime.split(':').map(Number);
        const [endHour, endMinute] = lesson.endTime.split(':').map(Number);
        
        // Set start time
        lessonDate.setHours(startHour, startMinute, 0, 0);
        
        // Set end time for due_date
        dueDate.setHours(endHour, endMinute, 0, 0);
        
        console.log(`⏰ ${lesson.name}: ${lesson.startTime} - ${lesson.endTime}`);
        console.log(`   Start: ${lessonDate.toLocaleString()}`);
        console.log(`   Due:   ${dueDate.toLocaleString()}`);
      } else {
        // Fallback to business hours if no timing in template
        lessonDate.setHours(9, 0, 0, 0);
        dueDate.setHours(10, 0, 0, 0);
        console.log(`⏰ ${lesson.name}: Default timing (9:00 AM - 10:00 AM)`);
      }
      
      // Prepare custom fields array
      const customFields = [];
      
      // Week # field (maps to dropdown values)
      if (lesson.week && CUSTOM_FIELD_IDS.SCHEDULE.WEEK_NUM) {
        const weekValue = weekLabelMap[lesson.week];
        if (weekValue) {
          customFields.push({
            id: CUSTOM_FIELD_IDS.SCHEDULE.WEEK_NUM,
            value: weekValue
          });
        }
      }
      
      // Week Day field (maps to dropdown values)
      if (lesson.weekDay && CUSTOM_FIELD_IDS.SCHEDULE.WEEK_DAY) {
        const dayValue = weekDayMap[lesson.weekDay];
        if (dayValue) {
          customFields.push({
            id: CUSTOM_FIELD_IDS.SCHEDULE.WEEK_DAY,
            value: dayValue
          });
        }
      }
      
      // Subject field (maps to dropdown values)
      if (lesson.subject && CUSTOM_FIELD_IDS.SCHEDULE.SUBJECT) {
        const subjectValue = subjectMap[lesson.subject];
        if (subjectValue) {
          customFields.push({
            id: CUSTOM_FIELD_IDS.SCHEDULE.SUBJECT,
            value: subjectValue
          });
        }
      }
      
      // Lead(s) field - get user IDs from live mapping
      if (lesson.leads && lesson.leads.length > 0 && CUSTOM_FIELD_IDS.SCHEDULE.LEADS) {
        const leadIds = [];
        
        lesson.leads.forEach(leadName => {
          const user = liveUserMap[leadName];
          if (user) {
            leadIds.push(user.id);
            console.log(`👤 Mapped lead: ${leadName} → ${user.id}`);
          } else {
            console.warn(`⚠️  Lead not found in live data: ${leadName}`);
          }
        });
        
        if (leadIds.length > 0) {
          customFields.push({
            id: CUSTOM_FIELD_IDS.SCHEDULE.LEADS,
            value: {
              add: leadIds,
              rem: []
            }
          });
        }
      }
      
      // Create the lesson task WITHOUT any time fields (ClickUp resets times to midnight)
      const task = await createTask(listId, {
        name: lesson.name,
        description: lesson.description || `${lesson.name} lesson`,
        custom_fields: customFields
      });
      
      console.log(`📊 Created ${lesson.name} (no time fields sent)`);
      
      console.log(`✅ [${i + 1}/${lessons.length}] Created: ${lesson.name} (${customFields.length} fields, ${lesson.leads?.length || 0} leads)`);
      
    } catch (error) {
      console.error(`❌ [${i + 1}/${lessons.length}] Failed: ${lesson.name} - ${error.message}`);
    }
  }
  
  console.log(`🎉 Lesson creation complete! ${lessons.length} lessons processed from app template.`);
}

/**
 * Create placeholder orientee in Class Details
 */
async function createPlaceholderOrientee(listId) {
  try {
    const task = await createTask(listId, {
      name: 'Orientee 1',
      description: 'Placeholder orientee - update with actual information',
      custom_fields: []
    });
    
    console.log('Created placeholder orientee');
  } catch (error) {
    console.error('Error creating placeholder orientee:', error.message);
  }
}

module.exports = {
  createOrientationClass
}; 