const { getSpaceFolders, getFolderLists, getTasks, getTask, getListFields } = require('../utils/clickup-client');
const { CUSTOM_FIELD_IDS } = require('../utils/clickup-maps');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// ClickUp spaces that may contain orientation class folders.
// 1. 1100: Workshop (current default)
// 2. 1000: Sandbox   (legacy classes created before space migration)
const SPACE_IDS = ['14869535', '16835428'];

// Convenience constant – first space is considered the *primary* (creation target).
const PRIMARY_SPACE_ID = SPACE_IDS[0];

// This service will be responsible for generating the PDF report.
// It will fetch data from ClickUp, populate an HTML template, and use Puppeteer to render it.

/**
 * Finds the correct list IDs for a given orientation class folder within the Workshop space.
 * @param {string} folderName The name of the folder (e.g., "PD OTN 2024-10-28")
 * @returns {Promise<object|null>} An object mapping list names to IDs, or null if not found.
 */
async function findListIdsForClass(folderName) {
  // Try each known space in order until the folder is found
  for (const spaceId of SPACE_IDS) {
    try {
      const folders = await getSpaceFolders(spaceId);
      const folder = folders.find(
        (f) => f.name.trim().toLowerCase() === folderName.trim().toLowerCase()
      );

      if (!folder) {
        // Not in this space – try the next one
        continue;
      }

      const lists = await getFolderLists(folder.id);
      if (!lists || lists.length === 0) {
        console.warn(`No lists found in folder "${folderName}" (space ${spaceId})`);
        continue;
      }

      // Map the found lists by their names
      const listIdMap = {
        classDetails: lists.find((l) => l.name === 'Class Details')?.id,
        schedule: lists.find((l) => l.name === 'Schedule')?.id,
        feedbackGrades: lists.find((l) => l.name === 'Feedback & Grades')?.id,
      };

      if (Object.values(listIdMap).some((id) => !id)) {
        console.warn(
          `Could not find one or more required lists in folder "${folderName}" (space ${spaceId}). Found:`,
          listIdMap
        );
      }

      return listIdMap; // Return as soon as we have a match (even if some lists missing)
    } catch (err) {
      console.error(`Error searching for folder in space ${spaceId}:`, err.message);
    }
  }

  console.error(`Could not find a folder named "${folderName}" in any known spaces (${SPACE_IDS.join(', ')}).`);
  return null;
}

/**
 * Processes the raw task data from ClickUp into a structured format for the report.
 * @param {object} tasksByList An object containing the raw task arrays for each list.
 * @returns {object} A structured object with the data needed for the template.
 */
function processTaskData(tasksByList, className) {
    const reportData = {
        className: className,
        classDetails: [],
        schedule: [],
        feedbackGrades: [],
    };

    const getCustomFieldValue = (taskCustomFields, fieldId) => {
        const field = taskCustomFields.find(f => f.id === fieldId);
        if (!field) return 'N/A';

        const { type, type_config, value } = field;

        if (value === undefined || value === null) {
            return field.value || 'N/A';
        }
        
        if (type === 'drop_down') {
            const options = type_config?.options || [];
            if (typeof value === 'number') { // This is an orderindex
                const option = options.find(o => o.orderindex === value);
                return option?.name || `Invalid index: ${value}`;
            }
            if (typeof value === 'string') { // This is an option ID
                const option = options.find(o => o.id === value);
                return option?.name || `Invalid ID: ${value}`;
            }
             // Sometimes the value from the task is an array with one ID.
            if (Array.isArray(value) && value.length > 0) {
                const option = options.find(o => o.id === value[0]);
                return option?.name || 'N/A';
            }
            return 'N/A';
        }

        if (type === 'labels') {
            const options = type_config?.options || [];
            if (Array.isArray(value)) {
                return value.map(id => {
                    const option = options.find(o => o.id === id);
                    return option?.label || '';
                }).filter(l => l).join(', ');
            }
            return 'N/A';
        }

        if (field.value) {
            // For text fields, the value can sometimes be a JSON string with ops, clean it up.
            try {
                const parsed = JSON.parse(field.value);
                if (parsed && Array.isArray(parsed.ops)) {
                    return parsed.ops.map(op => op.insert).join('').trim();
                }
            } catch (e) {
                // Not a JSON string, return as is.
            }
            return field.value;
        }
        
        if (typeof value === 'object' && value !== null) {
            return 'N/A'; // Or handle objects if needed
        }

        return String(value);
    };

    if (tasksByList.classDetailsTasks) {
        tasksByList.classDetailsTasks.forEach(task => {
            const imageAttachment = task.attachments?.find(att => 
                att.extension && ['png', 'jpg', 'jpeg', 'gif'].includes(att.extension.toLowerCase())
            );

            // Normalize status to proper case to match the statusOrder array
            const rawStatus = task.status?.status || 'Unknown';
            const normalizedStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();
            
            reportData.classDetails.push({
                name: task.name,
                status: normalizedStatus, // Normalized status (e.g., "graduated" -> "Graduated")
                pdOrientee: getCustomFieldValue(task.custom_fields, CUSTOM_FIELD_IDS.CLASS_DETAILS.PD_ORIENTEE), // Add PD Orientee field
                pillar: getCustomFieldValue(task.custom_fields, CUSTOM_FIELD_IDS.CLASS_DETAILS.PILLAR),
                market: getCustomFieldValue(task.custom_fields, CUSTOM_FIELD_IDS.CLASS_DETAILS.MARKET),
                imageUrl: imageAttachment?.url,
                wk1Feedback: getCustomFieldValue(task.custom_fields, CUSTOM_FIELD_IDS.CLASS_DETAILS.WK_1_FEEDBACK),
                wk2Feedback: getCustomFieldValue(task.custom_fields, CUSTOM_FIELD_IDS.CLASS_DETAILS.WK_2_FEEDBACK),
                personalityTag: getCustomFieldValue(task.custom_fields, CUSTOM_FIELD_IDS.CLASS_DETAILS.PERSONALITY_TAG),
                cogentEmail: getCustomFieldValue(task.custom_fields, CUSTOM_FIELD_IDS.CLASS_DETAILS.COGENT_EMAIL),
                linkedin: getCustomFieldValue(task.custom_fields, CUSTOM_FIELD_IDS.CLASS_DETAILS.LINKEDIN_PROFILE),
            });
        });
    }

    if (tasksByList.scheduleTasks) {
        tasksByList.scheduleTasks.forEach(task => {
            reportData.schedule.push({
                name: task.name,
                subject: getCustomFieldValue(task.custom_fields, CUSTOM_FIELD_IDS.SCHEDULE.SUBJECT),
                weekDay: getCustomFieldValue(task.custom_fields, CUSTOM_FIELD_IDS.SCHEDULE.WEEK_DAY),
                lead: task.assignees?.map(a => a.username).join(', ') || 'N/A',
            });
        });
    }

    if (tasksByList.feedbackGradesTasks) {
        tasksByList.feedbackGradesTasks.forEach(task => {
            reportData.feedbackGrades.push({
                name: task.name, // This is either the grader name or the date
                pdOrientee: getCustomFieldValue(task.custom_fields, CUSTOM_FIELD_IDS.FEEDBACK_GRADES.PD_ORIENTEE),
                assignment: getCustomFieldValue(task.custom_fields, CUSTOM_FIELD_IDS.FEEDBACK_GRADES.ASSIGNMENT),
                grade: getCustomFieldValue(task.custom_fields, CUSTOM_FIELD_IDS.FEEDBACK_GRADES.GRADE),
                comments: getCustomFieldValue(task.custom_fields, CUSTOM_FIELD_IDS.FEEDBACK_GRADES.COMMENTS),
                effort: getCustomFieldValue(task.custom_fields, CUSTOM_FIELD_IDS.FEEDBACK_GRADES.EFFORT),
                comp: getCustomFieldValue(task.custom_fields, CUSTOM_FIELD_IDS.FEEDBACK_GRADES.COMP),
                application: getCustomFieldValue(task.custom_fields, CUSTOM_FIELD_IDS.FEEDBACK_GRADES.APPLICATION),
                weekNum: getCustomFieldValue(task.custom_fields, CUSTOM_FIELD_IDS.FEEDBACK_GRADES.WEEK_NUM),
                weekDay: getCustomFieldValue(task.custom_fields, CUSTOM_FIELD_IDS.FEEDBACK_GRADES.WEEK_DAY),
            });
        });
    }

    return reportData;
}

/**
 * Processes feedback and grades data for a specific person
 * @param {Array} feedbackGrades All feedback and grades data
 * @param {string} pdOrienteeId The PD Orientee field value to match
 * @returns {Object} Processed daily feedback, homework, and calculated grades
 */
function processPersonGrades(feedbackGrades, pdOrienteeId) {
    // Filter data for this specific person using exact PD Orientee field match
    const personData = feedbackGrades.filter(item => 
        item.pdOrientee === pdOrienteeId
    );
    
    // Separate daily feedback from homework
    const dailyFeedback = personData.filter(item => 
        // Daily feedback has effort/comp/application OR assignment is blank/N/A
        (item.effort !== 'N/A' && item.comp !== 'N/A' && item.application !== 'N/A') ||
        (!item.assignment || item.assignment === 'N/A')
    );
    
    const homework = personData.filter(item => 
        // Homework has assignment OR effort/comp/application are blank/N/A
        (item.assignment && item.assignment !== 'N/A') ||
        (item.effort === 'N/A' && item.comp === 'N/A' && item.application === 'N/A')
    );
    
    // Group daily feedback by week and sort properly (do this first)
    const dailyFeedbackByWeek = dailyFeedback.reduce((acc, feedback) => {
        const week = feedback.weekNum && feedback.weekNum.toLowerCase().includes('2') ? 'Week 2' : 'Week 1';
        if (!acc[week]) acc[week] = [];
        acc[week].push(feedback);
        return acc;
    }, {});
    
    // Calculate weighted averages (Week 2 = 2x weight)
    const calculateWeightedAverage = (items, valueField, weekField = 'weekNum') => {
        if (items.length === 0) return 0;
        
        let totalScore = 0;
        let totalWeight = 0;
        
        items.forEach(item => {
            const value = parseFloat(item[valueField]) || 0;
            const week = item[weekField] && item[weekField].toLowerCase().includes('2') ? 2 : 1;
            const weight = week === 2 ? 2 : 1;
            
            totalScore += value * weight;
            totalWeight += weight;
        });
        
        return totalWeight > 0 ? totalScore / totalWeight : 0;
    };
    
    // Calculate daily averages by category (flatten the grouped data for calculations)
    const allDailyFeedback = [
        ...(dailyFeedbackByWeek['Week 1'] || []),
        ...(dailyFeedbackByWeek['Week 2'] || [])
    ];
    const effortAvg = calculateWeightedAverage(allDailyFeedback, 'effort');
    const compAvg = calculateWeightedAverage(allDailyFeedback, 'comp');
    const applicationAvg = calculateWeightedAverage(allDailyFeedback, 'application');
    const dailyOverallAvg = (effortAvg + compAvg + applicationAvg) / 3;
    
    // Calculate homework average
    const homeworkAvg = calculateWeightedAverage(homework, 'grade');
    
    // Calculate final grade (convert daily to percentage, then average with homework)
    const dailyPercentage = (dailyOverallAvg / 3) * 100;
    const finalGrade = (dailyPercentage + homeworkAvg) / 2;
    
    // Sort each week's feedback by day order
    const dayOrder = { 'mon': 1, 'monday': 1, 'tue': 2, 'tuesday': 2, 'wed': 3, 'wednesday': 3, 'thu': 4, 'thursday': 4, 'fri': 5, 'friday': 5 };
    Object.keys(dailyFeedbackByWeek).forEach(week => {
        dailyFeedbackByWeek[week].sort((a, b) => {
            const dayA = dayOrder[a.weekDay?.toLowerCase()?.substring(0, 3)] || 999;
            const dayB = dayOrder[b.weekDay?.toLowerCase()?.substring(0, 3)] || 999;
            return dayA - dayB;
        });
    });

    return {
        dailyFeedback: dailyFeedbackByWeek,
        homework: homework.sort((a, b) => a.name.localeCompare(b.name)), // Sort by date
        grades: {
            effort: { score: effortAvg, percentage: (effortAvg / 3) * 100 },
            comp: { score: compAvg, percentage: (compAvg / 3) * 100 },
            application: { score: applicationAvg, percentage: (applicationAvg / 3) * 100 },
            dailyOverall: { score: dailyOverallAvg, percentage: dailyPercentage },
            homework: homeworkAvg,
            final: finalGrade
        }
    };
}

async function populateTemplate(data, reportType = 'full', options = {}) {
    const templatePath = path.resolve(__dirname, '..', 'templates', 'report-template.html');
    let html = await fs.readFile(templatePath, 'utf-8');

    html = html.replace('{{CLASS_NAME}}', data.className);

    let classDetailsHtml = '<!-- Class Details Section Hidden -->';
    let scheduleHtml = '<!-- Schedule Section Hidden -->';
    let gradesHtml = '<!-- Grades & Feedback Section Hidden -->';
    let orienteeSummaryHtml = '';

    if (reportType === 'full') {
        const statusOrder = ['Graduated', 'Resigned', 'Released'];
        const groupedByStatus = data.classDetails.reduce((acc, person) => {
            const status = person.status || 'Unknown';
            if (!acc[status]) acc[status] = [];
            acc[status].push(person);
            return acc;
        }, {});

        // Generate summary info for header
        const summaryParts = [];
        for (const status of statusOrder) {
            const count = groupedByStatus[status]?.length || 0;
            if (count > 0) {
                summaryParts.push(`${count} ${status}`);
            }
        }
        const summaryInfo = summaryParts.join(' • ') || 'No orientees found';
        html = html.replace('{{SUMMARY_INFO}}', summaryInfo);

        // Generate orientee summary for title page
        orienteeSummaryHtml = '<div class="grid grid-cols-3 gap-6">';
        for (const status of statusOrder) {
            if (groupedByStatus[status] && groupedByStatus[status].length > 0) {
                groupedByStatus[status].forEach(item => {
                    const personGrades = processPersonGrades(data.feedbackGrades, item.pdOrientee);
                    const statusColorClass = status === 'Graduated' ? 'bg-green-100 text-green-800' : 
                                           status === 'Resigned' ? 'bg-yellow-100 text-yellow-800' : 
                                           'bg-red-100 text-red-800';
                    
                    orienteeSummaryHtml += `
                        <div class="border border-gray-200 p-4 rounded-lg">
                            <div class="flex items-center gap-3 mb-3">
                                ${item.imageUrl ? 
                                    `<img src="${item.imageUrl}" alt="${item.name}" class="h-12 w-12 rounded-full object-cover">` : 
                                    `<div class="h-12 w-12 rounded-full bg-gray-300 flex items-center justify-center text-sm font-bold">${item.name.charAt(0)}</div>`
                                }
                                <div class="flex-1">
                                    <h4 class="font-semibold text-sm">${item.name}</h4>
                                    <span class="text-xs px-2 py-1 rounded-full ${statusColorClass}">${status}</span>
                                </div>
                            </div>
                            <div class="text-xs space-y-1">
                                <div><strong>Pillar:</strong> ${item.pillar || 'N/A'}</div>
                                <div><strong>Final Grade:</strong> <span class="font-bold text-blue-600">${personGrades.grades.final.toFixed(0)}%</span></div>
                                <div><strong>Daily Avg:</strong> ${personGrades.grades.dailyOverall.score.toFixed(1)}/3</div>
                                <div><strong>Homework:</strong> ${personGrades.grades.homework.toFixed(0)}%</div>
                            </div>
                        </div>
                    `;
                });
            }
        }
        orienteeSummaryHtml += '</div>';

        let tempHtml = '';
        for (const status of statusOrder) {
            if (groupedByStatus[status] && groupedByStatus[status].length > 0) {
                groupedByStatus[status].forEach(item => {
                    // Process grades for this person
                    const personGrades = processPersonGrades(data.feedbackGrades, item.pdOrientee);
                    tempHtml += `
                        <div class="employee-card" style="page-break-before: always; page-break-inside: avoid;">
                            <!-- Clean status banner -->
                            <div class="${status === 'Graduated' ? 'status-graduated' : status === 'Resigned' ? 'status-resigned' : 'status-released'} text-white text-center py-2">
                                <h2 class="text-lg font-semibold">${status.toUpperCase()}</h2>
                            </div>
                            
                            <!-- Compact employee header -->
                            <div class="compact-section flex items-start gap-4">
                                ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.name}" class="h-20 w-20 rounded-full object-cover flex-shrink-0">` : '<div class="h-20 w-20 rounded-full bg-gray-300 flex-shrink-0"></div>'}
                                <div class="flex-grow">
                                    <h3 class="text-xl font-bold mb-2">${item.name}</h3>
                                    <div class="text-sm space-y-1">
                                        <div><strong>Pillar:</strong> ${item.pillar || 'N/A'} | <strong>Market:</strong> ${item.market || 'N/A'}</div>
                                        <div><strong>Personality:</strong> ${item.personalityTag || 'N/A'}</div>
                                        <div><strong>Email:</strong> ${item.cogentEmail || 'N/A'}</div>
                                        ${item.linkedin && item.linkedin !== 'N/A' ? `<div><strong>LinkedIn:</strong> ${item.linkedin}</div>` : ''}
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Clean feedback section -->
                            <div class="compact-section">
                                <h4 class="font-semibold text-base mb-3">Feedback for the AD</h4>
                                <div class="text-sm space-y-3">
                                    <div class="border-l-2 border-green-400 pl-3">
                                        <strong>Week 1:</strong> ${item.wk1Feedback || 'No feedback provided'}
                                    </div>
                                    <div class="border-l-2 border-purple-400 pl-3">
                                        <strong>Week 2:</strong> ${item.wk2Feedback || 'No feedback provided'}
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Daily feedback tables -->
                            ${Object.keys(personGrades.dailyFeedback).length > 0 ? `
                            <div class="compact-section">
                                <h4 class="font-semibold text-base mb-3">Daily Feedback</h4>
                                ${['Week 1', 'Week 2'].map(weekName => {
                                    const weekData = personGrades.dailyFeedback[weekName];
                                    if (!weekData || weekData.length === 0) return '';
                                    
                                    return `
                                    <div class="mb-4">
                                        <h5 class="week-section text-white px-3 py-1 text-sm font-semibold">${weekName}</h5>
                                        <table class="w-full text-sm border-collapse">
                                            <thead class="clean-table-header">
                                                <tr>
                                                    <th class="px-2 py-2 text-left">Day</th>
                                                    <th class="px-2 py-2 text-left">Grader</th>
                                                    <th class="px-2 py-2 text-center">Effort</th>
                                                    <th class="px-2 py-2 text-center">Comp</th>
                                                    <th class="px-2 py-2 text-center">App</th>
                                                    <th class="px-2 py-2 text-left">Comments</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${weekData.map((feedback, index) => `
                                                    <tr class="clean-table-row">
                                                        <td class="px-2 py-2">${feedback.weekDay || 'N/A'}</td>
                                                        <td class="px-2 py-2">${feedback.name}</td>
                                                        <td class="px-2 py-2 text-center score-text">${feedback.effort}</td>
                                                        <td class="px-2 py-2 text-center score-text">${feedback.comp}</td>
                                                        <td class="px-2 py-2 text-center score-text">${feedback.application}</td>
                                                        <td class="px-2 py-2 text-xs">${feedback.comments || 'No comments'}</td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                    `;
                                }).join('')}
                            </div>
                            ` : ''}
                            
                            <!-- Homework grades table -->
                            ${personGrades.homework.length > 0 ? `
                            <div class="compact-section">
                                <h4 class="font-semibold text-base mb-3">Homework Grades</h4>
                                <table class="w-full text-sm border-collapse">
                                    <thead class="clean-table-header">
                                        <tr>
                                            <th class="px-2 py-2 text-left">Date</th>
                                            <th class="px-2 py-2 text-left">Assignment</th>
                                            <th class="px-2 py-2 text-center">Grade</th>
                                            <th class="px-2 py-2 text-left">Comments</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${personGrades.homework.map((hw, index) => `
                                            <tr class="clean-table-row">
                                                <td class="px-2 py-2">${hw.name}</td>
                                                <td class="px-2 py-2">${hw.assignment}</td>
                                                <td class="px-2 py-2 text-center grade-text">${hw.grade}%</td>
                                                <td class="px-2 py-2 text-xs">${hw.comments || 'No comments'}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                            ` : ''}
                            
                            <!-- Final grades summary -->
                            <div class="final-grades-section compact-section p-3">
                                <h4 class="font-semibold text-base mb-3">Final Grades Summary</h4>
                                <div class="grid grid-cols-2 gap-4 text-sm">
                                    <div class="space-y-2">
                                        <div class="flex justify-between">
                                            <span>Effort:</span>
                                            <span class="score-text">${personGrades.grades.effort.score.toFixed(1)}/3 (${personGrades.grades.effort.percentage.toFixed(0)}%)</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span>Comprehension:</span>
                                            <span class="score-text">${personGrades.grades.comp.score.toFixed(1)}/3 (${personGrades.grades.comp.percentage.toFixed(0)}%)</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span>Application:</span>
                                            <span class="score-text">${personGrades.grades.application.score.toFixed(1)}/3 (${personGrades.grades.application.percentage.toFixed(0)}%)</span>
                                        </div>
                                    </div>
                                    <div class="space-y-2">
                                        <div class="flex justify-between">
                                            <span>Daily Average:</span>
                                            <span class="score-text">${personGrades.grades.dailyOverall.score.toFixed(1)}/3 (${personGrades.grades.dailyOverall.percentage.toFixed(0)}%)</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span>Homework:</span>
                                            <span class="grade-text">${personGrades.grades.homework.toFixed(0)}%</span>
                                        </div>
                                        <div class="flex justify-between font-bold bg-blue-100 px-2 py-1 rounded">
                                            <span>FINAL GRADE:</span>
                                            <span class="text-lg text-blue-800">${personGrades.grades.final.toFixed(0)}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                });
            }
        }
        classDetailsHtml = tempHtml;
    } else if (reportType === 'daily') {
        const dateStr = options.day || 'Selected Day';
        html = html.replace('{{SUMMARY_INFO}}', `Daily Report • ${dateStr}`);
        // === Daily Report Content ===

        const statusOrder=['Graduated','Resigned','Released'];

        // 1) Summary cards (page 1)
        const grouped=data.classDetails.reduce((acc,p)=>{const s=p.status||'Unknown';(acc[s]=acc[s]||[]).push(p);return acc;},{});
        orienteeSummaryHtml='<div class="grid grid-cols-3 gap-6">';
        for(const status of statusOrder){
          (grouped[status]||[]).forEach(item=>{
            const color=status==='Graduated'?'bg-green-100 text-green-800':status==='Resigned'?'bg-yellow-100 text-yellow-800':'bg-red-100 text-red-800';
            orienteeSummaryHtml+=`
              <div class="border border-gray-200 p-4 rounded-lg">
                <div class="flex items-center gap-3 mb-3">
                  ${item.imageUrl?`<img src="${item.imageUrl}" class="h-12 w-12 rounded-full object-cover">`:`<div class="h-12 w-12 rounded-full bg-gray-300 flex items-center justify-center text-sm font-bold">${item.name.charAt(0)}</div>`}
                  <div class="flex-1">
                    <h4 class="font-semibold text-sm truncate">${item.name}</h4>
                    <span class="text-xs px-2 py-1 rounded-full ${color}">${status}</span>
                  </div>
                </div>
                <div class="text-xs space-y-1">
                  <div><strong>Pillar:</strong> ${item.pillar||'N/A'}</div>
                </div>
              </div>`;
          });
        }
        orienteeSummaryHtml+='</div>';
        html = html.replace(/<section id="orientee-summary" class="mb-8">[\s\S]*?<\/section>/, `<section id="orientee-summary" class="mb-8">${orienteeSummaryHtml}</section>`);

        // 2) Per-orientee cards after summary
        let detailHtml='';
        const isHomework=row=>row.assignment && row.assignment!=='N/A';

        for(const status of statusOrder){
          (grouped[status]||[]).forEach(item=>{
            const rowsForOrientee=data.feedbackGrades.filter(r=>r.pdOrientee===item.pdOrientee);
            const dailyRows=rowsForOrientee.filter(r=>!isHomework(r));
            const hwRows=rowsForOrientee.filter(isHomework);

            const statusBanner=status==='Graduated'? 'status-graduated': status==='Resigned'? 'status-resigned':'status-released';

            detailHtml+=`
              <div class="employee-card" style="page-break-before: always; page-break-inside: avoid;">
                <div class="${statusBanner} text-white text-center py-2"><h2 class="text-lg font-semibold">${status.toUpperCase()}</h2></div>
                <div class="compact-section flex items-start gap-4">
                  ${item.imageUrl?`<img src="${item.imageUrl}" class="h-20 w-20 rounded-full object-cover flex-shrink-0">`:'<div class="h-20 w-20 rounded-full bg-gray-300 flex-shrink-0"></div>'}
                  <div class="flex-grow">
                    <h3 class="text-xl font-bold mb-2">${item.name}</h3>
                    <div class="text-sm space-y-1">
                      <div><strong>Pillar:</strong> ${item.pillar||'N/A'}</div>
                    </div>
                  </div>
                </div>`;

            if(dailyRows.length){
              detailHtml+=`<div class="compact-section"><h4 class="font-semibold text-base mb-3">Daily Feedback</h4><table class="w-full text-sm border-collapse"><thead class="clean-table-header"><tr><th>Day</th><th>Grader</th><th>E</th><th>C</th><th>A</th><th>Comments</th></tr></thead><tbody>`;
              dailyRows.forEach(r=>{
                detailHtml+=`<tr class="clean-table-row"><td class="px-2 py-2">${r.weekDay||''}</td><td class="px-2 py-2">${r.name}</td><td class="px-2 py-2 text-center score-text">${r.effort}</td><td class="px-2 py-2 text-center score-text">${r.comp}</td><td class="px-2 py-2 text-center score-text">${r.application}</td><td class="px-2 py-2 text-xs">${r.comments||''}</td></tr>`;
              });
              detailHtml+='</tbody></table></div>';
            }

            if(hwRows.length){
              detailHtml+=`<div class="compact-section mt-4"><h4 class="font-semibold text-base mb-3">Homework</h4><table class="w-full text-sm border-collapse"><thead class="clean-table-header"><tr><th>Date</th><th>Assignment</th><th>Grade</th><th>Comments</th></tr></thead><tbody>`;
              hwRows.forEach(r=>{
                detailHtml+=`<tr class="clean-table-row"><td class="px-2 py-2">${r.name}</td><td class="px-2 py-2">${r.assignment}</td><td class="px-2 py-2 text-center grade-text">${r.grade}%</td><td class="px-2 py-2 text-xs">${r.comments||''}</td></tr>`;
              });
              detailHtml+='</tbody></table></div>';
            }

            detailHtml+='</div>';
          });
        }

        classDetailsHtml = detailHtml;
        gradesHtml='<!-- Daily tables handled in detailHtml -->';
        scheduleHtml='<!-- hidden -->';
    } else {
        // For other report types, provide a simple summary
        html = html.replace('{{SUMMARY_INFO}}', `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`);
    } 

    // --- Replace the inner content of the sections in the template ---
    const summaryContent = (reportType==='full' || reportType==='daily') ? orienteeSummaryHtml : '';
    html = html.replace(/<section id="orientee-summary" class="mb-8">[\s\S]*?<\/section>/, `<section id="orientee-summary" class="mb-8">${summaryContent}</section>`);
    html = html.replace(/<section id="class-details">[\s\S]*?<\/section>/, `<section id="class-details">${classDetailsHtml}</section>`);
    html = html.replace(/<section id="schedule" class="mb-10">[\s\S]*?<\/section>/, `<section id="schedule" class="mb-10">${scheduleHtml}</section>`);
    html = html.replace(/<section id="grades" class="mb-10">[\s\S]*?<\/section>/, `<section id="grades" class="mb-10">${gradesHtml}</section>`);
    
    return html;
}

async function generateReport(className, reportType = 'full', options = {}) {
  const { day } = options;

  const listIds = await findListIdsForClass(className);
  if (!listIds) {
    return null;
  }
  
  const promises = [];

  if (reportType === 'full' || reportType === 'roster' || reportType === 'daily') {
    promises.push(getTasks(listIds.classDetails).catch(e => { console.error(e.message); return []; }));
  } else {
    promises.push(Promise.resolve([]));
  }
  
  if (reportType === 'full' || reportType === 'schedule') {
    promises.push(getTasks(listIds.schedule).catch(e => { console.error(e.message); return []; }));
  } else {
    promises.push(Promise.resolve([]));
  }
  
  if (reportType === 'full' || reportType === 'grades' || reportType === 'daily') {
    promises.push(getTasks(listIds.feedbackGrades).catch(e => { console.error(e.message); return []; }));
  } else {
    promises.push(Promise.resolve([]));
  }

  const [
    classDetailsTasks,
    scheduleTasks,
    feedbackGradesTasks,
  ] = await Promise.all(promises);

  // --- New Step: Fetch full task details to get attachments ---
  const detailedClassDetailsTasks = [];
  if (classDetailsTasks && classDetailsTasks.length > 0) {
    for (const task of classDetailsTasks) {
      try {
        const detailedTask = await getTask(task.id);
        detailedClassDetailsTasks.push(detailedTask);
      } catch (e) {
        console.error(`Failed to fetch details for task ${task.id}:`, e.message);
        // Still push the original task so the report can partially render
        detailedClassDetailsTasks.push(task);
      }
    }
  }
  // --- End New Step ---

  // For daily reports, optionally filter feedback grades by date
  let processed = processTaskData({
    classDetailsTasks: detailedClassDetailsTasks,
    scheduleTasks,
    feedbackGradesTasks,
  }, className);

  if (reportType === 'daily' && day) {
    // ------- Compute timeline offset helper -------
    const dowMap={
      'mon':0,'monday':0,
      'tue':1,'tuesday':1,
      'wed':2,'wednesday':2,
      'thu':3,'thursday':3,
      'fri':4,'friday':4
    };

    const parseStartDate=(cls)=>{
      const m=cls.match(/PD OTN (\d{2})\.(\d{2})\.(\d{2})/);
      if(!m) return null;
      const [ ,mm,dd,yy]=m;
      return new Date(2000+parseInt(yy), parseInt(mm)-1, parseInt(dd));
    };

    const classStart=parseStartDate(className);
    const targetDate=new Date(day);
    if(classStart){
      const targetOffset=Math.floor((targetDate-classStart)/(24*60*60*1000)); // calendar days
      const offsetFromWeekFields=(wk,wd)=>{
         const weekPart = String(wk||'').toLowerCase().includes('2')?5:0;
         const dayPart = dowMap[(wd||'').toLowerCase().substring(0,3)] ?? 0;
         return weekPart+dayPart;
      };

      processed.feedbackGrades = processed.feedbackGrades.filter(fg=>{
         const isHomework = fg.assignment && fg.assignment !== 'N/A';
         const offset=offsetFromWeekFields(fg.weekNum, fg.weekDay);
         return isHomework || offset<=targetOffset;
      });
    }
  }

  const finalHtml = await populateTemplate(processed, reportType, { day });

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();

  return pdfBuffer;
}

async function generateReportData(className) {
  const listIds = await findListIdsForClass(className);
  if (!listIds) {
    return null;
  }
  
  // Fetch all the data needed for a full report
  const promises = [
    getTasks(listIds.classDetails).catch(e => { console.error(e.message); return []; }),
    getTasks(listIds.schedule).catch(e => { console.error(e.message); return []; }),
    getTasks(listIds.feedbackGrades).catch(e => { console.error(e.message); return []; })
  ];

  const [
    classDetailsTasks,
    scheduleTasks,
    feedbackGradesTasks,
  ] = await Promise.all(promises);

  // Fetch full task details to get attachments (including photos)
  const detailedClassDetailsTasks = [];
  if (classDetailsTasks && classDetailsTasks.length > 0) {
    for (const task of classDetailsTasks) {
      try {
        const detailedTask = await getTask(task.id);
        detailedClassDetailsTasks.push(detailedTask);
      } catch (e) {
        console.error(`Failed to fetch details for task ${task.id}:`, e.message);
        // Still push the original task so the report can partially render
        detailedClassDetailsTasks.push(task);
      }
    }
  }

  const reportData = processTaskData({
    classDetailsTasks: detailedClassDetailsTasks,
    scheduleTasks,
    feedbackGradesTasks,
  }, className);
  
  return reportData;
}

// quick wrapper for daily
async function generateDailyReport(className, dateISO){
  return generateReport(className,'daily',{day:dateISO});
}

module.exports = {
  generateReport,
  generateReportData,
  generateDailyReport,
}; 