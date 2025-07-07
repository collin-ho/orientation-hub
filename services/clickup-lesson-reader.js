const { getTasks, getListDetails, getFolderLists, findFolderByName } = require('../utils/clickup-client');
const { getLessons } = require('./class-lesson-store');
const { configLoader } = require('./config-loader');

/**
 * ClickUp Lesson Reader Service
 * Reads actual lesson schedules and details from live ClickUp classes
 */
class ClickUpLessonReader {
  constructor() {
    this.cache = new Map();
    this.CACHE_TTL = 2 * 60 * 1000; // 2 minutes
    
    // Clear any existing cache on startup to ensure fresh data with updated parsing
    this.clearCache();
    console.log('🔄 ClickUp Lesson Reader initialized with updated field parsing');
  }

  /**
   * Get lessons from a live ClickUp class
   */
  async getLiveClassLessons(className) {
    try {
      console.log(`📚 Reading live lessons from class: ${className}`);
      
      // Check cache first
      const cacheKey = `class-${className}`;
      const cached = this.cache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
        console.log('✅ Using cached lesson data');
        return cached.data;
      }

      // Find the class folder in 1100 Workshop space
      const WORKSHOP_SPACE_ID = '14869535';
      const folder = await findFolderByName(className, WORKSHOP_SPACE_ID);
      if (!folder) {
        throw new Error(`Class folder not found: ${className}`);
      }

      // Get folder lists
      const lists = await getFolderLists(folder.id);
      const scheduleList = lists.find(list => list.name === 'Schedule');
      
      if (!scheduleList) {
        throw new Error(`Schedule list not found in class: ${className}`);
      }

      // Get all schedule tasks (lessons)
      const tasks = await getTasks(scheduleList.id);
      
      // Convert ClickUp tasks to lesson format
      let lessons = this.convertTasksToLessons(tasks);
      
      // Merge timing data (start/end times, week label) from template DB copy
      lessons = this.mergeTemplateTiming(className, lessons);
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: {
          lessons,
          metadata: {
            className,
            folderId: folder.id,
            scheduleListId: scheduleList.id,
            totalLessons: lessons.length,
            fetchTime: new Date().toISOString(),
            source: 'ClickUp Live Class'
          }
        },
        timestamp: Date.now()
      });

      console.log(`✅ Loaded ${lessons.length} live lessons from ${className}`);
      
      return {
        lessons,
        metadata: {
          className,
          folderId: folder.id,
          scheduleListId: scheduleList.id,
          totalLessons: lessons.length,
          fetchTime: new Date().toISOString(),
          source: 'ClickUp Live Class'
        }
      };

    } catch (error) {
      console.error(`💥 Failed to read live lessons from ${className}:`, error.message);
      throw new Error(`Failed to read live lessons: ${error.message}`);
    }
  }

  /**
   * Convert ClickUp tasks to our lesson format
   */
  convertTasksToLessons(tasks) {
    return tasks.map((task, index) => {
      // Extract custom field values
      const customFields = task.custom_fields || [];
      
      // Debug: Log available fields for first task (remove after testing)
      if (index === 0) {
        console.log(`🔍 Available fields for task "${task.name}":`);
        customFields.forEach(field => {
          console.log(`  • "${field.name}" (${field.type}): ${JSON.stringify(field.value)}`);
          // Show the actual structure for debugging
          if (field.value !== undefined && field.value !== null) {
            console.log(`    Raw value:`, field.value);
          }
        });
      }
      
      // Helper to find field value by name (supporting multiple field name variations)
      const getFieldValue = (fieldNames) => {
        // Support both single field name and array of possible names
        const names = Array.isArray(fieldNames) ? fieldNames : [fieldNames];
        
        for (const fieldName of names) {
          const field = customFields.find(f => f.name === fieldName);
          if (field) {
            // Handle different field types
            if (field.type === 'drop_down' && field.value) {
              // ClickUp dropdown values can be objects with name property or direct values
              if (typeof field.value === 'object' && field.value.name) {
                return field.value.name;
              }
              return field.value;
            }
            if (field.type === 'users' && field.value && field.value.length > 0) {
              return field.value.map(v => v.username || v.name || v).filter(Boolean);
            }
            if (field.type === 'list' && field.value && field.value.length > 0) {
              return field.value.map(v => v.username || v.name || v).filter(Boolean);
            }
            // Return the raw value for debugging
            return field.value;
          }
        }
        return null;
      };

      // Extract timing information using actual ClickUp field names from debug output
      let weekDay = getFieldValue(['Week Day', 'Day']) || 'Unknown';
      let weekNum = getFieldValue(['Week #', 'Week Label', 'Week']) || 'Unknown';

      // Map numeric dropdown values (1-5) to weekday strings
      const numericDayMap = { '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri' };
      if (numericDayMap[weekDay]) weekDay = numericDayMap[weekDay];

      // Map numeric week numbers to labels expected by template mapping
      if (weekNum === '1') weekNum = 'Week 1';
      if (weekNum === '2') weekNum = 'Week 2';

      const dayOffset = this.calculateDayOffset(weekDay, weekNum);

      // Extract leads (instructors) using actual field name
      const leads = getFieldValue(['Lead(s)', 'Leads']) || [];

      // Extract subject using actual field name
      const subject = getFieldValue(['Subject']) || null;

      // Debug for first few tasks to see what we're getting
      if (index < 3) {
        console.log(`📝 Task "${task.name}": weekDay="${weekDay}", weekNum="${weekNum}", dayOffset=${dayOffset}, leads=${JSON.stringify(leads)}, subject="${subject}"`);
      }

      // Map week number to our format
      const week = this.mapWeekLabel(weekNum);

      return {
        id: `${weekDay}-${dayOffset}`, // Use weekDay-dayOffset instead of ClickUp task ID
        name: task.name,
        description: task.description || '',
        dayOffset,
        week,
        weekDay,
        subject,
        leads: Array.isArray(leads) ? leads : [leads].filter(Boolean),
        isActive: task.status?.status !== 'complete' && task.status?.status !== 'closed',
        
        // ClickUp specific data
        clickup: {
          taskId: task.id,
          status: task.status?.status,
          dateCreated: task.date_created,
          dateUpdated: task.date_updated,
          url: task.url,
          assignees: task.assignees?.map(a => a.username) || []
        }
      };
    }).sort((a, b) => a.dayOffset - b.dayOffset || a.id - b.id);
  }

  /**
   * Calculate day offset from week day and week number
   */
  calculateDayOffset(weekDay, weekNum) {
    // Handle both text days (Mon, Tue) and potential numeric days
    const dayMap = { 
      'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4,
      'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3, 'Friday': 4,
      '1': 0, '2': 1, '3': 2, '4': 3, '5': 4  // In case ClickUp sends numeric days
    };
    
    const dayIndex = dayMap[weekDay] || 0;
    
    // Week 1 starts at day 0, Week 2 starts at day 7
    const weekNumStr = String(weekNum || '');
    const weekNumber = parseInt(weekNumStr) || 1;
    
    if (weekNumber === 2 || weekNumStr.includes('Week 2') || weekNumStr.includes('Person')) {
      return 7 + dayIndex;
    }
    return dayIndex;
  }

  /**
   * Map ClickUp week numbers to our format
   */
  mapWeekLabel(weekNum) {
    const weekNumStr = String(weekNum || '');
    if (!weekNumStr || weekNumStr === 'Unknown') return 'Unknown';
    
    if (weekNumStr.includes('Week 1') || weekNumStr.includes('Remote')) {
      return 'Week 1 (Remote)';
    }
    if (weekNumStr.includes('Week 2') || weekNumStr.includes('Person')) {
      return 'Week 2 (In Person)';
    }
    
    return weekNumStr;
  }

  /**
   * Get available classes for live mode
   */
  async getAvailableClasses() {
    try {
      console.log('🔍 Finding available ClickUp classes...');
      
      const { getSpaceFolders } = require('../utils/clickup-client');
      const WORKSHOP_SPACE_ID = '14869535'; // 1100: Workshop - Has folder/task permissions
      
      const folders = await getSpaceFolders(WORKSHOP_SPACE_ID);
      
      // Filter for orientation class folders
      const classes = folders
        .filter(f => f.name.trim().startsWith('PD OTN'))
        .map(f => ({
          id: f.id,
          name: f.name.trim(),
          isTemplate: f.name.includes('TEMPLATE') || f.name.includes('Template')
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      console.log(`✅ Found ${classes.length} ClickUp classes`);
      return classes;

    } catch (error) {
      console.error('💥 Failed to get available classes:', error.message);
      throw new Error(`Failed to get available classes: ${error.message}`);
    }
  }

  /**
   * Compare template lessons with live lessons
   */
  async compareLessons(templateLessons, className) {
    try {
      const liveData = await this.getLiveClassLessons(className);
      const liveLessons = liveData.lessons;

      const comparison = {
        template: {
          count: templateLessons.length,
          lessons: templateLessons
        },
        live: {
          count: liveLessons.length,
          lessons: liveLessons,
          className,
          metadata: liveData.metadata
        },
        differences: []
      };

      // Find differences
      templateLessons.forEach(templateLesson => {
        const liveLesson = liveLessons.find(l => 
          l.name === templateLesson.name || 
          l.id === templateLesson.id
        );

        if (!liveLesson) {
          comparison.differences.push({
            type: 'missing_in_live',
            lesson: templateLesson,
            description: `Template lesson "${templateLesson.name}" not found in live class`
          });
        } else {
          // Check for differences in timing
          if (liveLesson.dayOffset !== templateLesson.dayOffset) {
            comparison.differences.push({
              type: 'timing_difference',
              lesson: templateLesson,
              live: liveLesson,
              description: `"${templateLesson.name}" day offset: template=${templateLesson.dayOffset}, live=${liveLesson.dayOffset}`
            });
          }

          // Check for differences in leads
          const templateLeads = (templateLesson.leads || []).sort();
          const liveLeads = (liveLesson.leads || []).sort();
          if (JSON.stringify(templateLeads) !== JSON.stringify(liveLeads)) {
            comparison.differences.push({
              type: 'leads_difference', 
              lesson: templateLesson,
              live: liveLesson,
              description: `"${templateLesson.name}" leads differ: template=[${templateLeads.join(', ')}], live=[${liveLeads.join(', ')}]`
            });
          }
        }
      });

      // Find lessons in live that aren't in template
      liveLessons.forEach(liveLesson => {
        const templateLesson = templateLessons.find(l => 
          l.name === liveLesson.name || 
          l.id === liveLesson.id
        );

        if (!templateLesson) {
          comparison.differences.push({
            type: 'extra_in_live',
            lesson: liveLesson,
            description: `Live lesson "${liveLesson.name}" not found in template`
          });
        }
      });

      console.log(`🔍 Comparison complete: ${comparison.differences.length} differences found`);
      return comparison;

    } catch (error) {
      throw new Error(`Failed to compare lessons: ${error.message}`);
    }
  }

  /**
   * Clear cache for a specific class or all classes
   */
  clearCache(className = null) {
    if (className) {
      this.cache.delete(`class-${className}`);
      console.log(`🗑️ Cleared cache for class: ${className}`);
    } else {
      this.cache.clear();
      console.log('🗑️ Cleared all lesson cache');
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cachedClasses: Array.from(this.cache.keys()),
      cacheSize: this.cache.size,
      ttl: this.CACHE_TTL
    };
  }

  /**
   * Merge start/end times (and fallback week label) from template lessons stored in DB.
   * We DO NOT overwrite week or dayOffset when ClickUp already supplies them – users might have
   * adjusted those values in ClickUp.  We only fill missing pieces.
   */
  mergeTemplateTiming(className, liveLessons) {
    try {
      // Ensure template is loaded
      if (!configLoader.loaded) {
        configLoader.loadConfigurations();
      }
      const templateLessons = configLoader.getLessons();

      const tplMap = Object.fromEntries(
        templateLessons.map((t) => [t.name.toLowerCase(), t])
      );

      const mergedLessons = liveLessons.map((live) => {
        const tpl = tplMap[live.name.toLowerCase()];
        if (!tpl) return live;

        const merged = { ...live };

        // Always use canonical timing values from template (ClickUp API loses these)
        if (tpl.startTime) merged.startTime = tpl.startTime;
        if (tpl.endTime) merged.endTime = tpl.endTime;

        if (tpl.week) merged.week = tpl.week;
        if (tpl.weekDay) merged.weekDay = tpl.weekDay;
        if (typeof tpl.dayOffset === 'number') merged.dayOffset = tpl.dayOffset;

        // Subject (pillar) - use template as canonical value
        if (tpl.subject) merged.subject = tpl.subject;

        // Update ID to reflect new day
        merged.id = `${merged.weekDay}-${merged.dayOffset}`;

        return merged;
      });

      // Resort by dayOffset then name
      mergedLessons.sort((a,b)=>{
        if(a.dayOffset!==b.dayOffset) return a.dayOffset-b.dayOffset;
        return a.name.localeCompare(b.name);
      });

      return mergedLessons;
    } catch (err) {
      console.warn('⚠️  Failed to merge template timing:', err.message);
      return liveLessons;
    }
  }
}

// Create singleton instance
const clickupLessonReader = new ClickUpLessonReader();

module.exports = {
  ClickUpLessonReader,
  clickupLessonReader
}; 