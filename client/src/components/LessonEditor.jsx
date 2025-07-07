import React, { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

function LessonEditor({ selectedClass: propSelectedClass }) {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWeek, setSelectedWeek] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [toast, setToast] = useState(null); // {msg, type}

  // Template vs Live mode
  const mode = "template"; // live mode removed

  // UI controls
  const [showAllLessons, setShowAllLessons] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'schedule'

  // Available options for dropdowns
  const [subjects, setSubjects] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClassName, setSelectedClassName] = useState('');

  const [context, setContext] = useState('template'); // 'template' | 'class'

  useEffect(() => {
    loadReferenceData();
  }, []);

  useEffect(() => {
    if (propSelectedClass) {
      setSelectedClassName(propSelectedClass);
      setContext('class');
    } else {
      setContext('template');
      setSelectedClassName('');
    }
  }, [propSelectedClass]);

  useEffect(()=>{
    if(context === 'template' || (context==='class' && selectedClassName)) {
      loadLessons();
    }
  }, [context, selectedClassName]);

  const loadLessons = async () => {
    try {
      setLoading(true);
      const endpoint = context==='template' ? '/api/config/lessons' : `/api/config/lessons/live/${encodeURIComponent(selectedClassName)}`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error('Failed to load lessons');
      const data = await res.json();
      setLessons(data.lessons || []);
      setHasChanges(false);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError(err.message);
      setLessons([]);
      setLoading(false);
    }
  };

  const loadReferenceData = async () => {
    try {
      // Load subjects and instructors for dropdowns
      const [subjectsRes, instructorsRes] = await Promise.all([
        fetch('/api/config/subjects'),
        fetch('/api/instructors')
      ]);
      
      if (subjectsRes.ok) {
        const subjectData = await subjectsRes.json();
        setSubjects(subjectData.subjects || []);
      }
      
      if (instructorsRes.ok) {
        const instructorData = await instructorsRes.json();
        setInstructors(instructorData.instructors || []);
      }
    } catch (err) {
      console.warn('Could not load reference data:', err.message);
    }
  };

  // Filter lessons based on search and filters
  const filteredLessons = lessons.filter(lesson => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      if (!lesson.name.toLowerCase().includes(searchLower) &&
          !lesson.leads?.some(lead => lead.toLowerCase().includes(searchLower))) {
        return false;
      }
    }
    
    // Week filter
    if (selectedWeek !== 'all' && lesson.week !== selectedWeek) {
      return false;
    }
    
    // Subject filter
    if (selectedSubject !== 'all' && lesson.subject !== selectedSubject) {
      return false;
    }
    
    return true;
  });

  const handleAddLesson = () => {
    const newLesson = {
      id: Math.max(...lessons.map(l => l.id), 0) + 1,
      name: '',
      dayOffset: 0,
      week: 'Week 1 (Remote)',
      weekDay: 'Mon',
      subject: '',
      leads: [],
      isActive: true
    };
    setEditingLesson(newLesson);
    setShowAddModal(true);
  };

  const handleEditLesson = (lesson) => {
    setEditingLesson({ ...lesson });
    setShowAddModal(true);
  };

  const handleSaveLesson = async () => {
    if (!editingLesson.name.trim()) {
      alert('Lesson name is required');
      return;
    }

    const updatedLessons = editingLesson.id && lessons.find(l => l.id === editingLesson.id)
      ? lessons.map(l => l.id === editingLesson.id ? editingLesson : l)
      : [...lessons, editingLesson];

    setLessons(updatedLessons);
    setShowAddModal(false);
    setEditingLesson(null);
    await saveLessonsToServer(updatedLessons);
  };

  const handleDeleteLesson = async (lessonId) => {
    if (confirm('Are you sure you want to delete this lesson?')) {
      const updated = lessons.filter(l => l.id !== lessonId);
      setLessons(updated);
      await saveLessonsToServer(updated);
    }
  };

  const handleModeChange = (newMode) => {
    if (hasChanges) {
      const confirmSwitch = window.confirm(
        'You have unsaved changes. Switching modes will discard them. Are you sure?'
      );
      if (!confirmSwitch) return;
    }

    setMode(newMode);
    setHasChanges(false);
    setError(null);
  };

  const handleClassChange = (className) => {
    setSelectedClass(className);
    setError(null);
  };

  const refreshData = async () => {
    setError(null);
    await loadLessons();
  };

  const weekOptions = ['Week 1 (Remote)', 'Week 2 (In Person)'];
  const dayOptions = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  // Group lessons by week and day for schedule view
  const groupLessonsBySchedule = (lessons) => {
    const schedule = {};
    
    lessons.forEach(lesson => {
      const week = lesson.week || 'Unknown Week';
      const day = lesson.weekDay || 'Unknown Day';
      
      if (!schedule[week]) {
        schedule[week] = {};
      }
      if (!schedule[week][day]) {
        schedule[week][day] = [];
      }
      
      schedule[week][day].push(lesson);
    });
    
    // Sort lessons within each day by dayOffset
    Object.keys(schedule).forEach(week => {
      Object.keys(schedule[week]).forEach(day => {
        schedule[week][day].sort((a, b) => a.dayOffset - b.dayOffset);
      });
    });
    
    return schedule;
  };

  const renderScheduleView = () => {
    const schedule = groupLessonsBySchedule(filteredLessons);
    const weekOrder = ['Week 1 (Remote)', 'Week 2 (In Person)'];
    const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

    // Build legend items for a given week
    const getWeekSubjects = (weekLessons) => {
      const set = new Set();
      Object.values(weekLessons).forEach((dayLessons) => {
        dayLessons.forEach((l) => l.subject && set.add(l.subject));
      });
      return Array.from(set);
    };

    const SCHEDULE_START = 8 * 60; // 8:00 AM in minutes
    const SCHEDULE_END = 18 * 60;  // 6:00 PM in minutes
    const PX_PER_MIN = 1.5;        // 90px per hour like the static HTML

    // Generate the time ruler labels (8 AM – 6 PM)
    const timeLabels = Array.from({ length: (SCHEDULE_END - SCHEDULE_START) / 60 + 1 }, (_, i) => {
      const h24 = 8 + i;
      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
      return `${h12}:00 ${h24 >= 12 ? 'PM' : 'AM'}`;
    });

    return (
      <div className="space-y-16 overflow-x-auto">
        {weekOrder.map((week) => {
          if (!schedule[week]) return null;
          const weekSubjects = getWeekSubjects(schedule[week]);

          return (
            <section key={week} className="print-week mb-16">
              {/* Week header with legend */}
              <header className="mb-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">{week}</h2>
                <div className="flex flex-wrap gap-4">
                  {weekSubjects.map((sub) => (
                    <div key={sub} className="flex items-center space-x-2 text-xs text-gray-200">
                      <span className="w-3 h-3" style={{ background: getPillarColor(sub) }}></span>
                      <span>{sub}</span>
                    </div>
                  ))}
                </div>
              </header>

              {/* Week schedule grid */}
              <div className="flex">
                {/* Time ruler */}
                <div
                  className="flex flex-col pr-4 text-right text-gray-400 text-xs"
                  style={{ width: '50px' }}
                >
                  {timeLabels.map((label) => (
                    <div key={label} style={{ height: '90px' }}>{label}</div>
                  ))}
                </div>

                {/* Day columns */}
                <div
                  className="grid flex-1"
                  style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '8px' }}
                >
                  {dayOrder.map((day) => {
                    const dayLessons = schedule[week]?.[day] || [];

                    return (
                      <div key={day} className="flex flex-col" style={{ height: '928px' }}>
                        {/* Day header */}
                        <div
                          className="flex items-center justify-center text-white font-semibold"
                          style={{ height: '28px', background: '#242424', borderBottom: '1px solid #333' }}
                        >
                          {day}
                        </div>

                        {/* Day body with hour grid */}
                        <div
                          className="relative flex-1 hour-grid"
                          style={{
                            background: '#1a1a1a',
                            backgroundImage:
                              'repeating-linear-gradient(to bottom, #3a3a3a 0, #3a3a3a 1px, transparent 1px, transparent 90px)',
                          }}
                        >
                          <div className="absolute inset-0">
                            {dayLessons.map((lesson) => {
                              const startMins = timeToMinutes(lesson.startTime || '08:00');
                              const endMinsOriginal = timeToMinutes(lesson.endTime || lesson.startTime || '09:00');
                              // Clamp to schedule bounds (8 AM – 6 PM)
                              const clampedStart = Math.max(startMins, SCHEDULE_START);
                              const clampedEnd = Math.min(endMinsOriginal, SCHEDULE_END);
                              if (clampedStart >= SCHEDULE_END) return null; // skip if entirely after 6 PM
                              const top = (clampedStart - SCHEDULE_START) * PX_PER_MIN;
                              const height = Math.max(45, (clampedEnd - clampedStart) * PX_PER_MIN);
                              const color = getPillarColor(lesson.subject);
                              const leadInitials =
                                lesson.leads && lesson.leads.length > 0 ? getLeadInitials(lesson.leads) : '';

                              return (
                                <div
                                  key={lesson.id}
                                  className="absolute lesson group text-white text-[0.95rem] overflow-hidden cursor-pointer transition-transform hover:scale-105 hover:z-20"
                                  style={{
                                    top: `${top}px`,
                                    height: `${height}px`,
                                    left: 0,
                                    right: 0,
                                    padding: '4px 6px',
                                    background: '#222222',
                                    boxShadow: `inset 0 0 0 2px ${color}`,
                                  }}
                                  onClick={() => mode === 'template' && handleEditLesson(lesson)}
                                  title={lesson.name}
                                >
                                  {/* Time range */}
                                  <div className="text-[0.625rem] text-gray-300">
                                    {lesson.startTime && lesson.endTime
                                      ? `${formatTime(lesson.startTime)} - ${formatTime(lesson.endTime)}`
                                      : lesson.startTime
                                      ? formatTime(lesson.startTime)
                                      : `Day ${lesson.dayOffset + 1}`}
                                  </div>

                                  {/* Name & lead */}
                                  <div className="flex items-center justify-between space-x-2">
                                    <span className="font-medium text-[0.85rem] truncate leading-tight group-hover:whitespace-normal group-hover:overflow-visible">
                                      {lesson.name}
                                    </span>
                                    {leadInitials && (
                                      <span className="text-[0.625rem] text-gray-400">{leadInitials}</span>
                                    )}
                                  </div>

                                  {/* Subject pill */}
                                  {lesson.subject && (
                                    <div className="flex items-center justify-between mt-0.5">
                                      <span
                                        className="text-[0.6rem] font-semibold px-1 rounded-sm truncate max-w-[140px] group-hover:max-w-none"
                                        style={{ background: `${color}26`, color }}
                                      >
                                        {lesson.subject}
                                      </span>
                                    </div>
                                  )}

                                  {/* Delete button (template mode) */}
                                  {mode === 'template' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteLesson(lesson.id);
                                      }}
                                      className="absolute top-[2px] right-[2px] text-red-400 hover:text-red-300"
                                      title="Delete lesson"
                                    >
                                      &times;
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    );
  };

  const getLeadInitials = (leadsArr) => {
    if (!leadsArr || leadsArr.length === 0) return '';
    return leadsArr
      .slice(0, 2)
      .map((n) => {
        const parts = n.trim().split(' ');
        return parts[0][0] + (parts[parts.length - 1][0] || '');
      })
      .join(',');
  };

  // Convert 24-hour time to 12-hour AM/PM format
  const formatTime = (time24) => {
    if (!time24) return '';
    
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Convert time to minutes since start of day for positioning
  const timeToMinutes = (time24) => {
    if (!time24) return 0;
    const [hours, minutes] = time24.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Calculate lesson duration in minutes
  const getLessonDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 60; // Default 1 hour
    return timeToMinutes(endTime) - timeToMinutes(startTime);
  };

  // Color mapping for different pillars
  const getPillarColor = (subject) => {
    const pillarColors = {
      'Project Management': '#2563EB', // Bright Blue
      'Measurement': '#059669', // Emerald Green  
      'Process': '#7C3AED', // Bright Purple
      'People': '#D97706', // Orange
      'Brand MTKG': '#DC2626', // Red
      'Discovery': '#0891B2', // Cyan
      'Vision, Mission, and Values': '#DB2777', // Pink
      'Client Alignment & Project Control': '#65A30D', // Lime
      'LifeCycle': '#EA580C', // Orange
      'Professional Services': '#4F46E5', // Indigo
      'Introduction and Expectations': '#0D9488', // Teal
      'Role Playing': '#9333EA', // Violet
      'Technical': '#0284C7', // Sky Blue
      'Live Dialing': '#B91C1C', // Dark Red
      'Feedback': '#6B7280', // Gray (for feedback lessons)
    };
    
    // Return gray for lunch, homework, and other non-pillar lessons
    if (!subject || 
        subject.toLowerCase().includes('lunch') || 
        subject.toLowerCase().includes('homework') ||
        subject.toLowerCase().includes('feedback') ||
        !pillarColors[subject]) {
      return '#6B7280'; // Gray
    }
    
    return pillarColors[subject];
  };

  const captureWeeks = async () => {
    const weeks = Array.from(document.querySelectorAll('.print-week'));
    const imgs = [];
    for (const wk of weeks) {
      const canvas = await html2canvas(wk, { scale: 2, backgroundColor: '#1a1a1a' });
      imgs.push(canvas.toDataURL('image/png'));
    }
    return imgs;
  };

  const exportAsPDF = async () => {
    const weeks = Array.from(document.querySelectorAll('.print-week'));
    if (weeks.length === 0) {
      alert('No schedule content to export.');
      return;
    }

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      // Auto-detect width/height from the first week's canvas
    });

    for (let i = 0; i < weeks.length; i++) {
      const canvas = await html2canvas(weeks[i], { scale: 2.5, backgroundColor: '#1a1a1a' });
      const imgData = canvas.toDataURL('image/png');
      const imgProps = pdf.getImageProperties(imgData);

      // Scale image to fit page width
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      if (i > 0) {
        pdf.addPage();
      }
      
      // Set page dimensions based on scaled image
      pdf.internal.pageSize.setWidth(pdfWidth);
      pdf.internal.pageSize.setHeight(pdfHeight);

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    }
    
    pdf.save(`${selectedClassName || 'lesson-template'}-schedule.pdf`);
  };

  const backupTemplate = async () => {
    try {
      // Get current template data
      const response = await fetch('/api/config/lessons');
      if (!response.ok) {
        throw new Error('Failed to fetch template data');
      }
      
      const templateData = await response.json();
      
      // Create backup file
      const backupContent = JSON.stringify(templateData, null, 2);
      const blob = new Blob([backupContent], { type: 'application/json;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.setAttribute('download', `lesson-template-backup-${timestamp}.json`);
      
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      alert('✅ Template backup created successfully!');
      
    } catch (err) {
      alert(`❌ Backup failed: ${err.message}`);
    }
  };

  const syncToClickUp = async () => {
    if (!confirm('This will update the ClickUp template with your current lesson configuration. Continue?')) {
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await fetch('/api/sync/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ className: selectedClassName })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync template to ClickUp');
      }

      alert(`✅ ${result.message || 'Template synced to ClickUp successfully!'}`);
      
    } catch (err) {
      alert(`❌ Sync failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Helper: persist lessons to server
  const saveLessonsToServer = async (newLessons) => {
    try {
      setSaving(true);
      const endpoint = context==='template' ? '/api/config/lessons' : `/api/config/lessons/live/${encodeURIComponent(selectedClassName)}`;
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessons: newLessons })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Save failed');
      setHasChanges(false);
      setToast({ msg: 'Schedule updated', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.error('Auto-save error', err.message);
      setToast({ msg: `Save failed: ${err.message}`, type: 'error' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-slate-300">Loading lesson curriculum...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Lesson Editor</h2>
            <p className="text-slate-400">Manage your orientation curriculum and schedule</p>
          </div>
          <div className="flex items-center space-x-3">
            {/* View Mode Toggle */}
            <div className="bg-slate-700 rounded-lg p-1 flex">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'list'
                    ? 'bg-sky-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                📋 List
              </button>
              <button
                onClick={() => setViewMode('schedule')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'schedule'
                    ? 'bg-sky-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                📅 Schedule
              </button>
            </div>

            {hasChanges && (
              <div className="flex items-center space-x-2 text-orange-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-sm font-medium">Unsaved changes</span>
              </div>
            )}
            <button
              onClick={handleSaveLesson}
              disabled={!hasChanges || saving || mode === 'live'}
              className="bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
              title={mode === 'live' ? 'Cannot save in Live Mode' : 'Save template changes'}
            >
              {saving ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span>Save Changes</span>
                </>
              )}
            </button>
            <button
              onClick={handleAddLesson}
              disabled={mode === 'live'}
              className="bg-sky-600 hover:bg-sky-700 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
              title={mode === 'live' ? 'Cannot add lessons in Live Mode' : 'Add new lesson'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Lesson</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-slate-100">{lessons.length}</div>
            <div className="text-sm text-slate-400">Total Lessons</div>
          </div>
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-slate-100">{lessons.filter(l => l.week === 'Week 1 (Remote)').length}</div>
            <div className="text-sm text-slate-400">Week 1 (Remote)</div>
          </div>
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-slate-100">{lessons.filter(l => l.week === 'Week 2 (In Person)').length}</div>
            <div className="text-sm text-slate-400">Week 2 (In Person)</div>
          </div>
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-slate-100">{lessons.filter(l => l.isActive === false).length}</div>
            <div className="text-sm text-slate-400">Inactive</div>
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-900/50 border border-red-500 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-400 font-medium">Error: {error}</span>
            </div>
          </div>
        )}
      </div>

      {/* Mode Controls */}
      <div className="bg-slate-800 rounded-xl p-6 flex flex-wrap items-center gap-3">
        <div className="bg-slate-700 rounded-lg flex mr-3">
          <button className={`px-3 py-1 text-sm rounded-l-lg ${context==='template'?'bg-sky-600 text-white':'text-slate-300'}`} onClick={()=>setContext('template')}>Template</button>
          <button className={`px-3 py-1 text-sm rounded-r-lg ${context==='class'?'bg-sky-600 text-white':'text-slate-300'}`} onClick={()=>setContext('class')}>Class</button>
        </div>
        {context==='class' && classes.length>0 && (
          <div className="flex items-center mr-3">
            {classes.length>1 && (
              <select
                value={selectedClassName}
                onChange={(e) => setSelectedClassName(e.target.value)}
                className="bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 rounded-lg focus:ring-2 focus:ring-sky-400 focus:border-sky-400 mr-2"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            )}
            <span className="text-slate-300 text-sm">Editing&nbsp;
              <span className="font-semibold text-slate-100">{selectedClassName}</span>
            </span>
          </div>
        )}
        <button
          onClick={refreshData}
          className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center space-x-2"
          title="Refresh data"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Refresh</span>
        </button>

        <button
          onClick={exportAsPDF}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center space-x-2"
          title="Export schedule as PDF"
        >
          📄 Export PDF
        </button>

        <button
          onClick={() => backupTemplate()}
          className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center space-x-2"
          title="Backup template JSON"
        >
          🔒 Backup Template
        </button>

        <button
          onClick={syncToClickUp}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center space-x-2"
          title="Sync to ClickUp"
        >
          🔄 Sync to ClickUp
        </button>
      </div>

      {/* Filters */}
      <div className="bg-slate-800 rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search lessons..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition-all"
            />
          </div>

          {/* Week Filter */}
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 rounded-lg focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
          >
            <option value="all">All Weeks</option>
            {weekOptions.map(week => (
              <option key={week} value={week}>{week}</option>
            ))}
          </select>

          {/* Subject Filter */}
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 rounded-lg focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
          >
            <option value="all">All Subjects</option>
            {subjects.map(subject => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>

          {/* Results Count */}
          <div className="flex items-center text-slate-400">
            <span className="text-sm">
              Showing {filteredLessons.length} of {lessons.length} lessons
            </span>
          </div>
        </div>
      </div>

      {/* Lessons Display */}
      {viewMode === 'list' ? (
        <div className="bg-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Lessons</h3>
          
          {filteredLessons.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">📚</div>
              <p className="text-slate-400">No lessons found matching current filters</p>
            </div>
          ) : (
          <div className="space-y-3">
            {(showAllLessons ? filteredLessons : filteredLessons.slice(0, 10)).map((lesson, index) => (
              <div
                key={lesson.id}
                className={`bg-slate-700 rounded-lg p-4 border-l-4 ${
                  lesson.isActive ? 'border-sky-500' : 'border-slate-500 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="bg-slate-600 text-slate-300 px-2 py-1 rounded text-xs font-medium">
                        #{lesson.id}
                      </span>
                      <h4 className="font-semibold text-slate-100">{lesson.name}</h4>
                      {lesson.subject && (
                        <span className="bg-purple-600 text-purple-100 px-2 py-1 rounded text-xs">
                          {lesson.subject}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-4 text-xs text-slate-500">
                      <span>{lesson.week} • {lesson.weekDay}</span>
                      <span>Day {lesson.dayOffset + 1}</span>
                      {lesson.startTime && (
                        <span>{formatTime(lesson.startTime)}{lesson.endTime?` – ${formatTime(lesson.endTime)}`:''}</span>
                      )}
                      {lesson.leads && lesson.leads.length > 0 && (
                        <span>Leads: {lesson.leads.join(', ')}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    {mode === 'live' ? (
                      // Live mode - show ClickUp link if available
                      <div className="flex items-center space-x-2">
                        {lesson.clickup?.url && (
                          <a
                            href={lesson.clickup.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-green-400 hover:text-green-300"
                            title="Open in ClickUp"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                        <span className="text-slate-500 text-xs px-2 py-1 rounded bg-slate-700">Read-only</span>
                      </div>
                    ) : (
                      // Template mode - show edit/delete buttons
                      <>
                        <button
                          onClick={() => handleEditLesson(lesson)}
                          className="p-1 text-sky-400 hover:text-sky-300"
                          title="Edit lesson"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>

                        <button
                          onClick={() => handleDeleteLesson(lesson.id)}
                          className="p-1 text-red-400 hover:text-red-300"
                          title="Delete lesson"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filteredLessons.length > 10 && (
              <div className="text-center py-4">
                <button
                  onClick={() => setShowAllLessons(!showAllLessons)}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-slate-100 px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 mx-auto"
                >
                  {showAllLessons ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                      <span>Show Less</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      <span>Show All {filteredLessons.length} Lessons</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
        </div>
      ) : (
        // Schedule View
        renderScheduleView()
      )}

      {/* Add/Edit Modal */}
      {showAddModal && editingLesson && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-100">
                  {editingLesson.id && lessons.find(l => l.id === editingLesson.id) ? 'Edit Lesson' : 'Add New Lesson'}
                </h3>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingLesson(null);
                  }}
                  className="text-slate-400 hover:text-slate-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Lesson Name *
                  </label>
                  <input
                    type="text"
                    value={editingLesson.name}
                    onChange={(e) => setEditingLesson({...editingLesson, name: e.target.value})}
                    className="w-full bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 rounded-lg focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
                    placeholder="Enter lesson name"
                  />
                </div>

                {/* Week & Day */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Week
                    </label>
                    <select
                      value={editingLesson.week}
                      onChange={(e) => setEditingLesson({...editingLesson, week: e.target.value})}
                      className="w-full bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 rounded-lg focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
                    >
                      {weekOptions.map(week => (
                        <option key={week} value={week}>{week}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Day
                    </label>
                    <select
                      value={editingLesson.weekDay}
                      onChange={(e) => setEditingLesson({...editingLesson, weekDay: e.target.value})}
                      className="w-full bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 rounded-lg focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
                    >
                      {dayOptions.map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Day Offset
                    </label>
                    <input
                      type="number"
                      value={editingLesson.dayOffset}
                      readOnly
                      disabled
                      className="w-full bg-slate-700/50 border border-slate-600 text-slate-400 px-3 py-2 rounded-lg cursor-not-allowed"
                      title="Day Offset is automatically calculated based on Week & Day"
                    />
                  </div>
                </div>

                {/* Start & End Times */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={editingLesson.startTime || ''}
                      onChange={(e)=>setEditingLesson({...editingLesson,startTime:e.target.value})}
                      className="w-full bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 rounded-lg focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={editingLesson.endTime || ''}
                      onChange={(e)=>setEditingLesson({...editingLesson,endTime:e.target.value})}
                      className="w-full bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 rounded-lg focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
                    />
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Subject
                  </label>
                  <select
                    value={editingLesson.subject || ''}
                    onChange={(e) => setEditingLesson({...editingLesson, subject: e.target.value})}
                    className="w-full bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 rounded-lg focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
                  >
                    <option value="">Select Subject (Optional)</option>
                    {subjects.map(subject => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </select>
                </div>

                {/* Leads */}
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">Leads</label>
                  {/* Selected chips */}
                  {editingLesson.leads && editingLesson.leads.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {editingLesson.leads.map(lead => (
                        <span key={lead} className="flex items-center bg-sky-700 text-sky-100 px-2 py-1 rounded-full text-xs">
                          {lead}
                          <button
                            onClick={() => {
                              setEditingLesson({
                                ...editingLesson,
                                leads: editingLesson.leads.filter(l => l !== lead)
                              });
                            }}
                            className="ml-1 text-slate-300 hover:text-white"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Scrollable checkbox list */}
                  <div className="border border-slate-600 rounded-lg h-40 overflow-y-auto bg-slate-700 divide-y divide-slate-600">
                    {instructors.map(inst => {
                      const checked = (editingLesson.leads || []).includes(inst.name);
                      return (
                        <label
                          key={inst.name}
                          className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-slate-600 ${checked ? 'bg-slate-600' : ''}`}
                        >
                          <span className="text-sm text-slate-100">{inst.name}</span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              let leads = editingLesson.leads || [];
                              if (checked) {
                                leads = leads.filter(l => l !== inst.name);
                              } else {
                                leads = [...leads, inst.name];
                              }
                              setEditingLesson({ ...editingLesson, leads });
                            }}
                            className="form-checkbox h-4 w-4 text-sky-500 bg-slate-800 border-slate-500 rounded"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-slate-700">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingLesson(null);
                  }}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveLesson}
                  className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Save Lesson
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-4 py-3 rounded shadow-lg text-sm ${toast.type==='success'?'bg-emerald-600 text-white':'bg-red-600 text-white'}`}>{toast.msg}</div>
      )}
    </div>
  );
}

export default LessonEditor; 