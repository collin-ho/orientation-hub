import React, { useState, useEffect } from 'react';
import ClassSetupModal from '../ClassSetupModal';

function NewClassCard({ onClassCreated }) {
  const [isCreating, setIsCreating] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [createdClass, setCreatedClass] = useState(null);

  // Simulate progress during class creation
  useEffect(() => {
    if (!isCreating) {
      setProgress(0);
      setCurrentStep('');
      return;
    }

    const steps = [
      'Creating folder structure...',
      'Setting up Schedule list...',
      'Setting up Class Details list...',  
      'Setting up Feedback & Grades list...',
      'Creating custom fields...',
      'Creating lesson tasks...',
      'Setting up views...',
      'Finalizing setup...'
    ];

    let currentStepIndex = 0;
    setCurrentStep(steps[0]);

    const timer = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + 1; // Slower increment (was 2)
        
        // Update step every ~12.5%
        const stepProgress = Math.floor(newProgress / 12.5);
        if (stepProgress > currentStepIndex && stepProgress < steps.length) {
          currentStepIndex = stepProgress;
          setCurrentStep(steps[currentStepIndex]);
        }
        
        if (newProgress >= 90) { // Stop at 90% instead of 95%
          clearInterval(timer);
          return 90; // Stop at 90% until actual completion
        }
        return newProgress;
      });
    }, 500); // Slower interval (was 200ms)

    return () => clearInterval(timer);
  }, [isCreating]);

  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!startDate) {
      alert('Please select a start date');
      return;
    }

    // Validate that start date is a Monday
    // Fix timezone issue by parsing date in local timezone
    const [year, month, day] = startDate.split('-').map(Number);
    const selectedDate = new Date(year, month - 1, day); // month is 0-indexed
    const dayOfWeek = selectedDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    if (dayOfWeek !== 1) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      alert(`Start date must be a Monday (orientation classes start on Mondays)\n\nYou selected: ${selectedDate.toDateString()} which is a ${dayNames[dayOfWeek]}`);
      return;
    }

    setIsCreating(true);
    setProgress(0);
    setCurrentStep('Initializing...');
    
    try {
      const response = await fetch('/api/create-class', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ startDate }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create class');
      }

      const result = await response.json();
      
      // Complete the progress bar
      setProgress(100);
      setCurrentStep('Complete!');
      
      // Brief delay to show completion, then open setup modal
      setTimeout(() => {
        setIsCreating(false);
        setProgress(0);
        setCurrentStep('');
        setCreatedClass(result);
        setShowSetupModal(true);
      }, 1000);
      
    } catch (err) {
      console.error(`Error creating class: ${err.message}`);
      setIsCreating(false);
      setProgress(0);
      setCurrentStep('');
    }
  };

  const handleSetupComplete = () => {
    setShowSetupModal(false);
    setCreatedClass(null);
    setStartDate('');
    setShowForm(false);
    onClassCreated(); // Refresh the classes list
  };

  const handleSetupCancel = () => {
    setShowSetupModal(false);
    setCreatedClass(null);
    // Note: Class structure was already created, just not fully set up
  };

  return (
    <div className="bg-slate-800 shadow-lg rounded-xl">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100">New Class</h2>
            <p className="text-slate-400 text-sm mt-1">Create a new orientation class</p>
          </div>
          <div className="text-2xl">➕</div>
        </div>

        {!showForm ? (
          <div className="text-center py-8">
            <button
              onClick={() => setShowForm(true)}
              className="bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg transition-colors font-medium"
            >
              Create New Class
            </button>
            <p className="text-slate-400 text-xs mt-2">
              This will duplicate the master template
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {!isCreating ? (
              <form onSubmit={handleCreateClass} className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Start Date (Must be a Monday)
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="flex space-x-2">
                  <button
                    type="submit"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium"
                  >
                    Create Class
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setStartDate('');
                    }}
                    className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>

                <div className="bg-slate-700/30 p-3 rounded-lg">
                  <p className="text-slate-400 text-xs">
                    <strong>Preview:</strong> PD OTN {startDate ? (() => {
                      const date = new Date(startDate + 'T00:00:00');
                      const month = (date.getMonth() + 1).toString().padStart(2, '0');
                      const day = date.getDate().toString().padStart(2, '0');
                      const year = date.getFullYear().toString().slice(-2);
                      return `${month}.${day}.${year}`;
                    })() : 'MM.DD.YY'}
                  </p>
                  <p className="text-slate-400 text-xs mt-1">
                    This will create the complete folder structure with 47 lessons, custom fields, and views
                  </p>
                </div>
              </form>
            ) : (
              // Progress Display
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-green-600 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-100 mb-2">Creating Orientation Class</h3>
                  <p className="text-slate-400 text-sm">Setting up ClickUp structure...</p>
                </div>

                {/* Progress Bar */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-300 font-medium">Progress</span>
                    <span className="text-green-400 font-semibold">{Math.round(progress)}%</span>
                  </div>
                  
                  <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-300 ease-out relative"
                      style={{ width: `${progress}%` }}
                    >
                      {/* Animated shine effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                    </div>
                  </div>

                  {/* Current Step */}
                  <div className="text-center">
                    <p className="text-slate-400 text-xs font-medium">
                      {currentStep}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-700/30 p-3 rounded-lg">
                  <p className="text-slate-400 text-xs">
                    <strong>Creating:</strong> PD OTN {(() => {
                      const date = new Date(startDate + 'T00:00:00');
                      const month = (date.getMonth() + 1).toString().padStart(2, '0');
                      const day = date.getDate().toString().padStart(2, '0');
                      const year = date.getFullYear().toString().slice(-2);
                      return `${month}.${day}.${year}`;
                    })()}
                  </p>
                  <p className="text-slate-400 text-xs mt-1">
                    This process takes 30-60 seconds to complete
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Class Setup Modal */}
      {showSetupModal && createdClass && (
        <ClassSetupModal
          classData={createdClass}
          onComplete={handleSetupComplete}
          onCancel={handleSetupCancel}
        />
      )}
    </div>
  );
}

export default NewClassCard; 