const fs = require('fs');
const path = require('path');

// ---------- CONFIG ---------------------------------------------------------
const LESSON_FILE = path.join(__dirname, '..', 'config', 'lesson-templates.json');
const OUTPUT_DIR = path.join(__dirname, '..', 'client', 'public', 'embed');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'orientation-schedule.html');

// Tailwind CDN – inline script keeps the file fully self-contained
const TAILWIND_CDN =
  '<script src="https://cdn.tailwindcss.com"></script>'; // no integrity needed for internal use

// Pixel height for a single minute – controls vertical scale (tighter)
const PX_PER_MIN = 1.5; // 1 h = 90 px • full day (8 AM–6 PM) = 900 px

// Neutral greys for columns and lesson bodies
const NEUTRAL_COLUMN_BG = '#1a1a1a';
const NEUTRAL_LESSON_BG = '#222222';

// Background for column headers
const NEUTRAL_HEADER_BG = '#242424';

const DAY_START = 8 * 60; // 8 AM in minutes since 00:00
const DAY_END = 18 * 60; // 6 PM

// Subject → accent colour map (Tailwind palette values)
/** @type {Record<string, string>} */
const SUBJECT_COLOURS = {
  'Vision, Mission, and Values': '#f59e0b', // amber-500
  People: '#ec4899', // pink-500
  'Project Management': '#3b82f6', // blue-500
  Discovery: '#10b981', // green-500
  Measurement: '#8b5cf6', // violet-500
  'Client Alignment & Project Control': '#f43f5e', // rose-500
  Brand: '#14b8a6', // teal-500 (catch-all)
  Process: '#eab308', // yellow-500
  'Professional Services': '#a855f7', // purple-500
  LifeCycle: '#0ea5e9', // sky-500
};

function loadLessons() {
  const raw = fs.readFileSync(LESSON_FILE, 'utf-8');
  const json = JSON.parse(raw);
  return json.lessons.filter((l) => l.isActive !== false);
}

function minutesSinceMidnight(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function timeLabel(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = ((h + 11) % 12) + 1; // convert 0-23 → 1-12
  return `${hh}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatTime12(time24) {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function buildHTML(lessons) {
  // Group by week then by weekday
  const weeks = {};
  for (const lesson of lessons) {
    if (!weeks[lesson.week]) weeks[lesson.week] = { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [] };
    weeks[lesson.week][lesson.weekDay].push(lesson);
  }

  let weekSections = '';
  for (const [weekName, days] of Object.entries(weeks)) {
    // Sort lessons inside each day by startTime
    for (const day of Object.keys(days)) {
      days[day].sort((a, b) => minutesSinceMidnight(a.startTime) - minutesSinceMidnight(b.startTime));
    }

    const legend = Object.entries(SUBJECT_COLOURS)
      .map(
        ([subject, colour]) =>
          `<div class="flex items-center space-x-2 text-xs text-gray-200"><span class="w-3 h-3" style="background:${colour}"></span><span>${subject}</span></div>`
      )
      .join('');

    weekSections += `
      <section class="mb-16">
        <header class="mb-4 flex justify-between items-center">
          <h2 class="text-xl font-semibold text-white">${weekName}</h2>
          <div class="flex flex-wrap gap-4">${legend}</div>
        </header>
        <div class="flex">
          <!-- Time ruler -->
          <div class="flex flex-col pr-4 text-right text-gray-400 text-xs" style="width:50px;">
            ${Array.from({ length: (DAY_END - DAY_START) / 60 + 1 })
              .map((_, idx) => {
                const minute = DAY_START + idx * 60;
                return `<div style="height:${60 * PX_PER_MIN}px;">${timeLabel(minute)}</div>`;
              })
              .join('')}
          </div>
          <!-- Day columns -->
          <div class="grid flex-1" style="grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px;">
            ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
              .map((day) => renderDayColumn(day, days[day] || []))
              .join('')}
          </div>
        </div>
      </section>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Orientation Schedule</title>
  ${TAILWIND_CDN}
  <style>
    /* Custom scrollbar for WebKit */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
    .lesson { line-height: 1.1; }
    /* Hour grid line helper */
    .hour-grid {
      background-image: repeating-linear-gradient(to bottom, #3a3a3a 0, #3a3a3a 1px, transparent 1px, transparent ${60 * PX_PER_MIN}px);
    }
  </style>
</head>
<body class="bg-[#121212] p-8">
  ${weekSections}
</body>
</html>`;
}

function renderDayColumn(dayName, lessons) {
  const columnContentHeight = (DAY_END - DAY_START) * PX_PER_MIN;

  const lessonsHtml = lessons
    .map((lesson) => {
      const start = minutesSinceMidnight(lesson.startTime);
      let end = minutesSinceMidnight(lesson.endTime);
      // Clip at 6 PM
      end = Math.min(end, DAY_END);

      if (end <= start) return ''; // ignore if lesson ends before it starts (after clipping)

      const top = (start - DAY_START) * PX_PER_MIN;
      const height = (end - start) * PX_PER_MIN;

      const colour = SUBJECT_COLOURS[lesson.subject] || '#6b7280';
      const initials = (lesson.leads && lesson.leads.length ? lesson.leads[0] : '')
        .split(' ')
        .map((p) => p[0])
        .join('');

      let subjectLabel = lesson.subject || '';
      const durationMin = end - start;
      const isCompact = durationMin <= 45; // 30-min slots

      const subjectTag = subjectLabel
        ? `<span class="text-[0.6rem] font-semibold px-1 rounded-sm truncate max-w-[140px]" style="background:${colour}26;color:${colour}">${subjectLabel}</span>`
        : '';

      const infoRow = `<div class="flex items-center justify-between space-x-2">
          <span class="font-medium text-[0.85rem] truncate leading-tight">${lesson.name}</span>
          <span class="text-[0.625rem] text-gray-400">${initials}</span>
        </div>`;

      const tagPlacement = `
        ${infoRow}
        <div class="flex items-center justify-between">
          ${subjectTag}
          ${isCompact ? `<span class=\"text-[0.625rem] text-gray-400\">${initials}</span>` : ''}
        </div>`;

      const finalContent = isCompact
        ? // two-line layout: time, title row with initials, tag row with initials repeated?
          `<div class="flex items-center justify-between space-x-2">
             <span class="font-medium text-[0.85rem] truncate leading-tight">${lesson.name}</span>
             <span class="text-[0.625rem] text-gray-400">${initials}</span>
           </div>
           <div class="flex items-center justify-between">
             ${subjectTag}
             <!-- keep space for alignment -->
           </div>`
        : tagPlacement;

      return `<div class="absolute lesson text-white text-[0.95rem] overflow-hidden" style="top:${top}px;height:${height}px;left:0;right:0;padding:4px 6px;background:${NEUTRAL_LESSON_BG};box-shadow:inset 0 0 0 2px ${colour};">
        <div class="text-[0.625rem] text-gray-300">${formatTime12(lesson.startTime)} - ${formatTime12(lesson.endTime)}</div>
        ${finalContent}
      </div>`;
    })
    .join('');

  const headerHeight = 28;
  return `
    <div class="flex flex-col" style="height:${columnContentHeight + headerHeight}px;">
      <div class="flex items-center justify-center text-white font-semibold" style="height:${headerHeight}px;background:${NEUTRAL_HEADER_BG};border-bottom:1px solid #333;">${dayName}</div>
      <div class="relative flex-1 hour-grid" style="background:${NEUTRAL_COLUMN_BG};">
        <div class="absolute inset-0">
          ${lessonsHtml}
        </div>
      </div>
    </div>
  `;
}

function main() {
  const lessons = loadLessons();
  const html = buildHTML(lessons);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, html, 'utf-8');
  console.log(`✅ Schedule HTML generated: ${OUTPUT_FILE}`);
}

if (require.main === module) {
  main();
} 