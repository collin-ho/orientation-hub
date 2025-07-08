const fetch = require('node-fetch');
require('dotenv').config();

// ------------------------------------------------------------------
// 🔕 ClickUp OFF switch – early-exit with harmless stubs when disabled
// ------------------------------------------------------------------
const USE_CLICKUP = process.env.USE_CLICKUP === 'true';
if (!USE_CLICKUP) {
  console.log('🔕  ClickUp integration disabled – stubbed client loaded');
  module.exports = new Proxy(
    {},
    {
      get: () => async () => {
        throw new Error('ClickUp integration is disabled (USE_CLICKUP=false)');
      },
    },
  );
  return; // stop loading the real client
}

const TEAM_ID = process.env.CLICKUP_TEAM_ID;
const TOKEN = process.env.CLICKUP_TOKEN;
const ORIENTEE_FIELD_ID = process.env.CLICKUP_ORIENTEE_FIELD_ID;
const LIST_ID = process.env.CLICKUP_LIST_ID;
const SPACE_ID = process.env.CLICKUP_SPACE_ID || '6'; // Default to '6' if not set
const TEAM_ID_FROM_ENV = process.env.CLICKUP_TEAM_ID || '2387134'; // Default to your team ID

// Cache for orientee options
let cachedOrienteeOptions = null;
let cacheTs = 0;
const CACHE_TTL = 1000 * 60 * 15; // 15 minutes

// API resilience configuration (optimized for enterprise ClickUp plans)
const API_CONFIG = {
  DELAY_BETWEEN_CALLS: 0, // No delay needed with enterprise limits (10k+/minute)
  MAX_RETRIES: 3,
  INITIAL_RETRY_DELAY: 1000, // 1 second
  RETRY_BACKOFF_MULTIPLIER: 2 // Exponential backoff: 1s, 2s, 4s
};

/**
 * Sleep utility for adding delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is due to rate limiting
 */
function isRateLimitError(error, response) {
  // ClickUp rate limit responses typically return 429 status
  if (response && response.status === 429) {
    return true;
  }
  
  // Check for rate limit indicators in error message
  const errorMessage = error.message?.toLowerCase() || '';
  return errorMessage.includes('rate limit') || 
         errorMessage.includes('too many requests') ||
         errorMessage.includes('429');
}

/**
 * Enhanced fetch with rate limiting and retry logic
 */
async function rateLimitedFetch(url, options, retryCount = 0) {
  try {
    // Add delay before each call (except first retry)
    if (retryCount > 0) {
      const delay = API_CONFIG.INITIAL_RETRY_DELAY * 
                   Math.pow(API_CONFIG.RETRY_BACKOFF_MULTIPLIER, retryCount - 1);
      console.log(`⏳ Retry ${retryCount}/${API_CONFIG.MAX_RETRIES} - waiting ${delay}ms...`);
      await sleep(delay);
    } else if (API_CONFIG.DELAY_BETWEEN_CALLS > 0) {
      // Only add delay if configured (enterprise plans don't need this)
      await sleep(API_CONFIG.DELAY_BETWEEN_CALLS);
    }

    const response = await fetch(url, options);
    
    // Handle rate limiting (rare with enterprise but still possible)
    if (response.status === 429) {
      if (retryCount < API_CONFIG.MAX_RETRIES) {
        console.warn(`🚦 Rate limit hit for ${url} - retrying...`);
        return await rateLimitedFetch(url, options, retryCount + 1);
      } else {
        throw new Error(`Rate limit exceeded after ${API_CONFIG.MAX_RETRIES} retries`);
      }
    }
    
    // Handle other HTTP errors
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorBody}`);
    }
    
    return response;
    
  } catch (error) {
    // Retry on network errors that might be rate-limit related
    if (isRateLimitError(error) && retryCount < API_CONFIG.MAX_RETRIES) {
      console.warn(`🔄 Network error (possibly rate limit) - retrying... Error: ${error.message}`);
      return await rateLimitedFetch(url, options, retryCount + 1);
    }
    
    throw error;
  }
}

async function fetchOrienteeOptions() {
  const now = Date.now();
  if (cachedOrienteeOptions && (now - cacheTs) < CACHE_TTL) {
    return cachedOrienteeOptions;
  }
  // Use the List-level endpoint to fetch all fields for the list
  const url = `https://api.clickup.com/api/v2/list/${LIST_ID}/field`;
  const resp = await rateLimitedFetch(url, {
    method: 'GET',
    headers: {
      'Authorization': TOKEN,
      'Content-Type': 'application/json'
    }
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ClickUp fetch field failed: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  // Find the orientee dropdown field
  const orienteeField = (data.fields || []).find(f => f.id === ORIENTEE_FIELD_ID);
  if (!orienteeField || !orienteeField.type_config || !Array.isArray(orienteeField.type_config.options)) {
    throw new Error('ClickUp response missing orientee dropdown options');
  }
  cachedOrienteeOptions = orienteeField.type_config.options.map(opt => ({ name: opt.name, id: opt.id }));
  cacheTs = now;
  return cachedOrienteeOptions;
}

async function getListFields(listId) {
  if (!listId) {
    throw new Error('ClickUp List ID is required');
  }
  const url = `https://api.clickup.com/api/v2/list/${listId}/field`;
  const resp = await rateLimitedFetch(url, {
    method: 'GET',
    headers: {
      'Authorization': TOKEN,
      'Content-Type': 'application/json'
    }
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ClickUp fetch fields failed for list ${listId}: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  return data.fields || [];
}

async function getListDetails(listId) {
  if (!listId) {
    throw new Error('ClickUp List ID is required');
  }
  const url = `https://api.clickup.com/api/v2/list/${listId}`;
  const resp = await rateLimitedFetch(url, {
    method: 'GET',
    headers: {
      'Authorization': TOKEN,
      'Content-Type': 'application/json'
    }
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ClickUp get list details failed for list ${listId}: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  return data;
}

async function getFolderLists(folderId) {
  if (!folderId) {
    throw new Error('ClickUp Folder ID is required');
  }
  const url = `https://api.clickup.com/api/v2/folder/${folderId}/list`;
  const resp = await rateLimitedFetch(url, {
    method: 'GET',
    headers: {
      'Authorization': TOKEN,
      'Content-Type': 'application/json'
    }
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ClickUp get folder lists failed for folder ${folderId}: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  return data.lists || [];
}

async function getSpaces(teamId) {
  if (!teamId) {
    throw new Error('ClickUp Team ID is required');
  }
  const url = `https://api.clickup.com/api/v2/team/${teamId}/space`;
  const resp = await rateLimitedFetch(url, {
    method: 'GET',
    headers: {
      'Authorization': TOKEN,
      'Content-Type': 'application/json'
    }
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ClickUp get spaces failed for team ${teamId}: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  return data.spaces || [];
}

async function getSpaceFolders(spaceId) {
  if (!spaceId) {
    throw new Error('ClickUp Space ID is required');
  }
  const url = `https://api.clickup.com/api/v2/space/${spaceId}/folder`;
  const resp = await rateLimitedFetch(url, {
    method: 'GET',
    headers: {
      'Authorization': TOKEN,
      'Content-Type': 'application/json'
    }
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ClickUp get space folders failed for space ${spaceId}: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  return data.folders || [];
}

async function findFolderByName(folderName, spaceId = null) {
  if (!folderName) {
    throw new Error('Folder name is required');
  }
  // Use provided spaceId or fall back to environment variable
  const targetSpaceId = spaceId || SPACE_ID;
  const folders = await getSpaceFolders(targetSpaceId);
  const foundFolder = folders.find(f => f.name.trim().toLowerCase() === folderName.trim().toLowerCase());
  return foundFolder || null;
}

async function getTasks(listId) {
  if (!listId) {
    throw new Error('ClickUp List ID is required');
  }
  // Note: This endpoint is paginated. For simplicity, we'll fetch the first page (up to 100 tasks).
  // A more robust solution would handle pagination to get all tasks if a list has more than 100.
  const url = `https://api.clickup.com/api/v2/list/${listId}/task?include_attachments=true`;
  const resp = await rateLimitedFetch(url, {
    method: 'GET',
    headers: {
      'Authorization': TOKEN,
      'Content-Type': 'application/json'
    }
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ClickUp get tasks failed for list ${listId}: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  return data.tasks || [];
}

async function getTask(taskId) {
  if (!taskId) {
    throw new Error('ClickUp Task ID is required');
  }
  const url = `https://api.clickup.com/api/v2/task/${taskId}`;
  const resp = await rateLimitedFetch(url, {
    method: 'GET',
    headers: {
      'Authorization': TOKEN,
      'Content-Type': 'application/json'
    }
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ClickUp get task failed for task ${taskId}: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  return data;
}

async function mapOrienteeNameToID(name) {
  const options = await fetchOrienteeOptions();
  const found = options.find(o => o.name === name);
  return found ? found.id : '';
}

async function createClickUpTask({ name, content, custom_fields }) {
  const url = `https://api.clickup.com/api/v2/list/${LIST_ID}/task`;
  const resp = await rateLimitedFetch(url, {
    method: 'POST',
    headers: {
      'Authorization': TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name, content, custom_fields })
  });
  const body = await resp.json();
  if (!resp.ok) {
    throw new Error(`ClickUp create task failed: ${resp.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function createFolder(spaceId, folderName) {
  if (!spaceId || !folderName) {
    throw new Error('Space ID and folder name are required');
  }
  const url = `https://api.clickup.com/api/v2/space/${spaceId}/folder`;
  const resp = await rateLimitedFetch(url, {
    method: 'POST',
    headers: {
      'Authorization': TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: folderName })
  });
  const body = await resp.json();
  if (!resp.ok) {
    throw new Error(`ClickUp create folder failed: ${resp.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function createList(folderId, listName) {
  if (!folderId || !listName) {
    throw new Error('Folder ID and list name are required');
  }
  const url = `https://api.clickup.com/api/v2/folder/${folderId}/list`;
  const resp = await rateLimitedFetch(url, {
    method: 'POST',
    headers: {
      'Authorization': TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: listName })
  });
  const body = await resp.json();
  if (!resp.ok) {
    throw new Error(`ClickUp create list failed: ${resp.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function createTask(listId, taskData) {
  if (!listId || !taskData) {
    throw new Error('List ID and task data are required');
  }
  const url = `https://api.clickup.com/api/v2/list/${listId}/task`;
  const resp = await rateLimitedFetch(url, {
    method: 'POST',
    headers: {
      'Authorization': TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(taskData)
  });
  const body = await resp.json();
  if (!resp.ok) {
    throw new Error(`ClickUp create task failed: ${resp.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function createCustomField(listId, fieldData) {
  if (!listId || !fieldData) {
    throw new Error('List ID and field data are required');
  }
  const url = `https://api.clickup.com/api/v2/list/${listId}/field`;
  const resp = await rateLimitedFetch(url, {
    method: 'POST',
    headers: {
      'Authorization': TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(fieldData)
  });
  const body = await resp.json();
  if (!resp.ok) {
    throw new Error(`ClickUp create custom field failed: ${resp.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function getCustomFields(listId) {
  if (!listId) {
    throw new Error('List ID is required');
  }
  const url = `https://api.clickup.com/api/v2/list/${listId}/field`;
  const resp = await rateLimitedFetch(url, {
    method: 'GET',
    headers: {
      'Authorization': TOKEN,
      'Content-Type': 'application/json'
    }
  });
  const body = await resp.json();
  if (!resp.ok) {
    throw new Error(`ClickUp get custom fields failed: ${resp.status} ${JSON.stringify(body)}`);
  }
  return body.fields || [];
}

async function getSpaceCustomFields(spaceId) {
  if (!spaceId) {
    throw new Error('Space ID is required');
  }
  const url = `https://api.clickup.com/api/v2/space/${spaceId}/field`;
  const resp = await rateLimitedFetch(url, {
    method: 'GET',
    headers: {
      'Authorization': TOKEN,
      'Content-Type': 'application/json'
    }
  });
  const body = await resp.json();
  if (!resp.ok) {
    throw new Error(`ClickUp get space custom fields failed: ${resp.status} ${JSON.stringify(body)}`);
  }
  return body.fields || [];
}

async function addCustomFieldToList(listId, fieldId) {
  if (!listId || !fieldId) {
    throw new Error('List ID and Field ID are required');
  }
  const url = `https://api.clickup.com/api/v2/list/${listId}/field/${fieldId}`;
  const resp = await rateLimitedFetch(url, {
    method: 'POST',
    headers: {
      'Authorization': TOKEN,
      'Content-Type': 'application/json'
    }
  });
  const body = await resp.json();
  if (!resp.ok) {
    throw new Error(`ClickUp add field to list failed: ${resp.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function deleteCustomField(fieldId) {
  if (!fieldId) {
    throw new Error('Field ID is required');
  }
  const url = `https://api.clickup.com/api/v2/field/${fieldId}`;
  const resp = await rateLimitedFetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': TOKEN,
      'Content-Type': 'application/json'
    }
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ClickUp delete custom field failed: ${resp.status} ${text}`);
  }
  return true;
}

/**
 * Get team members
 */
async function getTeamMembers(teamId) {
  if (!teamId) {
    throw new Error('Team ID is required');
  }
  const url = `https://api.clickup.com/api/v2/team/${teamId}/member`;
  const resp = await rateLimitedFetch(url, {
    method: 'GET',
    headers: {
      'Authorization': TOKEN,
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ClickUp get team members failed: ${resp.status} ${text}`);
  }
  const body = await resp.json();
  return body.members || [];
}

/**
 * Get space members  
 */
async function getSpaceMembers(spaceId) {
  if (!spaceId) {
    throw new Error('Space ID is required');
  }
  const url = `https://api.clickup.com/api/v2/space/${spaceId}/member`;
  const resp = await rateLimitedFetch(url, {
    method: 'GET',
    headers: {
      'Authorization': TOKEN,
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ClickUp get space members failed: ${resp.status} ${text}`);
  }
  const body = await resp.json();
  return body.members || [];
}

/**
 * Get user data by ID
 */
async function getUser(userId) {
  if (!userId) {
    throw new Error('User ID is required');
  }
  const url = `https://api.clickup.com/api/v2/user/${userId}`;
  const resp = await rateLimitedFetch(url, {
    method: 'GET',
    headers: {
      'Authorization': TOKEN,
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ClickUp get user failed: ${resp.status} ${text}`);
  }
  const body = await resp.json();
  return body;
}

/**
 * Update a list to use custom statuses.
 * @param {string} listId - ClickUp List ID
 * @param {Array<{status:string,type:string,color:string}>} statusesArr
 */
async function setListStatuses(listId, statusesArr) {
  if (!listId || !Array.isArray(statusesArr)) {
    throw new Error('List ID and statuses array are required');
  }
  const url = `https://api.clickup.com/api/v2/list/${listId}`;
  const resp = await rateLimitedFetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      statuses: statusesArr
    })
  });
  const body = await resp.json();
  if (!resp.ok) {
    throw new Error(`ClickUp set list statuses failed: ${resp.status} ${JSON.stringify(body)}`);
  }
  return body;
}

/**
 * Create a view (list, board, embed, etc.) via ClickUp API
 */
async function createView(viewData) {
  const url = 'https://api.clickup.com/api/v2/view';
  const resp = await rateLimitedFetch(url, {
    method: 'POST',
    headers: {
      'Authorization': TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(viewData)
  });
  const body = await resp.json();
  if (!resp.ok) {
    throw new Error(`ClickUp create view failed: ${resp.status} ${JSON.stringify(body)}`);
  }
  return body;
}

module.exports = {
  mapOrienteeNameToID,
  createClickUpTask,
  fetchOrienteeOptions,
  getListFields,
  getListDetails,
  getFolderLists,
  getSpaceFolders,
  findFolderByName,
  getTasks,
  getTask,
  getSpaces,
  createFolder,
  createList,
  createTask,
  getCustomFields,
  createCustomField,
  getSpaceCustomFields,
  addCustomFieldToList,
  deleteCustomField,
  getTeamMembers,
  getSpaceMembers,
  getUser,
  setListStatuses,
  createView,
  rateLimitedFetch
};
