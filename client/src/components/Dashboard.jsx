import React, { useState, useEffect } from 'react';

// Import individual card components (we'll create these)
import ClassesCard from './cards/ClassesCard';
import ScheduleCard from './cards/ScheduleCard';
import NewClassCard from './cards/NewClassCard';
import ClassDetailsCard from './cards/ClassDetailsCard';
import FeedbackCard from './cards/FeedbackCard';
import ReportsCard from './cards/ReportsCard';
import ClassDetailView from './ClassDetailView';
import ConfigurationPanel from './ConfigurationPanel';

function Dashboard() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [detailViewClass, setDetailViewClass] = useState(null);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    async function fetchClasses() {
      try {
        setLoading(true);
        const response = await fetch('/api/classes');
        if (!response.ok) {
          throw new Error('Failed to fetch data from the server.');
        }
        const data = await response.json();
        setClasses(data);
        setError(null);
      } catch (err) {
        setError(err.message);
        setClasses([]);
      } finally {
        setLoading(false);
      }
    }

    fetchClasses();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-slate-100 tracking-tight">Orientation Hub</h1>
          <p className="text-slate-400 mt-2 text-lg">Complete control center for PD Orientation classes</p>
          
          {selectedClass && (
            <div className="mt-4 inline-flex items-center px-4 py-2 bg-sky-600 text-white rounded-lg">
              <span className="text-sm font-medium">Active Class: {selectedClass}</span>
              <button
                onClick={() => setSelectedClass(null)}
                className="ml-2 hover:text-sky-200"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          
          {/* Classes Management Card */}
          <ClassesCard 
            classes={classes}
            loading={loading}
            error={error}
            selectedClass={selectedClass}
            setSelectedClass={setSelectedClass}
            onViewDetails={setDetailViewClass}
          />

          {/* Quick Reports Card */}
          <ReportsCard 
            classes={classes}
            selectedClass={selectedClass}
          />

          {/* New Class Card */}
          <NewClassCard 
            onClassCreated={async () => {
              // Refresh classes list
              try {
                setLoading(true);
                const response = await fetch('/api/classes');
                if (response.ok) {
                  const data = await response.json();
                  setClasses(data);
                  setError(null);
                }
              } catch (err) {
                setError(err.message);
              } finally {
                setLoading(false);
              }
            }}
          />

          {/* Schedule Management Card */}
          <ScheduleCard 
            selectedClass={selectedClass}
          />

          {/* Feedback Management Card */}
          <FeedbackCard 
            selectedClass={selectedClass}
          />

          {/* Class Details Card */}
          <ClassDetailsCard 
            selectedClass={selectedClass}
          />

        </div>

        {/* Enhanced Floating Quick Actions Button */}
        <div className="fixed bottom-6 right-6 z-40">
          <div className="relative">
            {/* Main button */}
            <button
              onClick={() => setShowQuickActions(true)}
              className="relative bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 group"
            >
              {/* Button content with better visual hierarchy */}
              <div className="flex items-center space-x-3 px-5 py-4">
                <div className="relative">
                  <svg className="w-5 h-5 transform group-hover:rotate-12 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {/* Small indicator dot */}
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                </div>
                
                {/* Always visible text with smooth appearance */}
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold leading-tight">Quick Actions</span>
                  <span className="text-xs opacity-90 leading-tight">Click for shortcuts</span>
                </div>
                
                {/* Chevron indicator */}
                <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {/* Floating action preview on hover */}
            <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-4 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
              <div className="bg-slate-800 text-white px-3 py-2 rounded-lg shadow-lg border border-slate-600 whitespace-nowrap">
                <div className="text-xs font-medium text-slate-300 mb-1">Available Actions:</div>
                <div className="text-xs space-y-1 text-slate-400">
                  <div>• Export Reports</div>
                  <div>• System Config</div>
                  <div>• Quick Tools</div>
                </div>
                {/* Arrow pointer */}
                <div className="absolute left-full top-1/2 transform -translate-y-1/2 border-l-4 border-l-slate-800 border-y-4 border-y-transparent"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Sidebar */}
        {showQuickActions && (
          <div className="fixed inset-0 z-50">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setShowQuickActions(false)}
            />
            
            {/* Sidebar */}
            <div className="absolute right-0 top-0 h-full w-80 bg-slate-800 shadow-2xl transform transition-transform">
              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-slate-100">Quick Actions</h2>
                  <button
                    onClick={() => setShowQuickActions(false)}
                    className="text-slate-400 hover:text-slate-200 p-1"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <button className="w-full flex items-center space-x-3 p-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-left">
                    <div className="w-10 h-10 bg-sky-600 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-slate-100">Generate Full Report</div>
                      <div className="text-sm text-slate-400">Complete class summary</div>
                    </div>
                  </button>

                  <button className="w-full flex items-center space-x-3 p-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-left">
                    <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-slate-100">Send Calendar Invites</div>
                      <div className="text-sm text-slate-400">Schedule class events</div>
                    </div>
                  </button>

                  <button className="w-full flex items-center space-x-3 p-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-left">
                    <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-slate-100">Export All Data</div>
                      <div className="text-sm text-slate-400">Download class information</div>
                    </div>
                  </button>

                  <button 
                    onClick={() => {
                      setShowQuickActions(false);
                      setShowConfigPanel(true);
                    }}
                    className="w-full flex items-center space-x-3 p-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-left"
                  >
                    <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-slate-100">Configuration Panel</div>
                      <div className="text-sm text-slate-400">System settings & management</div>
                    </div>
                  </button>
                </div>

                {/* Footer */}
                <div className="mt-8 pt-6 border-t border-slate-700">
                  <div className="text-xs text-slate-500 text-center">
                    Quick access to common tasks
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Class View Modal */}
        {detailViewClass && (
          <ClassDetailView 
            className={detailViewClass}
            onClose={() => setDetailViewClass(null)}
          />
        )}

        {/* Configuration Panel Modal */}
        {showConfigPanel && (
          <ConfigurationPanel 
            onClose={() => setShowConfigPanel(false)}
          />
        )}
      </div>
    </div>
  );
}

export default Dashboard; 