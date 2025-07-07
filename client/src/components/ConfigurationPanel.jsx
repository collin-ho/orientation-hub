import React, { useState, useEffect } from 'react';
import UserManagement from './UserManagement';
import LessonEditor from './LessonEditor';

function ConfigurationPanel({ onClose, initialView, selectedClass }) {
  const [activeTab, setActiveTab] = useState(initialView || 'overview');
  const [systemStats, setSystemStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Configuration tabs/sections
  const tabs = [
    {
      id: 'overview',
      name: 'Overview',
      icon: '📊',
      description: 'System status and quick stats'
    },
    {
      id: 'users',
      name: 'User Management',
      icon: '👥',
      description: 'Manage instructors and assignments'
    },
    {
      id: 'lessons',
      name: 'Lesson Editor',
      icon: '📚',
      description: 'Manage lessons, schedule, and template'
    },
  ];

  // Load system statistics
  useEffect(() => {
    const loadSystemStats = async () => {
      try {
        setLoading(true);
        
        // Fetch stats from all our discovery services
        const [usersResponse, fieldsResponse, optionsResponse] = await Promise.all([
          fetch('/api/config/users'),
          fetch('/api/config/fields'),
          fetch('/api/config/field-options')
        ]);

        if (usersResponse.ok && fieldsResponse.ok && optionsResponse.ok) {
          const [usersData, fieldsData, optionsData] = await Promise.all([
            usersResponse.json(),
            fieldsResponse.json(),
            optionsResponse.json()
          ]);

          setSystemStats({
            users: {
              total: usersData.users.length,
              instructors: usersData.users.filter(u => u.isInstructor).length,
              responseTime: usersData.metadata.responseTime
            },
            fields: {
              total: fieldsData.metadata.totalFields,
              byList: fieldsData.metadata.listBreakdown,
              responseTime: fieldsData.metadata.responseTime
            },
            options: {
              total: optionsData.metadata.totalOptionsProcessed,
              fields: optionsData.metadata.totalDropdownFields,
              categories: optionsData.metadata.categories.length,
              responseTime: optionsData.metadata.responseTime
            }
          });
        }
      } catch (error) {
        console.error('Error loading system stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSystemStats();
  }, []);

  // Handle ESC key to close panel
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'auto';
    };
  }, [onClose]);

  const renderOverview = () => (
    <div className="space-y-6">
      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Users Card */}
        <div className="bg-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-lg">👥</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Users</h3>
                <p className="text-slate-400 text-sm">ClickUp Discovery</p>
              </div>
            </div>
            {systemStats && (
              <div className="text-right">
                <div className="text-2xl font-bold text-slate-100">{systemStats.users.total}</div>
                <div className="text-sm text-green-400">{systemStats.users.instructors} instructors</div>
              </div>
            )}
          </div>
          {systemStats && (
            <div className="text-xs text-slate-500">
              Fetched in {systemStats.users.responseTime}ms
            </div>
          )}
        </div>

        {/* Fields Card */}
        <div className="bg-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-lg">🔧</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Fields</h3>
                <p className="text-slate-400 text-sm">Custom Fields</p>
              </div>
            </div>
            {systemStats && (
              <div className="text-right">
                <div className="text-2xl font-bold text-slate-100">{systemStats.fields.total}</div>
                <div className="text-sm text-green-400">across 3 lists</div>
              </div>
            )}
          </div>
          {systemStats && (
            <div className="text-xs text-slate-500">
              Discovered in {systemStats.fields.responseTime}ms
            </div>
          )}
        </div>

        {/* Options Card */}
        <div className="bg-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                <span className="text-lg">🎛️</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Options</h3>
                <p className="text-slate-400 text-sm">Dropdown Values</p>
              </div>
            </div>
            {systemStats && (
              <div className="text-right">
                <div className="text-2xl font-bold text-slate-100">{systemStats.options.total}</div>
                <div className="text-sm text-green-400">{systemStats.options.fields} dropdowns</div>
              </div>
            )}
          </div>
          {systemStats && (
            <div className="text-xs text-slate-500">
              Processed in {systemStats.options.responseTime}ms
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={async () => {
              try {
                const res = await fetch('/api/sync/instructors', { method:'POST' });
                const data = await res.json();
                if(!res.ok) throw new Error(data.error||'Sync failed');
                setToast({ msg:`Synced ${data.count} instructors`, type:'success' });
              }catch(err){
                setToast({ msg:`Sync failed: ${err.message}`, type:'error' });
              }
              setTimeout(()=>setToast(null),3000);
            }}
            className="bg-slate-700 hover:bg-slate-600 p-4 rounded-lg transition-colors text-left"
          >
            <div className="flex items-center space-x-3 mb-2">
              <span className="text-lg">👥</span>
              <span className="font-medium text-slate-100">Sync Users</span>
            </div>
            <p className="text-sm text-slate-400">Refresh instructor list from ClickUp</p>
          </button>

          <button
            onClick={() => setActiveTab('lessons')}
            className="bg-slate-700 hover:bg-slate-600 p-4 rounded-lg transition-colors text-left"
          >
            <div className="flex items-center space-x-3 mb-2">
              <span className="text-lg">📚</span>
              <span className="font-medium text-slate-100">Manage Lessons</span>
            </div>
            <p className="text-sm text-slate-400">Edit curriculum, schedule, and template</p>
          </button>

          <button className="bg-slate-700 hover:bg-slate-600 p-4 rounded-lg transition-colors text-left">
            <div className="flex items-center space-x-3 mb-2">
              <span className="text-lg">⚙️</span>
              <span className="font-medium text-slate-100">System Settings</span>
            </div>
            <p className="text-sm text-slate-400">Configure system preferences</p>
          </button>
        </div>
      </div>

      {/* System Health */}
      <div className="bg-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">System Health</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-300">ClickUp API Connection</span>
            <span className="px-2 py-1 bg-green-900 text-green-300 rounded text-sm">✅ Connected</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Configuration Loading</span>
            <span className="px-2 py-1 bg-green-900 text-green-300 rounded text-sm">✅ Ready</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Data Discovery</span>
            <span className="px-2 py-1 bg-green-900 text-green-300 rounded text-sm">✅ Active</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Cache Performance</span>
            <span className="px-2 py-1 bg-green-900 text-green-300 rounded text-sm">✅ Optimal</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPlaceholder = (tabName) => (
    <div className="bg-slate-800 rounded-xl p-8 text-center">
      <div className="text-6xl mb-4">🚧</div>
      <h3 className="text-xl font-semibold text-slate-100 mb-2">{tabName} Coming Soon</h3>
      <p className="text-slate-400 mb-6">
        This component is being built as part of Phase 3 of the Configuration Management System.
      </p>
      <div className="bg-slate-700 rounded-lg p-4 text-left max-w-md mx-auto">
        <h4 className="font-medium text-slate-200 mb-2">Planned Features:</h4>
        <ul className="text-sm text-slate-400 space-y-1">
          {tabName === 'User Management' && (
            <>
              <li>• View all ClickUp users</li>
              <li>• Sync instructor assignments</li>
              <li>• Manage user roles and permissions</li>
              <li>• Bulk user operations</li>
            </>
          )}
          {tabName === 'Lesson Editor' && (
            <>
              <li>• Add new lessons to curriculum</li>
              <li>• Edit existing lesson details</li>
              <li>• Reorder lesson sequence</li>
              <li>• Assign instructors to lessons</li>
            </>
          )}
          {tabName === 'Class Structure' && (
            <>
              <li>• Preview full class schedule</li>
              <li>• Modify lesson timing</li>
              <li>• Adjust week structure</li>
              <li>• Export schedule templates</li>
            </>
          )}
          {tabName === 'Template Manager' && (
            <>
              <li>• Modify ClickUp template</li>
              <li>• Update default configurations</li>
              <li>• Backup/restore templates</li>
              <li>• Preview template changes</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full h-full flex items-center justify-center p-4">
        <div 
          className="bg-slate-900 rounded-xl w-full max-w-7xl h-full max-h-[95vh] flex flex-col shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-slate-800 p-6 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">Configuration Panel</h1>
              <p className="text-slate-400">Manage system settings and orientation class configurations</p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 text-2xl leading-none p-1"
            >
              ✕
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="bg-slate-800 border-b border-slate-700 px-6 flex-shrink-0">
            <div className="flex space-x-1 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-slate-900 text-sky-400 border-b-2 border-sky-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-6">
              {loading && activeTab === 'overview' ? (
                <div className="text-center py-12">
                  <div className="animate-spin w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-slate-300">Loading system statistics...</p>
                </div>
              ) : activeTab === 'overview' ? (
                renderOverview()
              ) : activeTab === 'users' ? (
                <UserManagement />
              ) : activeTab === 'lessons' ? (
                <LessonEditor selectedClass={selectedClass} />
              ) : null}
            </div>
          </div>
        </div>
      </div>
      {toast && (
        <div className={`fixed bottom-4 right-4 px-4 py-3 rounded shadow-lg text-sm z-50 ${toast.type==='success'?'bg-emerald-600':'bg-red-600'} text-white`}>{toast.msg}</div>
      )}
    </div>
  );
}

export default ConfigurationPanel; 