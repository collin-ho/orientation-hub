const fs = require('fs');
const path = require('path');

// ---------- CONSTANTS (mirrored from build-schedule-html.js) -----------------
const PX_PER_MIN = 1.5;
const NEUTRAL_COLUMN_BG = '#1a1a1a';
const NEUTRAL_LESSON_BG = '#222222';
const NEUTRAL_HEADER_BG = '#242424';
const DAY_START = 8 * 60;
const DAY_END = 18 * 60;
const TAILWIND_CDN = '<script src="https://cdn.tailwindcss.com"></script>';

const SUBJECT_COLOURS = {
  'Vision, Mission, and Values': '#f59e0b',
  People: '#ec4899',
  'Project Management': '#3b82f6',
  Discovery: '#10b981',
  Measurement: '#8b5cf6',
  'Client Alignment & Project Control': '#f43f5e',
  'Brand MTKG': '#14b8a6',
  Process: '#eab308',
  'Professional Services': '#a855f7',
  LifeCycle: '#0ea5e9',
};

function minutesSinceMidnight(time) {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
function timeLabel(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m.toString().padStart(2, '0')} ${ampm}`;
}
function formatTime12(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function renderDayColumn(dayName, lessons) {
  const columnContentHeight = (DAY_END - DAY_START) * PX_PER_MIN;
  const headerHeight = 28;
  const lessonsHtml = lessons
    .map((lesson) => {
      const start = minutesSinceMidnight(lesson.startTime || '08:00');
      let end = minutesSinceMidnight(lesson.endTime || lesson.startTime || '09:00');
      end = Math.min(end, DAY_END);
      if (end <= start) return '';
      const top = (start - DAY_START) * PX_PER_MIN;
      const height = (end - start) * PX_PER_MIN;
      const colour = SUBJECT_COLOURS[lesson.subject] || '#6b7280';
      const initials = (lesson.leads && lesson.leads.length ? lesson.leads[0] : '')
        .split(' ')
        .map((p) => p[0])
        .join('');
      const subjectTag = lesson.subject
        ? `<span class="text-[0.6rem] font-semibold px-1 rounded-sm truncate max-w-[140px]" style="background:${colour}26;color:${colour}">${lesson.subject}</span>`
        : '';
      return `<div class="absolute lesson text-white text-[0.95rem] overflow-hidden" style="top:${top}px;height:${height}px;left:0;right:0;padding:4px 6px;background:${NEUTRAL_LESSON_BG};box-shadow:inset 0 0 0 2px ${colour};">
        <div class="text-[0.625rem] text-gray-300">${formatTime12(lesson.startTime)} - ${formatTime12(lesson.endTime)}</div>
        <div class="flex items-center justify-between space-x-2">
          <span class="font-medium text-[0.85rem] truncate leading-tight">${lesson.name}</span>
          <span class="text-[0.625rem] text-gray-400">${initials}</span>
        </div>
        ${subjectTag}
      </div>`;
    })
    .join('');
  return `<div class="flex flex-col" style="height:${columnContentHeight + headerHeight}px;">
      <div class="flex items-center justify-center text-white font-semibold" style="height:${headerHeight}px;background:${NEUTRAL_HEADER_BG};border-bottom:1px solid #333;">${dayName}</div>
      <div class="relative flex-1 hour-grid" style="background:${NEUTRAL_COLUMN_BG};background-image:repeating-linear-gradient(to bottom,#3a3a3a 0,#3a3a3a 1px,transparent 1px,transparent ${60*PX_PER_MIN}px);">
        <div class="absolute inset-0">${lessonsHtml}</div>
      </div>
    </div>`;
}

function buildHTML(lessons) {
  // Group by week & sort days
  const weeks = {};
  lessons.forEach((l) => {
    if (!weeks[l.week]) weeks[l.week] = { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [] };
    weeks[l.week][l.weekDay].push(l);
  });

  let weekSections = '';
  for (const [weekName, days] of Object.entries(weeks)) {
    Object.values(days).forEach((arr) => arr.sort((a, b) => minutesSinceMidnight(a.startTime || '08:00') - minutesSinceMidnight(b.startTime || '08:00')));

    const legend = Object.entries(SUBJECT_COLOURS)
      .map(([sub, col]) => `<div class="flex items-center space-x-2 text-xs text-gray-200"><span class="w-3 h-3" style="background:${col}"></span><span>${sub}</span></div>`)
      .join('');

    weekSections += `<section class="mb-16"><header class="mb-4 flex justify-between items-center"><h2 class="text-xl font-semibold text-white">${weekName}</h2><div class="flex flex-wrap gap-4">${legend}</div></header><div class="flex"><div class="flex flex-col pr-4 text-right text-gray-400 text-xs" style="width:50px;">${Array.from({length:(DAY_END-DAY_START)/60+1}).map((_,i)=>`<div style="height:${60*PX_PER_MIN}px;">${timeLabel(DAY_START+i*60)}</div>`).join('')}</div><div class="grid flex-1" style="grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;">${['Mon','Tue','Wed','Thu','Fri'].map(d=>renderDayColumn(d,days[d]||[])).join('')}</div></div></section>`;
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Orientation Schedule</title>${TAILWIND_CDN}<style>::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#475569;border-radius:3px}.lesson{line-height:1.1}.hour-grid{}</style></head><body class="bg-[#121212] p-8">${weekSections}</body></html>`;
}

function saveHtmlToFile(html, outPath){
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, 'utf-8');
}

module.exports = { buildHTML, saveHtmlToFile }; 