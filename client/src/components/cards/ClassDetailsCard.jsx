import React from 'react';

function ClassDetailsCard({ selectedClass }) {
  return (
    <div className="bg-slate-800 shadow-lg rounded-xl">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Class Details</h2>
            <p className="text-slate-400 text-sm mt-1">View orientees & class info</p>
          </div>
          <div className="text-2xl">👥</div>
        </div>

        {!selectedClass ? (
          <div className="text-center py-8">
            <p className="text-slate-400 text-sm">Select a class to view details</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-slate-700/30 p-3 rounded-lg">
              <p className="text-slate-300 text-sm font-medium">Active Class:</p>
              <p className="text-sky-400 font-semibold">{selectedClass}</p>
            </div>

            {/* Placeholder stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-700/30 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-400">6</p>
                <p className="text-slate-400 text-xs">Total Orientees</p>
              </div>
              <div className="bg-slate-700/30 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-sky-400">4</p>
                <p className="text-slate-400 text-xs">Graduated</p>
              </div>
            </div>

            <div className="space-y-2">
              <button className="w-full bg-sky-600 hover:bg-sky-700 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium">
                View All Orientees
              </button>
              
              <button className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 px-4 rounded-lg transition-colors text-sm">
                Manage Orientees
              </button>
              
              <button className="w-full bg-slate-600 hover:bg-slate-700 text-white py-2 px-4 rounded-lg transition-colors text-sm">
                Class Settings
              </button>
            </div>

            <div className="bg-slate-700/20 p-3 rounded-lg">
              <p className="text-slate-400 text-xs">
                <strong>Status:</strong> All data synced with ClickUp
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ClassDetailsCard; 