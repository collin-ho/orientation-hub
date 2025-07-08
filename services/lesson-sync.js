const USE_CLICKUP = process.env.USE_CLICKUP === 'true';
if (!USE_CLICKUP) {
  console.log('🔄 lesson-sync: ClickUp disabled – stubbed module loaded');
  async function syncLessons() {
    return { created: 0, updated: 0, errors: 0, message: 'ClickUp disabled' };
  }
  async function linkExistingTasks() {
    return { linked: 0, notFound: 0, error: 'ClickUp disabled' };
  }
  module.exports = { syncLessons, linkExistingTasks };
  return; // Exit before loading ClickUp-dependent code below
}

const { getAllLessons, setTaskId } = require('./lesson-store');
const { getLessons: getClassLessons, setTaskId: setClassTaskId } = require('./class-lesson-store');
const {
  getTasks,
  getTask,
  createTask,
  getCustomFields,
  rateLimitedFetch
} = require('../utils/clickup-client');
const db = require('./db');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { getClassByName } = require('./class-store');
const { weekLabelMap, weekDayMap, subjectMap, CUSTOM_FIELD_IDS } = require('../utils/clickup-maps');

const LIST_ID = process.env.CLICKUP_LIST_ID || process.env.CLICKUP_SCHEDULE_LIST_ID;
if (!LIST_ID) {
  console.warn('⚠️  CLICKUP_LIST_ID not set. Lesson sync will be disabled.');
}

// Cache for Leads custom field ID per list
const leadsFieldCache = new Map();

async function getLeadsFieldId(listId){
  if(!listId) return null;
  if(leadsFieldCache.has(listId)) return leadsFieldCache.get(listId);
  try{
    const fields = await getCustomFields(listId);
    const leadField = fields.find(f => f.type === 'users' && f.name.toLowerCase().includes('lead'));
    const fieldId = leadField ? leadField.id : null;
    if(fieldId) leadsFieldCache.set(listId, fieldId);
    return fieldId;
  }catch(err){
    console.warn('⚠️  Could not auto-detect Leads field:', err.message);
    return null;
  }
}

function logSync(lessonId, action, status, message=''){
  db.prepare('INSERT INTO sync_log (lesson_id, action, status, message) VALUES (?,?,?,?)')
    .run(lessonId, action, status, message);
}

function logDebug(...args){
  if(process.env.DEBUG_SYNC){
    console.log('[lesson-sync]', ...args);
  }
}

function buildCustomFieldsForLesson(lesson){
  const custom = [];
  // Week number
  const weekVal = weekLabelMap[lesson.week];
  if(weekVal){
    custom.push({ id: CUSTOM_FIELD_IDS.SCHEDULE.WEEK_NUM, value: weekVal });
  }
  // Week day
  const dayVal = weekDayMap[lesson.weekDay];
  if(dayVal){
    custom.push({ id: CUSTOM_FIELD_IDS.SCHEDULE.WEEK_DAY, value: dayVal });
  }
  // Subject
  if(lesson.subject && subjectMap[lesson.subject]){
    custom.push({ id: CUSTOM_FIELD_IDS.SCHEDULE.SUBJECT, value: subjectMap[lesson.subject] });
  }
  return custom;
}

async function syncLessons(className=null) {
  let targetListId = LIST_ID;
  if (className) {
    const cls = getClassByName(className);
    if (!cls) return { created:0, updated:0, errors:1, message:'Class not found' };
    targetListId = cls.schedule_list_id;
  }
  if (!targetListId) return { created:0, updated:0, errors:1, message:'LIST_ID missing' };
  const lessons = className ? getClassLessons(className) : getAllLessons();
  let created=0, updated=0, errors=0;
  logDebug('🔄 Starting lesson sync', {total: lessons.length, targetListId});
  for (const lesson of lessons) {
    logDebug('➡️ Processing lesson', {id:lesson.id, name:lesson.name, hasTask:!!lesson.clickup_task_id});
    try {
      if (!lesson.clickup_task_id) {
        // Build task payload
        const taskPayload = {
          name: lesson.name,
          description: `${lesson.week} ${lesson.weekDay} Day${lesson.dayOffset+1}`,
          custom_fields: buildCustomFieldsForLesson(lesson)
        };

        // Add leads on creation if possible
        const leadsFieldId = await getLeadsFieldId(targetListId);
        if(leadsFieldId && lesson.leads && lesson.leads.length){
          const { getAllInstructors } = require('./instructor-store');
          const instrMap = Object.fromEntries(getAllInstructors().map(u=>[u.name,u.id]));
          const leadIds = lesson.leads.map(n=>instrMap[n]).filter(Boolean).map(String);
          if(leadIds.length){
            taskPayload.custom_fields.push({ id: leadsFieldId, value: leadIds });
          }
        }

        const task = await createTask(targetListId, taskPayload);
        if(className){
          setClassTaskId(className, lesson.id, task.id);
        }else{
          setTaskId(lesson.id, task.id);
        }
        created++;
        logSync(lesson.id,'create','success',`task ${task.id}`);
        await sleep(700); // rate limit buffer (~85 rpm)
      } else {
        // Auto-detect Leads field ID for this list (cached)
        const leadsFieldId = await getLeadsFieldId(targetListId);

        // compare and update if name, description, or leads differ
        const task = await getTask(lesson.clickup_task_id);
        let needUpdate=false;
        const payload={};
        if(task.name!==lesson.name){
          payload.name=lesson.name; needUpdate=true; }

        // description
        const newDesc = `${lesson.week} ${lesson.weekDay} Day${lesson.dayOffset+1}`;
        if((task.description||'').trim() !== newDesc.trim()){
          payload.description = newDesc; needUpdate=true;
        }

        // compare leads
        const { getAllInstructors } = require('./instructor-store');
        const instrMap = Object.fromEntries(getAllInstructors().map(u=>[u.name,u.id]));
        const desiredLeadIds = (lesson.leads||[]).map(n=>instrMap[n]).filter(Boolean).map(String).sort();
        const taskLeadIds = (task.custom_fields||[]).find(f=>f.id===leadsFieldId)?.value||[];
        const sortedTaskLead = Array.isArray(taskLeadIds)?[...taskLeadIds].sort():[];
        let leadUpdated = false;
        if(desiredLeadIds.length>0 && leadsFieldId && JSON.stringify(desiredLeadIds)!==JSON.stringify(sortedTaskLead)){
          // Use dedicated endpoint for users-type field
          try{
            await rateLimitedFetch(`https://api.clickup.com/api/v2/task/${lesson.clickup_task_id}/field/${leadsFieldId}`,{
              method:'POST',
              headers:{ 'Authorization':process.env.CLICKUP_TOKEN,'Content-Type':'application/json' },
              body: JSON.stringify({ value: { add: desiredLeadIds, rem: [] } })
            });
          }catch(postErr){
            logDebug('❌ Lead field update failed', {taskId:lesson.clickup_task_id, field:leadsFieldId, payload:{add:desiredLeadIds}, err:postErr.message});
            throw postErr;
          }
          leadUpdated = true;
          await sleep(700);
        }
        logDebug('↪︎ Sync leads', {taskId: lesson.clickup_task_id, leadsFieldId, desiredLeadIds, current: sortedTaskLead});

        // -------------------------
        // Sync dropdown fields (Week #, Week Day, Subject)
        // -------------------------
        const dropdownTargets=[
          { id:CUSTOM_FIELD_IDS.SCHEDULE.WEEK_NUM, desired: weekLabelMap[lesson.week] },
          { id:CUSTOM_FIELD_IDS.SCHEDULE.WEEK_DAY, desired: weekDayMap[lesson.weekDay] },
          { id:CUSTOM_FIELD_IDS.SCHEDULE.SUBJECT,   desired: lesson.subject?subjectMap[lesson.subject]:null }
        ];
        for(const fld of dropdownTargets){
          if(!fld.desired) continue;
          const currentVal = (task.custom_fields||[]).find(f=>f.id===fld.id)?.value;
          if(currentVal!==fld.desired){
            try{
              await rateLimitedFetch(`https://api.clickup.com/api/v2/task/${lesson.clickup_task_id}/field/${fld.id}`,{
                method:'POST',
                headers:{ 'Authorization':process.env.CLICKUP_TOKEN,'Content-Type':'application/json' },
                body: JSON.stringify({ value: fld.desired })
              });
              await sleep(700);
            }catch(dropErr){
              logDebug('❌ Dropdown field update failed',{taskId:lesson.clickup_task_id, field:fld.id, desired:fld.desired, err:dropErr.message});
              throw dropErr;
            }
            needUpdate=true; // Count as update
          }
        }

        // Always include custom field updates (week/day/subject)
        const customFieldsUpd = buildCustomFieldsForLesson(lesson);
        if(customFieldsUpd.length){
          payload.custom_fields = customFieldsUpd;
        }

        if(Object.keys(payload).length>0){
          await rateLimitedFetch(`https://api.clickup.com/api/v2/task/${lesson.clickup_task_id}`,{
            method:'PUT',
            headers:{ 'Authorization':process.env.CLICKUP_TOKEN,'Content-Type':'application/json' },
            body:JSON.stringify(payload)
          });
          await sleep(700);
        }

        if(needUpdate || leadUpdated){
          updated++;
          logSync(lesson.id,'update','success','');
        }
      }
    } catch(err){
      logDebug('❌ Sync error', {lesson:lesson.name, id:lesson.id, err:err.message, stack:err.stack});
      errors++;
      console.error('Lesson sync error', lesson.name, err.message);
      logSync(lesson.id,'create','error',err.message);
    }
  }
  return { created, updated, errors };
}

async function linkExistingTasks(className){
  const cls=getClassByName(className);
  if(!cls) return {linked:0,notFound:0,error:'Class not found'};
  const tasks=await getTasks(cls.schedule_list_id);
  const taskMap=new Map();
  tasks.forEach(t=> taskMap.set(t.name.trim().toLowerCase(), t));
  const lessons=getAllLessons();
  let linked=0, notFound=0;
  lessons.forEach(l=>{
    if(l.clickup_task_id) return; // already linked
    const match=taskMap.get(l.name.trim().toLowerCase());
    if(match){
      if(className){
        setClassTaskId(className, l.id, match.id);
      }else{
        setTaskId(l.id, match.id);
      }
      linked++;
      logSync(l.id,'link','success',`task ${match.id}`);
    } else {
      notFound++;
    }
  });
  return {linked,notFound};
}

module.exports = { syncLessons, linkExistingTasks }; 