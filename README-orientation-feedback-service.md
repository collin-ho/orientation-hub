## Orientation Feedback Service Setup

This Markdown outlines a step-by-step plan to implement the Orientation Feedback handler on your VPS, integrating with ClickUp as discussed. Include all IDs and environment variables. Use this to guide your IDE’s built-in LLM or as documentation.

---

### 1. Overview

We will build a Node.js service that:

* Receives POST requests from the HTML form hosted on GitHub Live.
* For each orientee item, maps `weekDay`, `weekLabel`, and `name` to ClickUp dropdown option UUIDs.
* Creates a ClickUp task in a specified List, setting custom fields (Week Day, Week Label, Oriente, Effort, Comprehension, Client App, Comments, etc.).
* Runs on your VPS (droplet) similar to your Discord bot.
* Uses an in-memory cache for ClickUp dropdown options, with optional auto-create for new names.
* Uses environment variables for sensitive data (ClickUp token, IDs).
* Uses PM2 (or systemd) to run, with Nginx reverse proxy & Let's Encrypt for HTTPS.

---

### 2. Prerequisites

* A VPS (e.g., DigitalOcean droplet) with Node.js installed (>=16).
* SSH access and root or sudo privileges.
* Nginx installed (or ability to install).
* PM2 or another process manager installed.
* A ClickUp API token with permissions to read custom field definitions and create tasks in the target List.
* ClickUp custom field IDs and Team ID:

  * **ClickUp Team ID**: `2387134`
  * **Oriente dropdown Custom Field ID**: `fdd1f582-d61c-47ac-920d-72a1f0107d7e`
  * **Week Day dropdown Custom Field ID**: `b6766eaf-58b0-46a7-ad5a-031d984c88f`
  * **Week Label dropdown Custom Field ID**: `9e27e1a7-b935-4274-839a-c18ca8d72b61`
  * **Effort and Participation numeric Field ID**: `9dafe855-0d64-4f6b-b66d-322e584e1316`
  * **Comprehension numeric Field ID**: `92275dfb-6ce2-418e-a8cd-0f74be70ddf7`
  * **Client Application numeric Field ID**: `aab90257-fe00-4f08-89d6-d738277d1cb9`
  * **Grade numeric Field ID** (if used): `f38b32e1-5420-4975-9375-7e0bd000afc7`
  * **Comments short-text Field ID**: `831407c1-8971-4ab4-8a23-29083fdcc09f`
  * **Lead(s) users Field ID**: `a6280fe4-06fb-4bde-bb98-ff104bf23531`
* ClickUp List ID where tasks will be created: `<YOUR_CLICKUP_LIST_ID>` (to be replaced).
* Your HTML form already sends JSON: `{ grader, weekLabel, weekDay, items: [ { name, effort, comprehension, clientApp, feedback } ] }`.

---

### 3. Project Structure on VPS

Choose a directory for this service, e.g., `/home/username/orientation-feedback`. Structure:

```
orientation-feedback/
  |-- .env                  # environment variables
  |-- package.json
  |-- index.js              # main Express server
  |-- utils/
       |-- clickup-maps.ts  # static maps for weekDay, weekLabel (if using TS) or .js
       |-- clickup-client.js# functions to fetch dropdown, map names, create tasks
  |-- README.md             # this Markdown (optional copy)
```

> If using pure JavaScript, use `.js` files; if TypeScript, adjust accordingly and compile or use ts-node.

---

### 4. Environment Variables

Create a `.env` file in the project root (not committed) with:

```
# ClickUp API token (store securely)
CLICKUP_TOKEN=pk_xxx_your_clickup_api_token_here
# ClickUp IDs
CLICKUP_TEAM_ID=2387134
CLICKUP_ORIENTEE_FIELD_ID=fdd1f582-d61c-47ac-920d-72a1f0107d7e
CLICKUP_WEEKDAY_FIELD_ID=b6766eaf-58b0-46a7-ad5a-031d984c88f
CLICKUP_WEEKLABEL_FIELD_ID=9e27e1a7-b935-4274-839a-c18ca8d72b61
# ClickUp List for tasks (replace with real List ID)
CLICKUP_LIST_ID=<YOUR_CLICKUP_LIST_ID>
# Numeric custom field IDs (if mapping effort, comprehension, clientApp)
EFFORT_FIELD_ID=9dafe855-0d64-4f6b-b66d-322e584e1316
COMPREHENSION_FIELD_ID=92275dfb-6ce2-418e-a8cd-0f74be70ddf7
CLIENTAPP_FIELD_ID=aab90257-fe00-4f08-89d6-d738277d1cb9
# Optional: Grade, Comments, Lead(s) if used
GRADE_FIELD_ID=f38b32e1-5420-4975-9375-7e0bd000afc7
COMMENTS_FIELD_ID=831407c1-8971-4ab4-8a23-29083fdcc09f
LEADS_FIELD_ID=a6280fe4-06fb-4bde-bb98-ff104bf23531
# Server port
PORT=4000
```

Load these via dotenv in your code.

---

### 5. Static Maps for Week Day & Week Label

In `utils/clickup-maps.js` (or `.ts`):

```js
// utils/clickup-maps.js
exports.weekDayMap = {
  "Mon": "0e9c390d-04f1-494f-94e0-c5bf2bc4cbc7",
  "Tue": "f7b1f388-4d31-455a-9450-fed1e61d282c",
  "Wed": "2fd4fb6f-b90b-440e-9d39-ecda09edf820",
  "Thu": "fb89509c-3550-45f5-84d1-c67b542d1b5c",
  "Fri": "ee5fa415-97e3-4049-81f6-c08d181291f4",
};n
exports.weekLabelMap = {
  "Week 1 (Remote)": "76c5d76b-fef1-4c11-b1da-5ef2c83e3902",
  "Week 2 (In Person)": "e7594be7-9bf8-4e94-a196-994c42b0bb68",
};
```

> If your weekLabel values differ, adjust keys accordingly.

---

### 6. ClickUp Client Utilities

In `utils/clickup-client.js`:

```js
// utils/clickup-client.js
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
  const url = `https://api.clickup.com/api/v2/team/${TEAM_ID}/field/${ORIENTEE_FIELD_ID}`;
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ClickUp fetch field failed: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  if (!Array.isArray(data.options)) {
    throw new Error('ClickUp response missing options array');
  }
  cachedOrienteeOptions = data.options.map(opt => ({ name: opt.name, id: opt.id }));
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
      'Authorization': `Bearer ${TOKEN}`,
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
  createClickUpTask
};
```

> If you want auto-create for missing orientee names, add a `createOrienteeOption(name)` function:
>
> ```js
> async function createOrienteeOption(name) {
>   const url = `https://api.clickup.com/api/v2/field/${ORIENTEE_FIELD_ID}/option`;
>   const resp = await fetch(url, {
>     method: 'POST',
>     headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
>     body: JSON.stringify({ name })
>   });
>   const body = await resp.json();
>   if (!resp.ok) throw new Error(`Failed to create option: ${resp.status} ${JSON.stringify(body)}`);
>   // Invalidate cache
>   cachedOrienteeOptions = null;
>   cacheTs = 0;
>   return body.id;
> }
> ```

---

### 7. Main Server Code (Express)

In `index.js` at project root:

```js
// index.js
const express = require('express');
const fetch = require('node-fetch');
require('dotenv').config();
const { weekDayMap, weekLabelMap } = require('./utils/clickup-maps'); // if JS; if TS adjust
const { mapOrienteeNameToID, createClickUpTask } = require('./utils/clickup-client');

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

app.post('/orientation-feedback', async (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const { grader, weekLabel, weekDay, items } = payload;
  if (typeof grader !== 'string' || typeof weekLabel !== 'string' || typeof weekDay !== 'string' || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Missing required fields' });
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
      const taskName = `Orientation Feedback: ${orienteeName} (${weekLabel} ${weekDay})`;
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

      const task = await createClickUpTask({ name: taskName, content, custom_fields });
      results.push({ orienteeName, success: true, taskId: task.id });
    } catch (err) {
      results.push({ orienteeName: item.name, success: false, error: err.message });
    }
  }
  const hasError = results.some(r => !r.success);
  res.status(hasError ? 207 : 200).json({ results });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
```

---

### 8. Install & Run on VPS

1. **SSH into VPS**, clone or copy project:

   ```bash
   cd /home/username
   git clone <your-repo-or-upload> orientation-feedback
   cd orientation-feedback
   npm install
   ```
2. **Set environment variables** on VPS:

   * Create `/home/username/orientation-feedback/.env` with variables as in Section 4.
   * Or export in shell or use a service manager.
3. **Install PM2** (if not installed):

   ```bash
   npm install -g pm2
   ```
4. **Start the service** with PM2:

   ```bash
   pm2 start index.js --name orientation-feedback
   pm2 save
   ```

   * PM2 will auto-restart on crashes. On reboot, ensure PM2 resurrects saved processes (use `pm2 startup`).
5. **Verify**:

   ```bash
   pm2 logs orientation-feedback
   # Look for "Server listening on port 4000"
   ```

---

### 9. Nginx Reverse Proxy & HTTPS

1. **Install Nginx** if not already:

   ```bash
   sudo apt update
   sudo apt install nginx
   ```
2. **Configure Nginx**: create `/etc/nginx/sites-available/orientation-feedback`:

   ```nginx
   server {
     listen 80;
     server_name feedback.yourdomain.com;

     location / {
       proxy_pass http://127.0.0.1:4000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
     }
   }
   ```
3. **Enable config**:

   ```bash
   sudo ln -s /etc/nginx/sites-available/orientation-feedback /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```
4. **Obtain SSL certificate** with Certbot:

   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d feedback.yourdomain.com
   ```

   * Follow prompts; Certbot updates Nginx to listen on 443.
5. **Verify HTTPS**: open `https://feedback.yourdomain.com/orientation-feedback` (POST endpoint; GET returns 404 or method not allowed). Use curl:

   ```bash
   curl -X POST https://feedback.yourdomain.com/orientation-feedback \
     -H "Content-Type: application/json" \
     -d '{"grader":"Test","weekLabel":"Week 1 (Remote)","weekDay":"Mon","items":[{"name":"Jody Bender","effort":3,"comprehension":2,"clientApp":1,"feedback":"Test feedback"}]}'
   ```

---

### 10. HTML Form Integration

In your HTML (hosted on GitHub Live or elsewhere), set:

```js
const HOOK = "https://feedback.yourdomain.com/orientation-feedback";
```

Ensure CORS is allowed (`Access-Control-Allow-Origin: *` or restrict origin).

The form’s JS already POSTs JSON with:

```js
const payload = { grader, weekLabel, weekDay, items };
await fetch(HOOK, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
```

---

### 11. Testing & Debugging

* **Local test**: You can run the server locally (`npm run dev` or `node index.js`), send POST via curl or Postman to `http://localhost:4000/orientation-feedback`.
* **Check logs**: `pm2 logs orientation-feedback` on VPS. Inspect mapping errors (unknown weekDay/weekLabel/orientee). Adjust static maps or ensure ClickUp dropdown options match exactly.
* **Inspect ClickUp**: After successful runs, verify tasks created with correct custom fields.
* **Edge cases**:

  * If orientee name mismatch: service returns error in results; decide whether to auto-create or notify.
  * If ClickUp rate limits: for high volume, implement throttling or batch with delays.

---

### 12. Optional: Auto-create Oriente Dropdown Options

In `utils/clickup-client.js`, add:

```js
async function createOrienteeOption(name) {
  const url = `https://api.clickup.com/api/v2/field/${ORIENTEE_FIELD_ID}/option`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  const body = await resp.json();
  if (!resp.ok) throw new Error(`Create option failed: ${resp.status} ${JSON.stringify(body)}`);
  // Invalidate cache
  cachedOrienteeOptions = null;
  cacheTs = 0;
  return body.id;
}
```

In the loop in `index.js`:

```js
let orienteeID = await mapOrienteeNameToID(orienteeName);
if (!orienteeID) {
  // auto-create new option
  orienteeID = await createOrienteeOption(orienteeName);
}
```

This ensures new names are auto-added to ClickUp dropdown.

---

### 13. Dockerization (Optional)

If you prefer Docker like your other services:

* **Dockerfile**:

  ```dockerfile
  FROM node:18-alpine
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  ENV PORT=4000
  EXPOSE 4000
  CMD ["node", "index.js"]
  ```
* Build & Run:

  ```bash
  docker build -t orientation-feedback .
  docker run -d --name orientation-feedback \
    --env-file .env -p 4000:4000 orientation-feedback
  ```
* Point Nginx to `http://127.0.0.1:4000`.

---

### 14. Process Manager & Auto-Restart

* **PM2**: `pm2 start index.js --name orientation-feedback`; `pm2 save`; `pm2 startup`.
* **systemd**: Alternatively create a service file:

  ```ini
  [Unit]
  Description=Orientation Feedback Service
  After=network.target

  [Service]
  EnvironmentFile=/home/username/orientation-feedback/.env
  WorkingDirectory=/home/username/orientation-feedback
  ExecStart=/usr/bin/node index.js
  Restart=always
  User=youruser

  [Install]
  WantedBy=multi-user.target
  ```

  Then `sudo systemctl enable orientation-feedback`, `sudo systemctl start orientation-feedback`.

---

### 15. Security & Maintenance

* **Keep Node.js updated** on VPS. Use nvm or package manager.
* **Secure environment**: don’t commit `.env`; restrict file permissions.
* **Firewall**: allow only ports 80/443 and SSH.
* **Monitoring**: use PM2 logs, or external logging if needed.
* **Backup**: if caching persisted externally, backup that store.
* **Revoking token**: if token is compromised, update env and restart.

---

### 16. Summary for IDE LLM Prompt

When instructing your IDE’s LLM, provide:

* Purpose: "Implement a Node.js/Express service on a VPS to receive orientation feedback, map values, and create ClickUp tasks."
* Environment: VPS with Node.js, Nginx reverse proxy, environment variables for IDs and token.
* ClickUp details: Team ID `2387134`; field IDs: Oriente `fdd1f582-d61c-47ac-920d-72a1f0107d7e`, Week Day `b6766eaf-58b0-46a7-ad5a-031d984c88f`, Week Label `9e27e1a7-b935-4274-839a-c18ca8d72b61`, numeric fields `9dafe855-0d64-4f6b-b66d-322e584e1316`, `92275dfb-6ce2-418e-a8cd-0f74be70ddf7`, `aab90257-fe00-4f08-89d6-d738277d1cb9`, etc.
* Code structure: `utils/clickup-maps.js`, `utils/clickup-client.js`, `index.js` Express server with CORS, mapping logic, caching, error handling.
* Deployment: PM2/systemd, Nginx proxy, Let’s Encrypt.
* HTML integration: set webhook URL to `https://feedback.yourdomain.com/orientation-feedback`.
* Optional: Docker, auto-create dropdown options, Data Store caching if high volume.
* Testing: curl examples and verifying ClickUp tasks.

Use this Markdown as the basis for your IDE LLM prompt to generate or review code.

