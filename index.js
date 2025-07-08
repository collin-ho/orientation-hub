const express = require('express');
require('dotenv').config();
const USE_CLICKUP = process.env.USE_CLICKUP === 'true';
const { weekDayMap, weekLabelMap, pillarMap, personalityTagMap } = require('./utils/clickup-maps');
const { 
  mapOrienteeNameToID, 
  createClickUpTask, // This is the legacy function
  createTask,        // This is the one we want to use
  fetchOrienteeOptions, 
  getSpaceFolders, 
  getSpaceCustomFields, 
  addCustomFieldToList, 
  getCustomFields, 
  getFolderLists,
  findFolderByName // We need this
} = require('./utils/clickup-client');
const db = require('./services/db');

let generateReport = async () => { throw new Error('Report generation disabled (ClickUp off)'); };
let fieldDiscovery = null;
let clickupLessonReader = null;
let createOrientationClass = async () => { throw new Error('Class creator disabled (ClickUp off)'); };
if (USE_CLICKUP) {
  ({ generateReport } = require('./services/report-generator'));
  ({ fieldDiscovery } = require('./services/field-discovery'));
  ({ clickupLessonReader } = require('./services/clickup-lesson-reader'));
  ({ createOrientationClass } = require('./services/class-creator'));
}

const { userDiscovery } = require('./services/user-discovery');
const { dropdownOptions } = require('./services/dropdown-options');
const { configLoader } = require('./services/config-loader');
const { getAllLessons, replaceAllLessons } = require('./services/lesson-store');
const { getAllInstructors, replaceAllInstructors } = require('./services/instructor-store');
const { syncLessons } = require('./services/lesson-sync');

const app = express();
app.use(express.json());

// CORS (allow your HTML origin or '*')
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const EFFORT_FIELD_ID = process.env.EFFORT_FIELD_ID;
const COMPREHENSION_FIELD_ID = process.env.COMPREHENSION_FIELD_ID;
const CLIENTAPP_FIELD_ID = process.env.CLIENTAPP_FIELD_ID;
const COMMENTS_FIELD_ID = process.env.COMMENTS_FIELD_ID;
const GRADE_FIELD_ID = process.env.GRADE_FIELD_ID;
const LEADS_FIELD_ID = process.env.LEADS_FIELD_ID;

// Orientation feedback route adjustment
app.post('/orientation-feedback', async (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const { grader, weekLabel, weekDay, items, className } = payload;
  if (!className) {
    return res.status(400).json({ error: 'Missing required field: className' });
  }
  if (typeof grader !== 'string' || typeof weekLabel !== 'string' || typeof weekDay !== 'string' || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // If ClickUp disabled, store locally
  if (!USE_CLICKUP) {
    const insert = db.prepare(`INSERT INTO feedback (class_name, orientee_name, grader, week_label, week_day, effort, comprehension, client_app, comments) VALUES (?,?,?,?,?,?,?,?,?)`);
    const results = [];
    for (const item of items) {
      try {
        const { name: orienteeName, effort, comprehension, clientApp, feedback } = item;
        insert.run(className, orienteeName, grader, weekLabel, weekDay, effort, comprehension, clientApp, feedback || '');
        results.push({ orienteeName, success: true });
      } catch (err) {
        results.push({ orienteeName: item.name, success: false, error: err.message });
      }
    }
    const hasError = results.some(r => !r.success);
    return res.status(hasError ? 207 : 200).json({ results });
  }

  // Fallback to old ClickUp logic if enabled
  let feedbackListId;
  try {
    const classFolder = await findFolderByName(className);
    if (!classFolder) {
      throw new Error(`Class folder "${className}" not found.`);
    }
    const lists = await getFolderLists(classFolder.id);
    const feedbackList = lists.find(l => l.name === 'Daily Feedback');
    if (!feedbackList) {
      throw new Error(`'Daily Feedback' list not found in class "${className}".`);
    }
    feedbackListId = feedbackList.id;
  } catch(err) {
    return res.status(404).json({ error: err.message });
  }

  // Map week fields
  const weekDayID = weekDayMap[weekDay];
  const weekLabelID = weekLabelMap[weekLabel];
  if (!weekDayID || !weekLabelID) {
    return res.status(400).json({ error: `Unknown weekDay or weekLabel: ${weekDay}, ${weekLabel}` });
  }

  const results = [];
  for (const item of items) {
    try {
      const { name: orienteeName, effort, comprehension, clientApp, feedback } = item;
      if (typeof orienteeName !== 'string') throw new Error('Invalid orientee name');
      let orienteeID = await mapOrienteeNameToID(orienteeName);
      if (!orienteeID) {
        // Optionally auto-create:
        // orienteeID = await createOrienteeOption(orienteeName);
        throw new Error(`Orientee not found: "${orienteeName}"`);
      }
      // Build task
      const taskName = grader;
      const contentLines = [
        `Grader: ${grader}`,
        `Orientee: ${orienteeName}`,
        `Effort: ${effort}`,
        `Comprehension: ${comprehension}`,
        `Client App: ${clientApp}`,
        `Comments: ${feedback || '(none)'}`
      ];
      const content = contentLines.join('\n');
      const custom_fields = [
        { id: process.env.CLICKUP_WEEKDAY_FIELD_ID, value: weekDayID },
        { id: process.env.CLICKUP_WEEKLABEL_FIELD_ID, value: weekLabelID },
        { id: process.env.CLICKUP_ORIENTEE_FIELD_ID, value: orienteeID },
      ];
      // Numeric fields
      if (EFFORT_FIELD_ID) custom_fields.push({ id: EFFORT_FIELD_ID, value: effort });
      if (COMPREHENSION_FIELD_ID) custom_fields.push({ id: COMPREHENSION_FIELD_ID, value: comprehension });
      if (CLIENTAPP_FIELD_ID) custom_fields.push({ id: CLIENTAPP_FIELD_ID, value: clientApp });
      // Comments as custom field (if desired):
      if (COMMENTS_FIELD_ID) custom_fields.push({ id: COMMENTS_FIELD_ID, value: feedback || '' });
      // Grade or Leads if needed
      // if (GRADE_FIELD_ID) custom_fields.push({ id: GRADE_FIELD_ID, value: someGradeValue });
      // if (LEADS_FIELD_ID) custom_fields.push({ id: LEADS_FIELD_ID, value: [userId1, userId2] });

      const task = await createTask(feedbackListId, { name: taskName, description: content, custom_fields });
      results.push({ orienteeName, success: true, taskId: task.id });
    } catch (err) {
      results.push({ orienteeName: item.name, success: false, error: err.message });
    }
  }
  const hasError = results.some(r => !r.success);
  res.status(hasError ? 207 : 200).json({ results });
});

// Endpoint to get current orientees from ClickUp
app.get('/orientees', async (req, res) => {
  try {
    const options = await fetchOrienteeOptions();
    res.json(options);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/classes', async (req, res) => {
  try {
    const WORKSHOP_SPACE_ID = '14869535';
    const folders = await getSpaceFolders(WORKSHOP_SPACE_ID);
    
    // Filter folders to only include those matching the orientation class naming convention
    const classFolders = folders
      .filter(f => f.name.trim().startsWith('PD OTN'))
      .map(f => ({ id: f.id, name: f.name.trim() }));

    res.json(classFolders);
  } catch (error) {
    console.error('Error fetching class folders:', error);
    res.status(500).json({ error: 'Failed to fetch class folders from ClickUp.' });
  }
});

app.get('/api/classes/list-with-active', async (req, res) => {
  try {
    const WORKSHOP_SPACE_ID = '14869535';
    const folders = await getSpaceFolders(WORKSHOP_SPACE_ID);

    const classFolders = folders
      .filter(f => f.name.trim().startsWith('PD OTN'))
      .map(f => ({ id: f.id, name: f.name.trim() }));

    const parseClassStartDate = (className) => {
      const shortMatch = className.match(/PD OTN (\d{2})\.(\d{2})\.(\d{2})/);
      if (shortMatch) {
        const [, month, day, year] = shortMatch;
        return new Date(2000 + parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      const longMatch = className.match(/PD OTN (\d{4}-\d{2}-\d{2})/);
      if (longMatch) {
        return new Date(longMatch[1] + 'T00:00:00');
      }
      return null;
    };

    const getClassStatus = (startDate) => {
      if (!startDate) return 'unknown';
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 11);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (today < startDate) return 'future';
      if (today > endDate) return 'past';
      return 'active';
    };
    
    let activeClass = null;
    const now = new Date();

    const classesWithStatus = classFolders.map(cls => {
      const startDate = parseClassStartDate(cls.name);
      const status = getClassStatus(startDate);
      if (status === 'active' && !activeClass) {
          activeClass = cls.name;
      }
      return { ...cls, status };
    });

    // If no active class, find the closest future class
    if (!activeClass) {
        const futureClasses = classesWithStatus
            .filter(c => c.status === 'future')
            .sort((a, b) => parseClassStartDate(a.name) - parseClassStartDate(b.name));
        if (futureClasses.length > 0) {
            activeClass = futureClasses[0].name;
        }
    }

    res.json({
        classes: classesWithStatus,
        activeClassName: activeClass,
    });

  } catch (error) {
    console.error('Error fetching class list with active status:', error);
    res.status(500).json({ error: 'Failed to fetch class list' });
  }
});


app.get('/api/generate-report', async (req, res) => {
  const { className } = req.query;
  // Accept both ?reportType= and legacy ?type=
  const typeParam = req.query.reportType || req.query.type;

  if (!className) {
    return res.status(400).send('Error: Please provide a className query parameter.');
  }

  // Default to full report when none specified
  const type = typeParam || 'full';

  try {
    let options = {};
    if (type === 'daily') {
      const { day } = req.query;
      if (!day) {
        return res.status(400).send('Daily report requires "day" query param (YYYY-MM-DD)');
      }
      options.day = day;
    }

    const pdfBuffer = await generateReport(className, type, options);
    if (pdfBuffer) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="report-${className}-${type}.pdf"`);
      res.send(pdfBuffer);
    } else {
      res.status(500).send('Error generating report. Check server logs.');
    }
  } catch (error) {
    console.error('Error in /generate-report route:', error);
    res.status(500).send('An internal server error occurred.');
  }
});

// Get raw report data (for detail view) including ClickUp photos
app.get('/api/generate-report-data', async (req, res) => {
  const { className } = req.query;
  
  if (!className) {
    return res.status(400).json({ error: 'Class name is required' });
  }
  
  try {
    // Use the existing report generation logic but return JSON instead of PDF
    const { generateReportData } = require('./services/report-generator');
    const reportData = await generateReportData(className);
    
    if (!reportData) {
      return res.status(404).json({ error: 'Class not found or no data available' });
    }
    
    res.json(reportData);
  } catch (error) {
    console.error('Error fetching report data:', error);
    res.status(500).json({ error: 'Failed to fetch report data', details: error.message });
  }
});

// Create new orientation class
app.post('/api/create-class', async (req, res) => {
  const { startDate } = req.body;
  
  if (!startDate) {
    return res.status(400).json({ error: 'Start date is required' });
  }
  
  try {
    // Validate start date is a Monday
    const selectedDate = new Date(startDate + 'T00:00:00');
    const dayOfWeek = selectedDate.getDay();
    
    if (dayOfWeek !== 1) {
      return res.status(400).json({ error: 'Start date must be a Monday' });
    }
    
    // Create class using our new service
    const result = await createOrientationClass(startDate);
    
    res.json(result);
  } catch (error) {
    console.error('Error creating class:', error);
    res.status(500).json({ error: 'Failed to create class', details: error.message });
  }
});

// API endpoint to get field options for dropdowns
app.get('/api/field-options', async (req, res) => {
  try {
    // Get field options from existing list instead of space (more reliable)
    const CLASS_DETAILS_LIST_ID = '901409267881';
    const classDetailsFields = await getCustomFields(CLASS_DETAILS_LIST_ID);
    
    // Find the specific fields we need
    const pillarField = classDetailsFields.find(f => f.name === 'Pillar');
    const marketField = classDetailsFields.find(f => f.name === 'Market');
    const personalityField = classDetailsFields.find(f => f.name === 'Personality TAG');
    
    // Normalize personality tag options (labels field uses 'label' instead of 'name')
    const personalityOptions = personalityField?.type_config?.options?.map(opt => ({
      id: opt.id,
      name: opt.label, // Convert 'label' to 'name' for consistency
      color: opt.color
    })) || [];
    
    const fieldOptions = {
      pillar: pillarField?.type_config?.options || [],
      market: marketField?.type_config?.options || [],
      personalityTag: personalityOptions
    };
    
    res.json(fieldOptions);
  } catch (error) {
    console.error('Error fetching field options:', error);
    res.status(500).json({ error: 'Failed to fetch field options' });
  }
});

// API endpoint to create orientees and set up class details
app.post('/api/setup-class-orientees', async (req, res) => {
  try {
    const { classData, orientees } = req.body;
    
    if (!classData || !orientees || !Array.isArray(orientees)) {
      return res.status(400).json({ error: 'Invalid request data' });
    }
    
    // Get dropdown field options for mapping
    const CLASS_DETAILS_LIST_ID = '901409267881';
    const classDetailsFields = await getCustomFields(CLASS_DETAILS_LIST_ID);
    const marketField = classDetailsFields.find(f => f.name === 'Market');
    const marketOptions = marketField?.type_config?.options || [];
    
    const results = [];
    
    // Create orientee dropdown options and Class Details tasks
    for (const orientee of orientees) {
      try {
        // 1. Create new "PD Orientee" dropdown option
        const orienteeOptionId = await createOrienteeDropdownOption(orientee.name);
        
        // 2. Map dropdown values to option IDs
        const customFields = [
          { id: 'fdd1f582-d61c-47ac-920d-72a1f0107d7e', value: orienteeOptionId }, // PD Orientee
        ];
        
        // Pillar field (dropdown)
        if (orientee.pillar) {
          const pillarOptionId = pillarMap[orientee.pillar];
          if (pillarOptionId) {
            customFields.push({ id: '6601dd3b-4bae-4cb7-a9c1-a24ef1ef07fb', value: pillarOptionId });
          } else {
            console.warn(`Pillar option not found: ${orientee.pillar}`);
          }
        }
        
        // Market field (dropdown - find matching option)
        if (orientee.market) {
          const marketOption = marketOptions.find(opt => opt.name === orientee.market);
          if (marketOption) {
            customFields.push({ id: '46e75424-1184-4121-96e1-9d433b26ce6b', value: marketOption.id });
          } else {
            console.warn(`Market option not found: ${orientee.market}`);
          }
        }
        
        // Text/URL fields
        if (orientee.cogentEmail) {
          customFields.push({ id: '49275d9f-0331-461e-afac-dd244549cce7', value: orientee.cogentEmail });
        }
        if (orientee.linkedinProfile) {
          customFields.push({ id: '10382f47-9eac-4d40-a6ba-cdb3fd6bf051', value: orientee.linkedinProfile });
        }
        
        // Personality TAG (labels field - uses array of label IDs)
        if (orientee.personalityTag) {
          const personalityLabelId = personalityTagMap[orientee.personalityTag];
          if (personalityLabelId) {
            customFields.push({ id: '69347d12-00dd-4c2f-9a3d-547b76f370c6', value: [personalityLabelId] });
          } else {
            console.warn(`Personality TAG option not found: ${orientee.personalityTag}`);
          }
        }
        
        // 3. Create task in Class Details list
        const taskData = {
          name: orientee.name,
          description: `Profile for ${orientee.name}`,
          custom_fields: customFields
        };
        
        const task = await createTask(classData.lists.classDetails, taskData);
        
        results.push({
          orientee: orientee.name,
          success: true,
          taskId: task.id,
          orienteeOptionId
        });
        
      } catch (error) {
        console.error(`Error creating orientee ${orientee.name}:`, error);
        results.push({
          orientee: orientee.name,
          success: false,
          error: error.message
        });
      }
    }
    
    res.json({ results });
    
  } catch (error) {
    console.error('Error setting up class orientees:', error);
    res.status(500).json({ error: 'Failed to setup class orientees' });
  }
});

// New API endpoint to add orientees to existing classes
app.post('/api/add-orientees-to-class', async (req, res) => {
  try {
    const { className, orientees } = req.body;
    
    if (!className || !orientees || !Array.isArray(orientees)) {
      return res.status(400).json({ error: 'Invalid request data' });
    }
    
    // Find the class by name
    const WORKSHOP_SPACE_ID = '14869535';
    const classesData = await getSpaceFolders(WORKSHOP_SPACE_ID);
    const targetClass = classesData.folders.find(folder => folder.name === className);
    
    if (!targetClass) {
      return res.status(404).json({ error: `Class "${className}" not found` });
    }
    
    // Get the Class Details list from this class
    const listsData = await getFolderLists(targetClass.id);
    const classDetailsListId = listsData.lists.find(list => list.name === 'Class Details')?.id;
    
    if (!classDetailsListId) {
      return res.status(404).json({ error: 'Class Details list not found in this class' });
    }
    
    // Use the same logic as setup-class-orientees but for existing class
    const results = [];
    
    for (const orientee of orientees) {
      try {
        // Create new "PD Orientee" dropdown option
        const orienteeOptionId = await createOrienteeDropdownOption(orientee.name);
        
        // Build custom fields
        const customFields = [
          { id: 'fdd1f582-d61c-47ac-920d-72a1f0107d7e', value: orienteeOptionId },
        ];
        
        // Add optional fields if provided
        if (orientee.pillar) {
          const pillarOptionId = pillarMap[orientee.pillar];
          if (pillarOptionId) {
            customFields.push({ id: '6601dd3b-4bae-4cb7-a9c1-a24ef1ef07fb', value: pillarOptionId });
          }
        }
        
        if (orientee.cogentEmail) {
          customFields.push({ id: '49275d9f-0331-461e-afac-dd244549cce7', value: orientee.cogentEmail });
        }
        
        if (orientee.linkedinProfile) {
          customFields.push({ id: '10382f47-9eac-4d40-a6ba-cdb3fd6bf051', value: orientee.linkedinProfile });
        }
        
        // Create task in Class Details list
        const taskData = {
          name: orientee.name,
          description: `Profile for ${orientee.name} (added live)`,
          custom_fields: customFields
        };
        
        const task = await createTask(classDetailsListId, taskData);
        
        results.push({
          orientee: orientee.name,
          success: true,
          taskId: task.id,
          orienteeOptionId
        });
        
      } catch (error) {
        console.error(`Error adding orientee ${orientee.name}:`, error);
        results.push({
          orientee: orientee.name,
          success: false,
          error: error.message
        });
      }
    }
    
    res.json({ 
      success: true,
      className,
      results,
      message: `Added ${results.filter(r => r.success).length} orientees to ${className}`
    });
    
  } catch (error) {
    console.error('Error adding orientees to class:', error);
    res.status(500).json({ error: 'Failed to add orientees to class' });
  }
});

// Helper function to create orientee dropdown option
async function createOrienteeDropdownOption(name) {
  const ORIENTEE_FIELD_ID = 'fdd1f582-d61c-47ac-920d-72a1f0107d7e';
  const TOKEN = process.env.CLICKUP_TOKEN;
  const randomColor = '#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0');
  
  const url = `https://api.clickup.com/api/v2/custom_field/${ORIENTEE_FIELD_ID}/dropdown_option`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 
      'Authorization': TOKEN, 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify({ name, color: randomColor })
  });
  
  const contentType = resp.headers.get('content-type') || '';
  let body;
  if (contentType.includes('application/json')) {
    body = await resp.json();
  } else {
    const text = await resp.text();
    body = { raw: text };
  }
  if (!resp.ok) {
    // If endpoint not found (404), fallback: fetch existing options and find by name
    if (resp.status === 404) {
      try {
        const listUrl = `https://api.clickup.com/api/v2/list/901409827058/field`; // Class details list - temporary
        const listResp = await fetch(listUrl, { headers:{ Authorization:TOKEN } });
        const listJson = await listResp.json();
        const orienteeField = (listJson.fields||[]).find(f=>f.id===ORIENTEE_FIELD_ID);
        const match = orienteeField?.type_config?.options?.find(o=>o.name===name);
        if (match) return match.id;
      } catch {}
    }
    throw new Error(`Failed to create orientee option: ${resp.status} ${JSON.stringify(body)}`);
  }
  return body.id || null;
}

// ==============================
// USER DISCOVERY API
// ==============================

// Get all ClickUp users (with caching)
app.get('/api/config/users', async (req, res) => {
  try {
    const result = await userDiscovery.discoverUsers();
    res.json(result);
  } catch (error) {
    console.error('Error discovering users:', error);
    res.status(500).json({ 
      error: 'Failed to discover users',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get users formatted for dropdowns
app.get('/api/config/users/dropdown', async (req, res) => {
  try {
    const dropdownUsers = await userDiscovery.getUsersForDropdown();
    res.json(dropdownUsers);
  } catch (error) {
    console.error('Error getting dropdown users:', error);
    res.status(500).json({ error: 'Failed to get dropdown users' });
  }
});

// Get instructors only
app.get('/api/config/users/instructors', async (req, res) => {
  try {
    const instructors = await userDiscovery.getInstructorsOnly();
    res.json(instructors);
  } catch (error) {
    console.error('Error getting instructors:', error);
    res.status(500).json({ error: 'Failed to get instructors' });
  }
});

// Search users
app.get('/api/config/users/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    const results = await userDiscovery.searchUsers(q);
    res.json(results);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Instructor analysis - compare ClickUp users vs lesson leads (must be before :userId route)
app.get('/api/config/users/instructor-analysis', async (req, res) => {
  try {
    const analysis = await userDiscovery.getInstructorAnalysis();
    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error('💥 Instructor analysis error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoint - show all spaces and their member counts
app.get('/api/config/users/debug-spaces', async (req, res) => {
  try {
    const { getSpaces, getSpaceMembers } = require('./utils/clickup-client');
    
    const TEAM_ID = process.env.CLICKUP_TEAM_ID || '2387134';
    
    console.log(`🔍 Getting all spaces for team ${TEAM_ID}...`);
    
    const spaces = await getSpaces(TEAM_ID);
    
    const spacesWithMembers = await Promise.all(
      spaces.map(async (space) => {
        try {
          const members = await getSpaceMembers(space.id);
          return {
            id: space.id,
            name: space.name,
            memberCount: members.length,
            members: members.map(m => ({
              username: m.user?.username,
              email: m.user?.email
            }))
          };
        } catch (error) {
          return {
            id: space.id,
            name: space.name,
            memberCount: 'error',
            error: error.message
          };
        }
      })
    );
    
    res.json({
      currentSpaceId: '14869535',
      totalSpaces: spaces.length,
      spaces: spacesWithMembers,
      recommendation: spacesWithMembers.find(s => s.memberCount > 8) || null
    });
  } catch (error) {
    console.error('💥 Debug spaces error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user by ID
app.get('/api/config/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await userDiscovery.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error getting user by ID:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Clear user cache (development/testing)
app.post('/api/config/users/clear-cache', async (req, res) => {
  try {
    userDiscovery.clearCache();
    res.json({ message: 'User cache cleared successfully' });
  } catch (error) {
    console.error('Error clearing user cache:', error);
    res.status(500).json({ error: 'Failed to clear user cache' });
  }
});

// Get cache statistics
app.get('/api/config/users/cache-stats', async (req, res) => {
  try {
    const stats = userDiscovery.getCacheStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({ error: 'Failed to get cache stats' });
  }
});

// ==============================
// INSTRUCTOR CACHE ENDPOINTS
// ==============================

app.get('/api/instructors', (req, res) => {
  try {
    const list = getAllInstructors();
    res.json({ success:true, instructors:list, count:list.length });
  } catch(err){
    console.error('instructors fetch err', err.message);
    res.status(500).json({ success:false, error:err.message });
  }
});

app.post('/api/sync/instructors', async (req, res) => {
  try {
    const result = await userDiscovery.discoverUsers();
    // Filter only instructors field (based on property isInstructor)
    const instructors = result.users.filter(u=>u.isInstructor);
    replaceAllInstructors(instructors);
    res.json({ success:true, count:instructors.length, message:'Instructors synced' });
  }catch(err){
    console.error('sync instructors err', err.message);
    res.status(500).json({ success:false, error:err.message });
  }
});

// ==============================
// LESSON SYNC ENDPOINT
// ==============================

app.post('/api/sync/lessons', async (req,res)=>{
  try {
    const { className } = req.body; // optional
    const summary = await syncLessons(className||null);
    res.json({ success:true, ...summary });
  } catch(err){
    console.error('sync lessons err', err.message);
    res.status(500).json({ success:false, error:err.message });
  }
});

// after lessons sync endpoint
app.post('/api/link/lessons', async (req,res)=>{
  try {
    const { className } = req.body;
    const { linkExistingTasks } = require('./services/lesson-sync');
    const summary = await linkExistingTasks(className);
    res.json({ success:true, ...summary });
  }catch(err){
    console.error('link lessons err', err.message);
    res.status(500).json({ success:false, error:err.message });
  }
});

// Register class mapping manually
app.post('/api/classes/register', (req,res)=>{
  try {
    const { className, scheduleListId, folderId } = req.body;
    if(!className||!scheduleListId) return res.status(400).json({success:false,error:'className and scheduleListId required'});
    const { addClassMapping } = require('./services/class-store');
    addClassMapping({className, folderId:folderId||null, scheduleListId});
    res.json({ success:true, message:'Class registered'});
  }catch(err){
    res.status(500).json({ success:false, error:err.message });
  }
});

// ==============================
// FIELD DISCOVERY API
// ==============================

// Get all ClickUp custom fields (with caching)
app.get('/api/config/fields', async (req, res) => {
  try {
    const result = await fieldDiscovery.discoverAllFields();
    res.json(result);
  } catch (error) {
    console.error('Error discovering fields:', error);
    res.status(500).json({ 
      error: 'Failed to discover fields',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get fields for a specific list
app.get('/api/config/fields/list/:listName', async (req, res) => {
  try {
    const { listName } = req.params;
    const result = await fieldDiscovery.discoverFieldsForList(listName);
    res.json(result);
  } catch (error) {
    console.error(`Error discovering fields for list ${req.params.listName}:`, error);
    res.status(500).json({ error: 'Failed to discover fields for list' });
  }
});

// Get fields formatted for dropdowns
app.get('/api/config/fields/dropdown', async (req, res) => {
  try {
    const dropdownFields = await fieldDiscovery.getFieldsForDropdown();
    res.json(dropdownFields);
  } catch (error) {
    console.error('Error getting dropdown fields:', error);
    res.status(500).json({ error: 'Failed to get dropdown fields' });
  }
});

// Get dropdown options for a specific field
app.get('/api/config/fields/:fieldId/options', async (req, res) => {
  try {
    const { fieldId } = req.params;
    const options = await fieldDiscovery.getFieldOptions(fieldId);
    res.json(options);
  } catch (error) {
    console.error(`Error getting options for field ${req.params.fieldId}:`, error);
    res.status(500).json({ error: 'Failed to get field options' });
  }
});

// Search fields
app.get('/api/config/fields/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    const results = await fieldDiscovery.searchFields(q);
    res.json(results);
  } catch (error) {
    console.error('Error searching fields:', error);
    res.status(500).json({ error: 'Failed to search fields' });
  }
});

// Get fields by category
app.get('/api/config/fields/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const fields = await fieldDiscovery.getFieldsByCategory(category);
    res.json(fields);
  } catch (error) {
    console.error(`Error getting fields for category ${req.params.category}:`, error);
    res.status(500).json({ error: 'Failed to get fields by category' });
  }
});

// Clear field cache (development/testing)
app.post('/api/config/fields/clear-cache', async (req, res) => {
  try {
    fieldDiscovery.clearCache();
    res.json({ message: 'Field cache cleared successfully' });
  } catch (error) {
    console.error('Error clearing field cache:', error);
    res.status(500).json({ error: 'Failed to clear field cache' });
  }
});

// Get field cache statistics
app.get('/api/config/fields/cache-stats', async (req, res) => {
  try {
    const stats = fieldDiscovery.getCacheStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting field cache stats:', error);
    res.status(500).json({ error: 'Failed to get field cache stats' });
  }
});

// ==============================
// DROPDOWN OPTIONS API
// ==============================

// Get all dropdown options across all fields
app.get('/api/config/field-options', async (req, res) => {
  try {
    const result = await dropdownOptions.getAllDropdownOptions();
    res.json(result);
  } catch (error) {
    console.error('Error getting dropdown options:', error);
    res.status(500).json({ 
      error: 'Failed to get dropdown options',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get options for a specific field
app.get('/api/config/field-options/:fieldIdentifier', async (req, res) => {
  try {
    const { fieldIdentifier } = req.params;
    const options = await dropdownOptions.getOptionsForField(fieldIdentifier);
    res.json(options);
  } catch (error) {
    console.error(`Error getting options for field ${req.params.fieldIdentifier}:`, error);
    res.status(500).json({ error: 'Failed to get field options' });
  }
});

// Get options by category
app.get('/api/config/field-options/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const options = await dropdownOptions.getOptionsByCategory(category);
    res.json(options);
  } catch (error) {
    console.error(`Error getting options for category ${req.params.category}:`, error);
    res.status(500).json({ error: 'Failed to get options by category' });
  }
});

// Search dropdown options
app.get('/api/config/field-options/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    const results = await dropdownOptions.searchOptions(q);
    res.json(results);
  } catch (error) {
    console.error('Error searching dropdown options:', error);
    res.status(500).json({ error: 'Failed to search dropdown options' });
  }
});

// Get options formatted for UI components (with required format)
app.get('/api/config/field-options/:fieldIdentifier/ui/:format', async (req, res) => {
  try {
    const { fieldIdentifier, format } = req.params;
    const options = await dropdownOptions.getOptionsForUI(fieldIdentifier, format);
    res.json(options);
  } catch (error) {
    console.error(`Error getting UI-formatted options for ${req.params.fieldIdentifier}:`, error);
    res.status(500).json({ error: 'Failed to get UI-formatted options' });
  }
});

// Get options formatted for UI components (with default format)
app.get('/api/config/field-options/:fieldIdentifier/ui', async (req, res) => {
  try {
    const { fieldIdentifier } = req.params;
    const options = await dropdownOptions.getOptionsForUI(fieldIdentifier, 'react-select');
    res.json(options);
  } catch (error) {
    console.error(`Error getting UI-formatted options for ${req.params.fieldIdentifier}:`, error);
    res.status(500).json({ error: 'Failed to get UI-formatted options' });
  }
});

// Get dropdown options summary/statistics
app.get('/api/config/field-options/summary', async (req, res) => {
  try {
    const summary = await dropdownOptions.getOptionsSummary();
    res.json(summary);
  } catch (error) {
    console.error('Error getting dropdown options summary:', error);
    res.status(500).json({ error: 'Failed to get dropdown options summary' });
  }
});

// Clear dropdown options cache
app.post('/api/config/field-options/clear-cache', async (req, res) => {
  try {
    dropdownOptions.clearCache();
    res.json({ message: 'Dropdown options cache cleared successfully' });
  } catch (error) {
    console.error('Error clearing dropdown options cache:', error);
    res.status(500).json({ error: 'Failed to clear dropdown options cache' });
  }
});

// Get dropdown options cache statistics
app.get('/api/config/field-options/cache-stats', async (req, res) => {
  try {
    const stats = dropdownOptions.getCacheStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting dropdown options cache stats:', error);
    res.status(500).json({ error: 'Failed to get dropdown options cache stats' });
  }
});

// ==============================
// CONFIGURATION MANAGEMENT API
// ==============================

// Get field mappings configuration
app.get('/api/config/field-mappings', async (req, res) => {
  try {
    // Ensure config is loaded
    if (!configLoader.loaded) {
      await configLoader.loadConfigurations();
    }
    
    const fieldMappings = configLoader.getFieldMappings();
    
    res.json({
      success: true,
      ...fieldMappings
    });
  } catch (error) {
    console.error('Error getting field mappings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get field mappings',
      details: error.message
    });
  }
});

// ==============================
// LESSON MANAGEMENT API
// ==============================

// Get all lessons from configuration
app.get('/api/config/lessons', async (req, res) => {
  try {
    const lessons = getAllLessons();
    res.json({
      success: true,
      lessons,
      metadata: {
        totalLessons: lessons.length,
        source: 'sqlite'
      }
    });
  } catch (error) {
    console.error('Error getting lessons (SQLite):', error);
    res.status(500).json({ success:false, error:'Failed to get lessons', details:error.message });
  }
});

// Get available subjects
app.get('/api/config/subjects', async (req, res) => {
  try {
    // Ensure config is loaded
    if (!configLoader.loaded) {
      await configLoader.loadConfigurations();
    }
    
    const lessonConfig = configLoader.getLessonTemplates();
    const subjects = lessonConfig.metadata.subjects || [];
    
    res.json({
      success: true,
      subjects
    });
  } catch (error) {
    console.error('Error getting subjects:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get subjects',
      details: error.message
    });
  }
});

// Replace all lessons in DB
app.put('/api/config/lessons', async (req, res) => {
  try {
    const { lessons } = req.body;
    
    if (!lessons || !Array.isArray(lessons)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid lessons data - must be an array'
      });
    }
    
    // Replace rows in SQLite
    replaceAllLessons(lessons);

    res.json({ success:true, message:`Updated ${lessons.length} lessons`, source:'sqlite' });
  } catch (error) {
    console.error('Error updating lessons:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update lessons',
      details: error.message
    });
  }
});

// Get available ClickUp classes for live mode
app.get('/api/config/lessons/live-classes', async (req, res) => {
  try {
    const classes = await clickupLessonReader.getAvailableClasses();
    res.json({
      success: true,
      classes
    });
  } catch (error) {
    console.error('Error getting live classes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get live classes',
      details: error.message
    });
  }
});

// Get lessons from a live ClickUp class
app.get('/api/config/lessons/live/:className', async (req, res) => {
  try {
    const { className } = req.params;
    const liveData = await clickupLessonReader.getLiveClassLessons(className);
    
    res.json({
      success: true,
      lessons: liveData.lessons,
      metadata: liveData.metadata
    });
  } catch (error) {
    console.error(`Error getting live lessons for ${req.params.className}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get live lessons',
      details: error.message
    });
  }
});

// Compare template lessons with live class lessons
app.post('/api/config/lessons/compare', async (req, res) => {
  try {
    const { className } = req.body;
    
    if (!className) {
      return res.status(400).json({
        success: false,
        error: 'Class name is required'
      });
    }
    
    // Get template lessons
    if (!configLoader.loaded) {
      await configLoader.loadConfigurations();
    }
    const templateLessons = configLoader.getLessons();
    
    // Compare with live lessons
    const comparison = await clickupLessonReader.compareLessons(templateLessons, className);
    
    res.json({
      success: true,
      comparison
    });
  } catch (error) {
    console.error('Error comparing lessons:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to compare lessons',
      details: error.message
    });
  }
});

// Clear live lesson cache
app.post('/api/config/lessons/clear-cache', async (req, res) => {
  try {
    const { className } = req.body;
    clickupLessonReader.clearCache(className);
    
    res.json({
      success: true,
      message: className 
        ? `Cache cleared for class: ${className}`
        : 'All lesson cache cleared'
    });
  } catch (error) {
    console.error('Error clearing lesson cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear lesson cache'
    });
  }
});

// ==============================
// MICROSOFT OUTLOOK CALENDAR API
// ==============================

// Send calendar invites for an entire class
app.post('/api/calendar/send-class-invites', async (req, res) => {
  try {
    const { classId, className } = req.body;
    
    if (!classId || !className) {
      return res.status(400).json({ 
        success: false, 
        error: 'Class ID and class name are required' 
      });
    }

    // Initialize calendar service
    const CalendarService = require('./services/calendar-service');
    const calendarService = new CalendarService();
    
    // Send invites for all lessons in the class
    await calendarService.sendAllClassInvites(classId);
    
    res.json({
      success: true,
      message: `Calendar invites sent successfully for ${className}`,
      className,
      classId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Calendar invite error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send calendar invites',
      details: error.message,
      troubleshooting: {
        checkMicrosoftCredentials: 'Verify MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and MICROSOFT_TENANT_ID are set',
        checkPermissions: 'Ensure app has Calendars.ReadWrite and Mail.Send permissions',
        checkFromEmail: 'Verify ORIENTATION_FROM_EMAIL is configured correctly'
      }
    });
  }
});

// Send welcome emails to all orientees in a class
app.post('/api/calendar/send-welcome-emails', async (req, res) => {
  try {
    const { classId, className } = req.body;
    
    if (!classId || !className) {
      return res.status(400).json({ 
        success: false, 
        error: 'Class ID and class name are required' 
      });
    }

    // Get class data and orientees
    const ClickUpLessonReader = require('./services/clickup-lesson-reader');
    const reader = new ClickUpLessonReader();
    const orientees = await reader.getClassOrientees(classId);
    
    if (!orientees || orientees.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No orientees found for this class'
      });
    }

    // Initialize calendar service and send welcome emails
    const CalendarService = require('./services/calendar-service');
    const calendarService = new CalendarService();
    
    const classData = {
      name: className,
      startDate: new Date().toLocaleDateString(), // TODO: Get actual start date from ClickUp
    };

    let emailsSent = 0;
    for (const orientee of orientees) {
      try {
        await calendarService.sendWelcomeEmail(orientee, classData);
        emailsSent++;
      } catch (error) {
        console.error(`Failed to send welcome email to ${orientee.name}:`, error);
      }
    }
    
    res.json({
      success: true,
      message: `Welcome emails sent to ${emailsSent} out of ${orientees.length} orientees`,
      emailsSent,
      totalOrientees: orientees.length,
      className,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Welcome email error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send welcome emails',
      details: error.message
    });
  }
});

// Test Microsoft Graph connection
app.get('/api/calendar/test-connection', async (req, res) => {
  try {
    const CalendarService = require('./services/calendar-service');
    const calendarService = new CalendarService();
    
    // Try to get access token
    const token = await calendarService.getAccessToken();
    
    if (token) {
      res.json({
        success: true,
        message: 'Microsoft Graph connection successful',
        tokenReceived: true,
        timestamp: new Date().toISOString(),
        configuration: {
          clientIdPresent: !!process.env.MICROSOFT_CLIENT_ID,
          tenantIdPresent: !!process.env.MICROSOFT_TENANT_ID,
          fromEmailConfigured: process.env.ORIENTATION_FROM_EMAIL || 'orientation@cogentanalytics.com'
        }
      });
    } else {
      throw new Error('Failed to obtain access token');
    }
    
  } catch (error) {
    console.error('❌ Microsoft Graph connection test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Microsoft Graph connection failed',
      details: error.message,
      configuration: {
        clientIdPresent: !!process.env.MICROSOFT_CLIENT_ID,
        clientSecretPresent: !!process.env.MICROSOFT_CLIENT_SECRET,
        tenantIdPresent: !!process.env.MICROSOFT_TENANT_ID,
        fromEmailConfigured: process.env.ORIENTATION_FROM_EMAIL || 'orientation@cogentanalytics.com'
      },
      troubleshooting: [
        'Verify Azure app registration is complete',
        'Check that admin consent has been granted',
        'Ensure all environment variables are set correctly',
        'Verify the app has required Microsoft Graph permissions'
      ]
    });
  }
});

// ==============================
// ORIENTEE MANAGEMENT API
// ==============================

app.post('/api/class/:listId/orientees', async (req, res) => {
  try {
    const { listId } = req.params;
    const { name, pillar, email } = req.body;

    if (!name) {
      return res.status(400).json({ success:false, error:'Name is required'});
    }
    const { createTask } = require('./utils/clickup-client');
    const { CUSTOM_FIELD_IDS, pillarMap } = require('./utils/clickup-maps');

    // Step 1: create dropdown option for orientee if needed
    let optionId;
    try {
      optionId = await createOrienteeDropdownOption(name);
    } catch(err) {
      console.error('Create option error:', err.message);
      return res.status(500).json({ success:false, error:'Failed to add orientee option', details: err.message});
    }

    // Build custom fields
    const custom_fields = [
      { id: CUSTOM_FIELD_IDS.CLASS_DETAILS.PD_ORIENTEE, value: optionId }
    ];
    if (pillar && pillarMap[pillar]) {
      custom_fields.push({ id: CUSTOM_FIELD_IDS.CLASS_DETAILS.PILLAR, value: pillarMap[pillar] });
    }
    if (email) {
      custom_fields.push({ id: CUSTOM_FIELD_IDS.CLASS_DETAILS.COGENT_EMAIL, value: email });
    }

    const task = await createTask(listId, {
      name,
      description: `${name} orientee`,
      custom_fields
    });

    res.json({ success:true, id: task.id, message:'Orientee added'});
  } catch(err) {
    console.error('Orientee add error', err.message);
    res.status(500).json({ success:false, error: err.message});
  }
});

// ==============================
// CLASS UTILITY ENDPOINTS
// ==============================

// Helper to search across known spaces
const KNOWN_SPACE_IDS = ['14869535', '16835428'];

app.get('/api/class/:className/ids', async (req, res) => {
  try {
    const { className } = req.params;
    const { findFolderByName, getFolderLists } = require('./utils/clickup-client');

    let folder = null;
    for (const spaceId of KNOWN_SPACE_IDS) {
      folder = await findFolderByName(className, spaceId);
      if (folder) break;
    }

    if (!folder) {
      return res.status(404).json({ success: false, error: 'Folder not found in any known spaces' });
    }

    const lists = await getFolderLists(folder.id);
    const ids = {};
    lists.forEach((lst) => {
      if (lst.name.includes('Schedule')) ids.scheduleListId = lst.id;
      else if (lst.name.includes('Class Details')) ids.classDetailsListId = lst.id;
      else if (lst.name.includes('Feedback')) ids.feedbackListId = lst.id;
    });

    res.json({ success: true, folderId: folder.id, ...ids });
  } catch (err) {
    console.error('class ids error', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================
// ASSIGNMENT OPTIONS API
// ==============================

app.get('/assignments', async (req, res) => {
  try {
    const { LIST_IDS, CUSTOM_FIELD_IDS } = require('./utils/clickup-maps');
    const { getListFields } = require('./utils/clickup-client');

    const fields = await getListFields(LIST_IDS.FEEDBACK_GRADES);
    const assignmentField = fields.find(f => f.id === CUSTOM_FIELD_IDS.FEEDBACK_GRADES.ASSIGNMENT);
    const options = assignmentField?.type_config?.options?.map(o => o.name) || [];
    res.json(options);
  } catch (err) {
    console.error('Assignment endpoint error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/class/:className/summary', async (req, res) => {
  try {
    const { className } = req.params;
    const reportGenerator = require('./services/report-generator');
    const data = await reportGenerator.generateReportData(className);
    const statusOrder=['Graduated','Resigned','Released'];
    const counts={graduated:0,resigned:0,released:0,total:0};
    data.classDetails.forEach(p=>{
      const s=p.status||'';
      if(s.toLowerCase().includes('graduated')) counts.graduated++; else if(s.toLowerCase().includes('resigned')) counts.resigned++; else if(s.toLowerCase().includes('released')) counts.released++;
      counts.total++;
    });
    res.json({ success:true, ...counts });
  } catch(err){
    console.error('summary error', err.message);
    res.status(500).json({ success:false, error: err.message});
  }
});

// Return basic orientee list for a class (name, status, pillar)
app.get('/api/class/:className/orientees', async (req, res) => {
  try {
    const { className } = req.params;
    const reportGenerator = require('./services/report-generator');
    const data = await reportGenerator.generateReportData(className);
    const orientees = data.classDetails.map(p => ({
      name: p.name,
      status: p.status || 'Unknown',
      pillar: p.pillar || 'N/A'
    }));
    res.json({ success: true, orientees });
  } catch (err) {
    console.error('orientees endpoint error', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get lessons for a specific class
app.get('/api/class-lessons/:className', (req,res)=>{
  try{
    const { className } = req.params;
    const { getLessons } = require('./services/class-lesson-store');
    const lessons = getLessons(className);
    res.json({ success:true, lessons });
  }catch(err){
    res.status(500).json({ success:false, error:err.message });
  }
});

// Replace lessons for a class
app.put('/api/class-lessons/:className', (req,res)=>{
  try{
    const { className } = req.params;
    const { lessons } = req.body;
    if(!Array.isArray(lessons)) return res.status(400).json({success:false,error:'lessons array required'});
    const { replaceLessons } = require('./services/class-lesson-store');
    replaceLessons(className, lessons);

    // Regenerate static schedule HTML
    try {
      const { buildHTML, saveHtmlToFile } = require('./services/schedule-generator');
      const { getLessons } = require('./services/class-lesson-store');
      const lessonData = getLessons(className);
      const html = buildHTML(lessonData);
      const slug = className.replace(/[^a-z0-9]/gi,'-').toLowerCase();
      const outPath = require('path').join(__dirname,'client','public','embed',`schedule-${slug}.html`);
      saveHtmlToFile(html, outPath);
      console.log(`📄 Schedule HTML updated for ${className} → ${outPath}`);
    }catch(genErr){
      console.error('schedule html gen err', genErr.message);
    }

    res.json({ success:true, count:lessons.length });
  }catch(err){
    res.status(500).json({ success:false, error:err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
