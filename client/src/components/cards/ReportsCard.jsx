import React, { useState, useEffect } from 'react';

function ReportsCard({ classes, selectedClass }) {
  const [generatingReport, setGeneratingReport] = useState(null); // Track which report type is generating
  const [progress, setProgress] = useState(0);
  const [reportClass, setReportClass] = useState(selectedClass || '');

  // Simulate progress during report generation
  useEffect(() => {
    if (!generatingReport) {
      setProgress(0);
      return;
    }

    const duration = 8000; // 8 seconds estimated for report generation
    const interval = 100; // Update every 100ms
    const increment = (interval / duration) * 100;
    
    const timer = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + increment;
        if (newProgress >= 95) {
          clearInterval(timer);
          return 95; // Stop at 95% until actual completion
        }
        return newProgress;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [generatingReport]);

  const handleGenerateReport = async (reportType) => {
    if (!reportClass) {
      alert('Please select a class first');
      return;
    }

    setGeneratingReport(reportType);
    setProgress(0);
    
    try {
      const response = await fetch(`/api/generate-report?className=${encodeURIComponent(reportClass)}&type=${reportType}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Report generation failed: ${errorText}`);
      }
      
      // Complete the progress bar
      setProgress(100);
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${reportType}-${reportClass.replace(/\s+/g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      // Brief delay to show 100% completion
      setTimeout(() => {
        setGeneratingReport(null);
        setProgress(0);
      }, 500);
    } catch (err) {
      alert(err.message);
      setGeneratingReport(null);
      setProgress(0);
    }
  };

  const reportOptions = [
    { type: 'full', title: 'Full Report', description: 'Complete summary with all details', color: 'bg-sky-600 hover:bg-sky-700' },
    { type: 'roster', title: 'Roster Only', description: 'Simple list of orientees', color: 'bg-slate-600 hover:bg-slate-700' },
    { type: 'grades', title: 'Grades & Feedback', description: 'Detailed grades and feedback', color: 'bg-purple-600 hover:bg-purple-700' },
  ];

  // Update local reportClass when selectedClass changes
  React.useEffect(() => {
    if (selectedClass && !reportClass) {
      setReportClass(selectedClass);
    }
  }, [selectedClass, reportClass]);

  return (
    <div className="bg-slate-800 shadow-lg rounded-xl">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Reports</h2>
            <p className="text-slate-400 text-sm mt-1">Generate PDF reports for any class</p>
          </div>
          <div className="text-2xl">📊</div>
        </div>

        <div className="space-y-4">
          {/* Class Selector */}
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Select Class:
            </label>
            <div className="relative">
              <select
                value={reportClass}
                onChange={(e) => setReportClass(e.target.value)}
                className="w-full bg-slate-700/80 border border-slate-500 text-slate-100 px-3 py-2 rounded-lg focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition-all duration-200 appearance-none pr-10"
              >
                <option value="" className="bg-slate-800 text-slate-300">Choose a class...</option>
                {classes.map(cls => (
                  <option key={cls.id} value={cls.name} className="bg-slate-800 text-slate-100">
                    {cls.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Report Buttons */}
          <div className="space-y-2">
            {reportOptions.map(report => {
              const isThisReportGenerating = generatingReport === report.type;
              const isAnyReportGenerating = generatingReport !== null;
              
              return (
                <button
                  key={report.type}
                  onClick={() => handleGenerateReport(report.type)}
                  disabled={isAnyReportGenerating || !reportClass}
                  className={`w-full ${isThisReportGenerating ? 'bg-sky-600' : report.color} disabled:bg-slate-600 text-white py-3 px-4 rounded-lg transition-colors text-left relative overflow-hidden`}
                >
                  {/* Progress bar background */}
                  {isThisReportGenerating && (
                    <div 
                      className="absolute inset-0 bg-sky-400/30 transition-all duration-200 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  )}
                  
                  <div className="flex items-center justify-between relative z-10">
                    <div>
                      <h4 className="font-semibold text-sm">{report.title}</h4>
                      <p className="text-xs opacity-90">{report.description}</p>
                    </div>
                    {isThisReportGenerating ? (
                      <div className="text-right">
                        <div className="text-xs font-semibold">Generating...</div>
                        <div className="text-xs opacity-75">{Math.round(progress)}%</div>
                      </div>
                    ) : (
                      <div className="text-lg">→</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {reportClass && (
            <div className="bg-slate-700/30 p-3 rounded-lg">
              <p className="text-slate-400 text-xs">
                <strong>Selected:</strong> {reportClass}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReportsCard; 