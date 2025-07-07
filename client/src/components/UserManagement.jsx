import React, { useState, useEffect } from 'react';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, instructors, unknown
  const [searchTerm, setSearchTerm] = useState('');

  // Load users on component mount
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/config/users');
      if (!response.ok) {
        throw new Error(`Failed to load users: ${response.statusText}`);
      }
      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const syncUsers = async () => {
    try {
      setSyncing(true);
      setError(null);
      const response = await fetch('/api/config/users?refresh=true');
      if (!response.ok) {
        throw new Error(`Failed to sync users: ${response.statusText}`);
      }
      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Filter users based on current filter and search term
  const filteredUsers = users.filter(user => {
    // Apply role filter
    if (filter === 'instructors' && !user.isInstructor) return false;
    if (filter === 'unknown' && user.isInstructor) return false;
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        user.username?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower) ||
        user.estimatedRole?.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  });

  const instructorCount = users.filter(u => u.isInstructor).length;
  const unknownCount = users.filter(u => !u.isInstructor).length;

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-slate-300">Loading users from ClickUp...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats and Actions */}
      <div className="bg-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">User Management</h2>
            <p className="text-slate-400">Manage ClickUp users and instructor assignments</p>
          </div>
          <button
            onClick={syncUsers}
            disabled={syncing}
            className="bg-sky-600 hover:bg-sky-700 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
          >
            <svg 
              className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{syncing ? 'Syncing...' : 'Sync Users'}</span>
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-lg">👥</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-100">{users.length}</div>
                <div className="text-sm text-slate-400">Total Users</div>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                <span className="text-lg">🎓</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-100">{instructorCount}</div>
                <div className="text-sm text-slate-400">Known Instructors</div>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-yellow-600 rounded-lg flex items-center justify-center">
                <span className="text-lg">❓</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-100">{unknownCount}</div>
                <div className="text-sm text-slate-400">Other Users</div>
              </div>
            </div>
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

      {/* Filters and Search */}
      <div className="bg-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          {/* Filter Tabs */}
          <div className="flex space-x-1">
            {[
              { id: 'all', label: 'All Users', count: users.length },
              { id: 'instructors', label: 'Instructors', count: instructorCount },
              { id: 'unknown', label: 'Other Users', count: unknownCount }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === tab.id
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 text-slate-100 rounded-lg focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">
          Users ({filteredUsers.length})
        </h3>
        
        {filteredUsers.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">👤</div>
            <p className="text-slate-400">No users found matching current filter</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map(user => (
              <div
                key={user.id}
                className="bg-slate-700 rounded-lg p-4 flex items-center justify-between hover:bg-slate-600 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-sky-400 to-blue-500 flex items-center justify-center text-white font-semibold">
                    {user.username?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  
                  {/* User Info */}
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-slate-100">{user.username}</span>
                      {user.isInstructor && (
                        <span className="px-2 py-1 bg-green-600 text-green-100 text-xs rounded-full">
                          Instructor
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-400">
                      {user.email && (
                        <span>{user.email}</span>
                      )}
                      {user.estimatedRole && (
                        <span className="ml-2">• {user.estimatedRole}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  {user.isInstructor ? (
                    <button className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded transition-colors">
                      Edit Assignments
                    </button>
                  ) : (
                    <button className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-slate-300 text-xs rounded transition-colors">
                      Mark as Instructor
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Additional Actions */}
      <div className="bg-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Additional Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button className="bg-slate-700 hover:bg-slate-600 p-4 rounded-lg transition-colors text-left">
            <div className="flex items-center space-x-3 mb-2">
              <span className="text-lg">📥</span>
              <span className="font-medium text-slate-100">Import Instructor List</span>
            </div>
            <p className="text-sm text-slate-400">Upload CSV to bulk assign instructor roles</p>
          </button>

          <button className="bg-slate-700 hover:bg-slate-600 p-4 rounded-lg transition-colors text-left">
            <div className="flex items-center space-x-3 mb-2">
              <span className="text-lg">📤</span>
              <span className="font-medium text-slate-100">Export User List</span>
            </div>
            <p className="text-sm text-slate-400">Download current user assignments</p>
          </button>

          <button className="bg-slate-700 hover:bg-slate-600 p-4 rounded-lg transition-colors text-left">
            <div className="flex items-center space-x-3 mb-2">
              <span className="text-lg">🔄</span>
              <span className="font-medium text-slate-100">Sync Assignments</span>
            </div>
            <p className="text-sm text-slate-400">Update configuration files with current data</p>
          </button>

          <button className="bg-slate-700 hover:bg-slate-600 p-4 rounded-lg transition-colors text-left">
            <div className="flex items-center space-x-3 mb-2">
              <span className="text-lg">⚙️</span>
              <span className="font-medium text-slate-100">User Settings</span>
            </div>
            <p className="text-sm text-slate-400">Configure user discovery preferences</p>
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserManagement; 