const { clickupLessonReader } = require('../services/clickup-lesson-reader');
const { getLessons, replaceLessons } = require('../services/class-lesson-store');

const className = process.argv[2];
if (!className) {
  console.error('Usage: node scripts/sync-class-times "PD OTN 07.08.24"');
  process.exit(1);
}

(async () => {
  try {
    console.log(`🔄 Syncing timing for class: ${className}`);

    // Fetch live lessons (already merged with template times via reader)
    const liveData = await clickupLessonReader.getLiveClassLessons(className);
    const liveLessons = liveData.lessons;

    // Fetch existing DB copy (has template times)
    const dbLessons = getLessons(className);
    const tplMap = Object.fromEntries(dbLessons.map(l => [l.name.toLowerCase(), l]));

    // Merge times into live lessons; keep everything else from live
    const merged = liveLessons.map(live => {
      const tpl = tplMap[live.name.toLowerCase()] || {};
      return {
        ...live,
        startTime: live.startTime || tpl.startTime || null,
        endTime: live.endTime || tpl.endTime || null,
        week: (!live.week || live.week === 'Unknown') && tpl.week ? tpl.week : live.week,
      };
    });

    replaceLessons(className, merged);
    console.log(`✅ Updated ${merged.length} lessons in DB for ${className}`);
  } catch (err) {
    console.error('💥 Sync failed:', err.message);
    process.exit(1);
  }
})(); 