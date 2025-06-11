const fetch = require('node-fetch');
require('dotenv').config();

const TEAM_ID = process.env.CLICKUP_TEAM_ID;
const TOKEN = process.env.CLICKUP_TOKEN;
const ORIENTEE_FIELD_ID = process.env.CLICKUP_ORIENTEE_FIELD_ID;
const LIST_ID = process.env.CLICKUP_LIST_ID;

// Cache for orientee options
let cachedOrienteeOptions = null;
let cacheTs = 0;
const CACHE_TTL = 1000 * 60 * 15; // 15 minutes

async function fetchOrienteeOptions() {
  const now = Date.now();
  if (cachedOrienteeOptions && (now - cacheTs) < CACHE_TTL) {
    return cachedOrienteeOptions;
  }
  // Use the List-level endpoint to fetch all fields for the list
  const url = `https://api.clickup.com/api/v2/list/${LIST_ID}/field`;
  const resp = await fetch(url, {
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

async function mapOrienteeNameToID(name) {
  const options = await fetchOrienteeOptions();
  const found = options.find(o => o.name === name);
  return found ? found.id : '';
}

async function createClickUpTask({ name, content, custom_fields }) {
  const url = `https://api.clickup.com/api/v2/list/${LIST_ID}/task`;
  const resp = await fetch(url, {
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

module.exports = {
  mapOrienteeNameToID,
  createClickUpTask,
  fetchOrienteeOptions
};
