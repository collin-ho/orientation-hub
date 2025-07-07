import React, { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

function LessonEditor() {
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

  // Template vs Live mode
  const [mode, setMode] = useState('template'); // 'template' or 'live'
  const [availableClasses, setAvailableClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [dataSource, setDataSource] = useState('Template');
  const [lastSync, setLastSync] = useState(null);

  // UI controls
  const [showAllLessons, setShowAllLessons] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'schedule'

  // Available options for dropdowns
  const [subjects, setSubjects] = useState([]);
  const [instructors, setInstructors] = useState([]);

  useEffect(() => {
    loadReferenceData();
    loadAvailableClasses();
    loadLessons();
  }, []);

  useEffect(() => {
    if (mode === 'live' && selectedClass) {
      loadLiveLessons();
    } else if (mode === 'template') {
      loadTemplateLessons();
    }
  }, [mode, selectedClass]);

  const loadLessons = async () => {
    if (mode === 'template') {
      await loadTemplateLessons();
    } else if (mode === 'live' && selectedClass) {
      await loadLiveLessons();
    }
  };

  const loadTemplateLessons = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load template lessons from config API
      const response = await fetch('/api/config/lessons');
      if (!response.ok) {
        throw new Error(`Failed to load template lessons: ${response.statusText}`);
      }
      
      const data = await response.json();
      setLessons(data.lessons || []);
      setDataSource('Template');
      setLastSync(new Date());
      
    } catch (err) {
      setError(err.message);
      setLessons([]);
    } finally {
      setLoading(false);
    }
  };

  const loadLiveLessons = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load live lessons from ClickUp class
      const response = await fetch(`/api/config/lessons/live/${encodeURIComponent(selectedClass)}`);
      if (!response.ok) {
        throw new Error(`Failed to load live lessons: ${response.statusText}`);
      }
      
      const data = await response.json();
      setLessons(data.lessons || []);
      setDataSource(`ClickUp: ${selectedClass}`);
      setLastSync(new Date());
      
    } catch (err) {
      setError(err.message);
      setLessons([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableClasses = async () => {
    try {
      const response = await fetch('/api/config/lessons/live-classes');
      if (response.ok) {
        const data = await response.json();
        setAvailableClasses(data.classes || []);
        
        // Auto-select first non-template class if available
        const nonTemplateClasses = data.classes.filter(c => !c.isTemplate);
        if (nonTemplateClasses.length > 0 && !selectedClass) {
          setSelectedClass(nonTemplateClasses[0].name);
        }
      }
    } catch (err) {
      console.warn('Could not load available classes:', err.message);
    }
  };

  const loadReferenceData = async () => {
    try {
      // Load subjects and instructors for dropdowns
      const [subjectsRes, instructorsRes] = await Promise.all([
        fetch('/api/config/subjects'),
        fetch('/api/config/users/instructors')
      ]);
      
      if (subjectsRes.ok) {
        const subjectData = await subjectsRes.json();
        setSubjects(subjectData.subjects || []);
      }
      
      if (instructorsRes.ok) {
        const instructorData = await instructorsRes.json();
        setInstructors(instructorData || []);
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
    if (mode === 'live') {
      setError('Cannot add lessons in Live Mode. Switch to Template Mode to edit curriculum.');
      return;
    }

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
    if (mode === 'live') {
      setError('Cannot edit lessons in Live Mode. This is read-only data from ClickUp.');
      return;
    }

    setEditingLesson({ ...lesson });
    setShowAddModal(true);
  };

  const handleSaveLesson = () => {
    if (!editingLesson.name.trim()) {
      alert('Lesson name is required');
      return;
    }

    const updatedLessons = editingLesson.id && lessons.find(l => l.id === editingLesson.id)
      ? lessons.map(l => l.id === editingLesson.id ? editingLesson : l)
      : [...lessons, editingLesson];

    setLessons(updatedLessons);
    setHasChanges(true);
    setShowAddModal(false);
    setEditingLesson(null);
  };

  const handleDeleteLesson = (lessonId) => {
    if (confirm('Are you sure you want to delete this lesson?')) {
      setLessons(lessons.filter(l => l.id !== lessonId));
      setHasChanges(true);
    }
  };

  const handleSaveChanges = async () => {
    if (mode === 'live') {
      setError('Cannot save changes in Live Mode. Switch to Template Mode to edit lessons.');
      return;
    }

    try {
      setSaving(true);
      
      const response = await fetch('/api/config/lessons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessons })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save lesson changes');
      }

      setHasChanges(false);
      alert(result.message || 'Lessons saved successfully!');
      
    } catch (err) {
      alert(`Error saving lessons: ${err.message}`);
    } finally {
      setSaving(false);
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
    if (mode === 'template') {
      await loadTemplateLessons();
    } else if (mode === 'live' && selectedClass) {
      // Clear cache first, then reload
      try {
        await fetch('/api/config/lessons/clear-cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ className: selectedClass })
        });
      } catch (err) {
        console.warn('Failed to clear cache:', err.message);
      }
      await loadLiveLessons();
    }
  };

  const compareLessons = async () => {
    if (!selectedClass) {
      setError('Please select a class to compare with');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/config/lessons/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ className: selectedClass })
      });

      if (!response.ok) {
        throw new Error(`Failed to compare lessons: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Show comparison results in a modal or alert
      const { comparison } = data;
      const diffCount = comparison.differences.length;
      
      if (diffCount === 0) {
        alert('✅ No differences found! Template and live lessons are in sync.');
      } else {
        const summary = comparison.differences
          .map(d => `• ${d.description}`)
          .join('\n');
        
        alert(`🔍 Found ${diffCount} difference(s):\n\n${summary}`);
      }
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
      wk.scrollIntoView({ behavior: 'instant', block: 'center' });
      await new Promise(res => setTimeout(res, 150));
      const canvas = await html2canvas(wk, { backgroundColor: '#ffffff', scale: 2 });
      imgs.push({ src: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height });
    }
    return imgs;
  };

  const exportAsImages = async () => {
    const images = await captureWeeks();
    images.forEach((img, idx) => {
      const link = document.createElement('a');
      link.download = `orientation-week-${idx + 1}.png`;
      link.href = img.src;
      link.click();
    });
  };

  const exportAsPDF = async () => {
    const images = await captureWeeks();
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [792, 612] });
    images.forEach((imgObj, idx) => {
      if (idx !== 0) pdf.addPage();
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgRatio = imgObj.w / imgObj.h;
      const pageRatio = pageW / pageH;
      let targetW, targetH;
      if (imgRatio > pageRatio) {
        targetW = pageW;
        targetH = targetW / imgRatio;
      } else {
        targetH = pageH;
        targetW = targetH * imgRatio;
      }
      const offsetX = (pageW - targetW) / 2;
      const offsetY = (pageH - targetH) / 2;
      pdf.addImage(imgObj.src, 'PNG', offsetX, offsetY, targetW, targetH);
    });
    pdf.save('orientation-schedule.pdf');
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
      
      const response = await fetch('/api/config/lessons/sync-to-clickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessons })
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
    
    return (
      <div className="space-y-8 overflow-x-auto">
        {weekOrder.map(week => {
          if (!schedule[week]) return null;
          
          return (
            <div key={week} className="print-week bg-slate-700 rounded-xl p-6" style={{ width: '1800px' }}>
              <h3 className="text-xl font-bold text-slate-100 mb-6 flex items-center">
                <span className="mr-3">{week === 'Week 1 (Remote)' ? '💻' : '🏢'}</span>
                {week}
                <span className="ml-3 text-sm font-normal text-slate-400">
                  ({Object.values(schedule[week]).reduce((total, dayLessons) => total + dayLessons.length, 0)} lessons)
                </span>
              </h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {dayOrder.map(day => {
                  const dayLessons = schedule[week]?.[day] || [];
                  const isWeek2Thursday = week === 'Week 2 (In Person)' && day === 'Fri';
                  
                  // Skip Friday for Week 2 (only goes Mon-Thu)
                  if (isWeek2Thursday) return null;
                  
                  return (
                    <div key={day} className="bg-slate-800 rounded-lg overflow-hidden shadow-lg border border-slate-600">
                      <h4 className="font-semibold text-slate-100 text-center bg-gradient-to-r from-slate-700 to-slate-600 p-3 border-b border-slate-600">
                        {day}
                        <span className="block text-xs text-slate-400 mt-1">
                          {dayLessons.length} lesson{dayLessons.length !== 1 ? 's' : ''}
                        </span>
                      </h4>
                      
                      <div
                        className="grid p-3 bg-slate-900"
                        style={{
                          gridTemplateRows: 'repeat(28, 32px)',
                          minHeight: '896px',
                          overflowY: 'auto',
                          gap: '2px',
                          backgroundImage:
                            'repeating-linear-gradient(0deg, transparent, transparent 17px, rgba(71,85,105,0.3) 18px)'
                        }}
                      >
                        {dayLessons.length === 0 ? (
                          <div className="text-center py-8">
                            <div className="text-slate-500 text-xs">No lessons</div>
                          </div>
                        ) : (
                          dayLessons.map((lesson) => {
                            const pillarColor = getPillarColor(lesson.subject);
                            const startMinutes = timeToMinutes(lesson.startTime || '08:00');
                            const endMinutes = timeToMinutes(lesson.endTime || '09:00');
                            const rowStart = Math.max(1, Math.floor((startMinutes - 480) / 30) + 1);
                            const span = Math.max(1, Math.ceil((endMinutes - startMinutes) / 30));
                            return (
                              <div
                                key={lesson.id}
                                className="rounded-lg border-l-4 transition-all duration-200 hover:scale-105 hover:z-10 hover:shadow-xl"
                                style={{
                                  gridRow: `${rowStart} / span ${span}`,
                                  backgroundColor: `${pillarColor}15`,
                                  borderColor: pillarColor,
                                  borderWidth: '0 0 0 4px',
                                  borderStyle: 'solid',
                                  boxShadow: `0 1px 3px ${pillarColor}30`,
                                  background: `linear-gradient(135deg, ${pillarColor}15 0%, ${pillarColor}08 100%)`,
                                  padding: '4px'
                                }}
                              >
                                <div className="flex items-center text-[9px] font-bold mb-[1px]" style={{ color: pillarColor }}>
                                  <span>
                                    {lesson.startTime && lesson.endTime 
                                      ? `${formatTime(lesson.startTime)} - ${formatTime(lesson.endTime)}`
                                      : `Day ${lesson.dayOffset + 1}`}
                                  </span>
                                  {lesson.subject && (
                                    <span 
                                      className="ml-1 px-[3px] rounded inline-block font-medium text-[7px]" 
                                      style={{ backgroundColor: `${pillarColor}25`, color: pillarColor }}>
                                      {lesson.subject}
                                    </span>)
                                  }
                                  {lesson.leads && lesson.leads.length > 0 && (
                                    <span className="ml-1 text-slate-300" title={lesson.leads.join(', ')}>
                                      {getLeadInitials(lesson.leads)}
                                    </span> )}
                                </div>
                                <div className="font-semibold text-slate-100 mb-[1px] leading-tight text-[9px]">
                                  {lesson.name}
                                </div>

                                {/* Action buttons for template mode */}
                                {mode === 'template' && (
                                  <div className="flex justify-end space-x-1 mt-1 pt-1" style={{ borderTop: `1px solid ${pillarColor}30` }}>
                                    <button
                                      onClick={() => handleEditLesson(lesson)}
                                      className="p-1 hover:scale-110 transition-transform"
                                      style={{ color: `${pillarColor}CC` }}
                                      title="Edit lesson"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => handleDeleteLesson(lesson.id)}
                                      className="p-1 text-red-400 hover:text-red-300 hover:scale-110 transition-all"
                                      title="Delete lesson"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        
        {Object.keys(schedule).length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📅</div>
            <h3 className="text-xl font-semibold text-slate-100 mb-2">No lessons to display</h3>
            <p className="text-slate-400">Adjust your filters or add some lessons to see the schedule.</p>
          </div>
        )}
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
              onClick={handleSaveChanges}
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
      <div className="bg-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-6">
            {/* Mode Toggle */}
            <div className="flex items-center space-x-3">
              <span className="text-slate-300 font-medium">Data Source:</span>
              <div className="bg-slate-700 rounded-lg p-1 flex">
                <button
                  onClick={() => handleModeChange('template')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    mode === 'template'
                      ? 'bg-sky-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  📋 Template
                </button>
                <button
                  onClick={() => handleModeChange('live')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    mode === 'live'
                      ? 'bg-green-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🔗 Live ClickUp
                </button>
              </div>
            </div>

            {/* Live Mode Class Selection */}
            {mode === 'live' && (
              <div className="flex items-center space-x-3">
                <span className="text-slate-300">Class:</span>
                <select
                  value={selectedClass}
                  onChange={(e) => handleClassChange(e.target.value)}
                  className="bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-green-400"
                >
                  <option value="">Select a class...</option>
                  {availableClasses.map(cls => (
                    <option key={cls.id} value={cls.name}>
                      {cls.name} {cls.isTemplate ? '(Template)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
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

            {mode === 'live' && selectedClass && (
              <button
                onClick={compareLessons}
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center space-x-2"
                title="Compare with template"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Compare</span>
              </button>
            )}

            <button
              onClick={exportAsPDF}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center space-x-2"
              title="Export as PDF (captures weeks as images)"
            >
              <span>📄 Export PDF</span>
            </button>
            <button
              onClick={exportAsImages}
              className="bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center space-x-2"
              title="Export as clean PNG images (and combined PDF)"
            >
              <span>🖼️ Export Image</span>
            </button>

            {/* Template Management Buttons - Only show in template mode */}
            {mode === 'template' && (
              <>
                <button
                  onClick={() => backupTemplate()}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center space-x-2"
                  title="Backup template"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span>Backup</span>
                </button>

                <button
                  onClick={() => syncToClickUp()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center space-x-2"
                  title="Sync template to ClickUp"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Sync to ClickUp</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Data Source Info */}
        <div className="bg-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`w-2 h-2 rounded-full ${mode === 'template' ? 'bg-sky-400' : 'bg-green-400'}`}></div>
              <span className="text-slate-300 font-medium">Source: {dataSource}</span>
            </div>
            {lastSync && (
              <span className="text-slate-500 text-sm">
                Last sync: {lastSync.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
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
                      min="0"
                      max="10"
                      value={editingLesson.dayOffset}
                      onChange={(e) => setEditingLesson({...editingLesson, dayOffset: parseInt(e.target.value)})}
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
    </div>
  );
}

export default LessonEditor; 