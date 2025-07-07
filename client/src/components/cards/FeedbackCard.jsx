import React from 'react';

function FeedbackCard({ selectedClass }) {
  return (
    <div className="bg-slate-800 shadow-lg rounded-xl">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Feedback</h2>
            <p className="text-slate-400 text-sm mt-1">Manage feedback submission</p>
          </div>
          <div className="text-2xl">📝</div>
        </div>

        {!selectedClass ? (
          <div className="text-center py-8">
            <p className="text-slate-400 text-sm">Select a class to manage feedback</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-slate-700/30 p-3 rounded-lg">
              <p className="text-slate-300 text-sm font-medium">Active Class:</p>
              <p className="text-sky-400 font-semibold">{selectedClass}</p>
            </div>

            <div className="space-y-2">
              <button className="w-full bg-sky-600 hover:bg-sky-700 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium">
                Open Feedback Form
              </button>
              
              <button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition-colors text-sm">
                View Submitted Feedback
              </button>
              
              <button className="w-full bg-slate-600 hover:bg-slate-700 text-white py-2 px-4 rounded-lg transition-colors text-sm">
                Export Feedback Data
              </button>
            </div>

            <div className="bg-slate-700/20 p-3 rounded-lg">
              <p className="text-slate-400 text-xs">
                <strong>Integration:</strong> Feedback automatically syncs to ClickUp
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FeedbackCard; 