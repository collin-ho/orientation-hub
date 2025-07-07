import React, { useState } from 'react';

function ScheduleCard({ selectedClass, selectedClassId }) {
  const [sendingInvites, setSendingInvites] = useState(false);
  const [invitesSent, setInvitesSent] = useState(false);
  const [error, setError] = useState('');

  const handleSendInvites = async () => {
    if (!selectedClassId) {
      setError('Please select a valid class first');
      return;
    }

    setSendingInvites(true);
    setError('');
    
    try {
      const response = await fetch('/api/calendar/send-class-invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          classId: selectedClassId,
          className: selectedClass 
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send invites: ${response.statusText}`);
      }

      const result = await response.json();
      setInvitesSent(true);
      
      // Reset success message after 5 seconds
      setTimeout(() => setInvitesSent(false), 5000);
      
    } catch (err) {
      setError(err.message || 'Failed to send calendar invites');
      console.error('Calendar invite error:', err);
    } finally {
      setSendingInvites(false);
    }
  };

  const handleWelcomeEmails = async () => {
    if (!selectedClassId) {
      setError('Please select a valid class first');
      return;
    }

    try {
      const response = await fetch('/api/calendar/send-welcome-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          classId: selectedClassId,
          className: selectedClass 
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send welcome emails: ${response.statusText}`);
      }

      const result = await response.json();
      alert(`✅ Welcome emails sent to ${result.emailsSent} orientees`);
      
    } catch (err) {
      setError(err.message || 'Failed to send welcome emails');
      console.error('Welcome email error:', err);
    }
  };

  return (
    <div className="bg-slate-800 shadow-lg rounded-xl">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Schedule & Calendar</h2>
            <p className="text-slate-400 text-sm mt-1">Manage class schedules & Outlook integration</p>
          </div>
          <div className="text-2xl">📅</div>
        </div>

        {!selectedClass ? (
          <div className="text-center py-8">
            <p className="text-slate-400 text-sm">Select a class to manage calendar invites</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-slate-700/30 p-3 rounded-lg">
              <p className="text-slate-300 text-sm font-medium">Active Class:</p>
              <p className="text-sky-400 font-semibold">{selectedClass}</p>
            </div>

            {/* Success Message */}
            {invitesSent && (
              <div className="bg-green-600/20 border border-green-500/30 p-3 rounded-lg">
                <p className="text-green-400 text-sm font-medium">
                  ✅ Calendar invites sent successfully!
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-600/20 border border-red-500/30 p-3 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <button className="w-full bg-sky-600 hover:bg-sky-700 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium">
                View Schedule
              </button>
              
              <button 
                onClick={handleSendInvites}
                disabled={sendingInvites}
                className={`w-full py-2 px-4 rounded-lg transition-colors text-sm font-medium ${
                  sendingInvites 
                    ? 'bg-green-600/50 text-green-200 cursor-not-allowed' 
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {sendingInvites ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin h-4 w-4 border-2 border-green-200 border-t-transparent rounded-full"></div>
                    <span>Sending Invites...</span>
                  </div>
                ) : (
                  '📧 Send All Calendar Invites'
                )}
              </button>

              <button 
                onClick={handleWelcomeEmails}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition-colors text-sm"
              >
                💌 Send Welcome Emails
              </button>
              
              <button className="w-full bg-slate-600 hover:bg-slate-700 text-white py-2 px-4 rounded-lg transition-colors text-sm">
                Edit Schedule
              </button>
            </div>

            <div className="bg-emerald-600/20 border border-emerald-500/30 p-3 rounded-lg">
              <p className="text-emerald-400 text-xs font-medium">
                🎉 <strong>Outlook Integration Active!</strong> Calendar invites and emails will be sent from orientation@cogentanalytics.com
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ScheduleCard; 