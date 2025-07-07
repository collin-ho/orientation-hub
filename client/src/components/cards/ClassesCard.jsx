import React from 'react';

function ClassesCard({ classes, loading, error, selectedClass, setSelectedClass, onViewDetails, onManageSchedule }) {

  // Extract start date from class name (e.g., "PD OTN 06.09.25" -> Date object)
  const parseClassStartDate = (className) => {
    // First try MM.DD.YY format (e.g., "PD OTN 06.09.25" = June 9, 2025)
    const shortMatch = className.match(/PD OTN (\d{2})\.(\d{2})\.(\d{2})/);
    if (shortMatch) {
      const [, month, day, year] = shortMatch;
      // Convert 2-digit year to 4-digit (assuming 20xx)
      const fullYear = 2000 + parseInt(year);
      // Month is 1-indexed in the string but 0-indexed in Date constructor
      return new Date(fullYear, parseInt(month) - 1, parseInt(day));
    }
    
    // Fallback to old M.D.YY format (e.g., "PD OTN 6.9.25") for backward compatibility
    const oldMatch = className.match(/PD OTN (\d{1,2})\.(\d{1,2})\.(\d{2})/);
    if (oldMatch) {
      const [, month, day, year] = oldMatch;
      // Convert 2-digit year to 4-digit (assuming 20xx)
      const fullYear = 2000 + parseInt(year);
      // Month is 1-indexed in the string but 0-indexed in Date constructor
      return new Date(fullYear, parseInt(month) - 1, parseInt(day));
    }
    
    // Fallback to YYYY-MM-DD format (e.g., "PD OTN 2025-06-09")
    const longMatch = className.match(/PD OTN (\d{4}-\d{2}-\d{2})/);
    if (longMatch) {
      return new Date(longMatch[1] + 'T00:00:00'); // Parse as local date
    }
    
    return null;
  };

  // Calculate class end date (9 business days: Week 1 Mon-Fri, Week 2 Mon-Thu)
  const calculateEndDate = (startDate) => {
    if (!startDate) return null;
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 11); // 11 calendar days later (Thursday of week 2)
    return endDate;
  };

  // Determine class status based on current date
  const getClassStatus = (className) => {
    const startDate = parseClassStartDate(className);
    if (!startDate) return 'unknown';
    
    const endDate = calculateEndDate(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for comparison
    
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Set to end of day
    
    if (today < start) return 'future';
    if (today > end) return 'past';
    return 'active';
  };

  // Get status-specific styling
  const getStatusStyles = (status) => {
    switch (status) {
      case 'active':
        return {
          dot: 'bg-green-400',
          badge: 'bg-green-600/20 text-green-400 border-green-400/30',
          text: 'In Progress'
        };
      case 'future':
        return {
          dot: 'bg-blue-400',
          badge: 'bg-blue-600/20 text-blue-400 border-blue-400/30',
          text: 'Upcoming'
        };
      case 'past':
        return {
          dot: 'bg-slate-400',
          badge: 'bg-slate-600/20 text-slate-400 border-slate-400/30',
          text: 'Completed'
        };
      default:
        return {
          dot: 'bg-gray-400',
          badge: 'bg-gray-600/20 text-gray-400 border-gray-400/30',
          text: 'Unknown'
        };
    }
  };

  // Sort classes by status priority and then by date
  const sortClassesByStatus = (classes) => {
    const statusOrder = { 'active': 0, 'future': 1, 'past': 2, 'unknown': 3 };
    
    return [...classes].sort((a, b) => {
      const statusA = getClassStatus(a.name);
      const statusB = getClassStatus(b.name);
      
      // First sort by status priority
      const statusDiff = statusOrder[statusA] - statusOrder[statusB];
      if (statusDiff !== 0) return statusDiff;
      
      // Then sort by date (newest first for past, oldest first for future/active)
      const dateA = parseClassStartDate(a.name);
      const dateB = parseClassStartDate(b.name);
      
      if (!dateA || !dateB) return 0;
      
      if (statusA === 'past') {
        return dateB - dateA; // Newest first for past classes
      } else {
        return dateA - dateB; // Oldest first for active/future classes
      }
    });
  };

  // === Live class summary fetching ===
  // Cache summaries to avoid refetching on every re-render
  const [classSummaries, setClassSummaries] = React.useState({}); // { className: summary }
  const [classOrientees, setClassOrientees] = React.useState({}); // { className: [ {name,status,pillar} ] }

  const fetchClassSummary = async (className) => {
    try {
      const resp = await fetch(`/api/class/${encodeURIComponent(className)}/summary`);
      const data = await resp.json();
      if (data.success) {
        setClassSummaries((prev) => ({ ...prev, [className]: data }));
      }
    } catch (err) {
      console.warn('Failed to fetch summary for', className, err.message);
    }
  };

  // When a class is selected (expanded), make sure we have its summary
  React.useEffect(() => {
    if (selectedClass && !classSummaries[selectedClass]) {
      fetchClassSummary(selectedClass);
    }
    if (selectedClass && !classOrientees[selectedClass]) {
      (async () => {
        try {
          const resp = await fetch(`/api/class/${encodeURIComponent(selectedClass)}/orientees`);
          const data = await resp.json();
          if (data.success) {
            setClassOrientees(prev => ({ ...prev, [selectedClass]: data.orientees }));
          }
        } catch (err) {
          console.warn('Failed to fetch orientees for', selectedClass, err.message);
        }
      })();
    }
  }, [selectedClass]);

  // Calculate status counts (active/future/past) for header badges
  const getStatusCounts = (classesArr) => {
    return classesArr.reduce((counts, cls) => {
      const status = getClassStatus(cls.name);
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});
  };

  const sortedClasses = sortClassesByStatus(classes);
  const statusCounts = getStatusCounts(classes);

  const getStatusDotColor = status => {
    switch ((status || '').toLowerCase()) {
      case 'graduated':
        return 'bg-green-400';
      case 'resigned':
        return 'bg-yellow-400';
      case 'released':
        return 'bg-red-400';
      default:
        return 'bg-slate-400';
    }
  };

  return (
    <div className="lg:col-span-2 bg-slate-800 shadow-lg rounded-xl">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Orientation Classes</h2>
            <p className="text-slate-400 mt-1">Manage active, past & future orientation classes</p>
          </div>
          <div className="flex items-center space-x-2">
            {/* Status count badges */}
            {statusCounts.active > 0 && (
              <div className="bg-green-600/20 text-green-400 px-2 py-1 rounded-full text-xs font-medium border border-green-400/30">
                {statusCounts.active} Active
              </div>
            )}
            {statusCounts.future > 0 && (
              <div className="bg-blue-600/20 text-blue-400 px-2 py-1 rounded-full text-xs font-medium border border-blue-400/30">
                {statusCounts.future} Future
              </div>
            )}
            <div className="bg-sky-600 text-white px-3 py-1 rounded-full text-sm font-medium">
              {classes.length} Total
            </div>
          </div>
        </div>

        {loading && <p className="text-slate-400">Loading classes...</p>}
        {error && <p className="text-red-400">Error: {error}</p>}
        
        {!loading && !error && (
          <div className="space-y-3">
            {sortedClasses.length > 0 ? (
              sortedClasses.map(cls => {
                const status = getClassStatus(cls.name);
                const styles = getStatusStyles(status);
                
                return (
                  <div key={cls.id} className="bg-slate-700/50 rounded-lg">
                    <div 
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-700/70 transition-colors rounded-lg"
                      onClick={() => setSelectedClass(selectedClass === cls.name ? null : cls.name)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 ${styles.dot} rounded-full`}></div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-slate-200">{cls.name}</span>
                          <div className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles.badge}`}>
                            {styles.text}
                          </div>
                        </div>
                      </div>
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className={`h-5 w-5 text-slate-400 transition-transform ${selectedClass === cls.name ? 'rotate-180' : ''}`} 
                        viewBox="0 0 20 20" 
                        fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>

                    {selectedClass === cls.name && (
                      <div className="px-4 pb-4">
                        <div className="bg-slate-700/30 p-4 rounded-lg mt-4">
                          {/* Show real summary if available, else fallback to loading/placeholder */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            {(() => {
                              const summary = classSummaries[cls.name];
                              if (!summary) {
                                // Loading placeholder
                                return (
                                  <div className="col-span-4 text-center text-slate-400 text-sm">Loading summary…</div>
                                );
                              }
                              return (
                                <>
                                  <div className="text-center">
                                    <p className="text-2xl font-bold text-slate-300">{summary.total}</p>
                                    <p className="text-xs text-slate-400">Total</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-2xl font-bold text-green-400">{summary.graduated}</p>
                                    <p className="text-xs text-slate-400">Graduated</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-2xl font-bold text-yellow-400">{summary.resigned}</p>
                                    <p className="text-xs text-slate-400">Resigned</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-2xl font-bold text-red-400">{summary.released}</p>
                                    <p className="text-xs text-slate-400">Released</p>
                                  </div>
                                </>
                              );
                            })()}
                          </div>

                          {/* Live Orientees List */}
                          {(() => {
                            const orients = classOrientees[cls.name];
                            if (!orients) return (
                              <div className="text-slate-400 text-sm">Loading orientees…</div>
                            );
                            if (orients.length === 0) return (
                              <div className="text-slate-400 text-sm">No orientees found.</div>
                            );
                            return (
                              <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-slate-300 mb-2">Orientees:</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                                  {orients.map((o,idx)=>(
                                    <div key={idx} className="flex items-center space-x-2 py-1">
                                      <div className={`w-2 h-2 ${getStatusDotColor(o.status)} rounded-full flex-shrink-0`}></div>
                                      <span className="text-slate-300 font-medium truncate max-w-[120px]" title={o.name}>{o.name}</span>
                                      <span className="text-slate-500">- {o.pillar}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}

                          <div className="mt-4 flex justify-end space-x-2">
                            <button
                                onClick={() => onManageSchedule(cls.name)}
                                className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded-md text-sm font-medium"
                            >
                                Manage Schedule
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-400">No classes found.</p>
                <button className="mt-2 text-sky-400 hover:text-sky-300">
                  Create your first class →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ClassesCard; 