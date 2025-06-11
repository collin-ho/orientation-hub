const express = require('express');
require('dotenv').config();
const { weekDayMap, weekLabelMap } = require('./utils/clickup-maps');
const { mapOrienteeNameToID, createClickUpTask } = require('./utils/clickup-client');
const { fetchOrienteeOptions } = require('./utils/clickup-client');

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

// Endpoint to get current orientees from ClickUp
app.get('/orientees', async (req, res) => {
  try {
    const options = await fetchOrienteeOptions();
    res.json(options);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
