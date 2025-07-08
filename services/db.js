const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const dbPath = path.join(dataDir, 'orientation.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

// Initial schema (idempotent)
db.prepare(`CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  week TEXT NOT NULL,
  weekDay TEXT NOT NULL,
  dayOffset INTEGER NOT NULL,
  startTime TEXT,
  endTime TEXT,
  subject TEXT,
  leads TEXT,
  isActive INTEGER DEFAULT 1,
  clickup_task_id TEXT
)`).run();

// Instructors table (id string primary key because ClickUp IDs are numeric strings)
db.prepare(`CREATE TABLE IF NOT EXISTS instructors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT,
  status TEXT
)`).run();

// Sync log
db.prepare(`CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER,
  action TEXT,
  status TEXT,
  message TEXT,
  ts DATETIME DEFAULT CURRENT_TIMESTAMP
)`).run();

// Classes table to map class name to schedule list id
db.prepare(`CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_name TEXT UNIQUE,
  folder_id TEXT,
  schedule_list_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`).run();

// Class lessons table
db.prepare(`CREATE TABLE IF NOT EXISTS class_lessons (
  class_name TEXT NOT NULL,
  lesson_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  week TEXT,
  weekDay TEXT,
  dayOffset INTEGER,
  startTime TEXT,
  endTime TEXT,
  subject TEXT,
  leads TEXT,
  isActive INTEGER DEFAULT 1,
  clickup_task_id TEXT,
  PRIMARY KEY (class_name, lesson_id)
)`).run();

// Feedback table (stores daily feedback & homework grades locally)
db.prepare(`CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_name TEXT,
  orientee_name TEXT,
  grader TEXT,
  week_label TEXT,
  week_day TEXT,
  effort REAL,
  comprehension REAL,
  client_app REAL,
  comments TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`).run();

module.exports = db; 