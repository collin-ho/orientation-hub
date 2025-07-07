import React, { useState, useEffect } from 'react';

function ClassSetupModal({ classData, onComplete, onCancel }) {
  const [orientees, setOrientees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fieldOptions, setFieldOptions] = useState({
    pillar: [],
    market: [],
    personalityTag: []
  });

  // Initialize with one empty orientee
  useEffect(() => {
    setOrientees([createEmptyOrientee()]);
    fetchFieldOptions();
  }, []);

  const createEmptyOrientee = () => ({
    id: Date.now() + Math.random(),
    name: '',
    pillar: '',
    market: '',
    cogentEmail: '',
    linkedinProfile: '',
    personalityTag: ''
  });

  const fetchFieldOptions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/field-options');
      if (response.ok) {
        const options = await response.json();
        setFieldOptions(options);
      }
    } catch (error) {
      console.error('Failed to fetch field options:', error);
    } finally {
      setLoading(false);
    }
  };

  const addOrientee = () => {
    setOrientees([...orientees, createEmptyOrientee()]);
  };

  const removeOrientee = (id) => {
    if (orientees.length > 1) {
      setOrientees(orientees.filter(o => o.id !== id));
    }
  };

  const updateOrientee = (id, field, value) => {
    setOrientees(prevOrientees => prevOrientees.map(o => 
      o.id === id ? { ...o, [field]: value } : o
    ));
  };

  const generateCogentEmail = (name) => {
    if (!name) return '';
    const parts = name.toLowerCase().split(' ');
    if (parts.length >= 2) {
      const firstLetter = parts[0].charAt(0); // First letter of first name
      const lastName = parts[parts.length - 1]; // Last name (handles middle names)
      return `${firstLetter}${lastName}@cogentanalytics.com`;
    }
    return '';
  };

  const handleNameChange = (id, name) => {
    updateOrientee(id, 'name', name);
    // Auto-generate email when name is entered
    const email = generateCogentEmail(name);
    updateOrientee(id, 'cogentEmail', email);
  };

  const handleSave = async () => {
    // Validate only required fields - allow blanks for optional ones
    const invalidOrientees = orientees.filter(o => 
      !o.name.trim() // Only require name - email will be auto-generated
    );

    if (invalidOrientees.length > 0) {
      alert('Please fill in Name for all orientees (other fields are optional)');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/setup-class-orientees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classData,
          orientees
        })
      });

      if (response.ok) {
        onComplete();
      } else {
        const error = await response.text();
        alert(`Failed to save orientees: ${error}`);
      }
    } catch (error) {
      alert(`Error saving orientees: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-slate-800 p-6 rounded-xl">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-300">Loading field options...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="bg-slate-900 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-slate-800 p-6 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Setup Class: {classData.className}</h2>
            <p className="text-green-400 mt-1">✅ Class structure created successfully!</p>
            <p className="text-slate-400 text-sm mt-1">Now let's add the orientee details...</p>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-200 text-2xl leading-none p-1"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {orientees.map((orientee, index) => (
            <div key={orientee.id} className="bg-slate-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-200">
                  Orientee {index + 1}
                </h3>
                {orientees.length > 1 && (
                  <button
                    onClick={() => removeOrientee(orientee.id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={orientee.name}
                    onChange={(e) => handleNameChange(orientee.id, e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="First Last"
                  />
                </div>

                {/* Pillar */}
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Pillar
                  </label>
                  <div className="relative">
                    <select
                      value={orientee.pillar}
                      onChange={(e) => updateOrientee(orientee.id, 'pillar', e.target.value)}
                      className="w-full bg-slate-700/80 border border-slate-500 text-slate-100 px-3 py-2 rounded-lg focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition-all duration-200 appearance-none pr-10"
                    >
                      <option value="" className="bg-slate-800 text-slate-300">Select Pillar</option>
                      {fieldOptions.pillar.map(option => (
                        <option key={option.id} value={option.id} className="bg-slate-800 text-slate-100">{option.name}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Market */}
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Market
                  </label>
                  <div className="relative">
                    <select
                      value={orientee.market}
                      onChange={(e) => updateOrientee(orientee.id, 'market', e.target.value)}
                      className="w-full bg-slate-700/80 border border-slate-500 text-slate-100 px-3 py-2 rounded-lg focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition-all duration-200 appearance-none pr-10"
                    >
                      <option value="" className="bg-slate-800 text-slate-300">Select Market</option>
                      {fieldOptions.market.map(option => (
                        <option key={option.id} value={option.id} className="bg-slate-800 text-slate-100">{option.name}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Cogent Email */}
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Cogent Email
                  </label>
                  <input
                    type="email"
                    value={orientee.cogentEmail}
                    onChange={(e) => updateOrientee(orientee.id, 'cogentEmail', e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="Auto-generated from name"
                  />
                </div>

                {/* LinkedIn Profile */}
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    LinkedIn Profile
                  </label>
                  <input
                    type="url"
                    value={orientee.linkedinProfile}
                    onChange={(e) => updateOrientee(orientee.id, 'linkedinProfile', e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-slate-100 px-3 py-2 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>

                {/* Personality TAG */}
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Personality TAG
                  </label>
                  <div className="relative">
                    <select
                      value={orientee.personalityTag}
                      onChange={(e) => updateOrientee(orientee.id, 'personalityTag', e.target.value)}
                      className="w-full bg-slate-700/80 border border-slate-500 text-slate-100 px-3 py-2 rounded-lg focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition-all duration-200 appearance-none pr-10"
                    >
                      <option value="" className="bg-slate-800 text-slate-300">Select Personality</option>
                      {fieldOptions.personalityTag.map(option => (
                        <option key={option.id} value={option.id} className="bg-slate-800 text-slate-100">{option.label || option.name}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Add Orientee Button */}
          <div className="text-center">
            <button
              onClick={addOrientee}
              className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
            >
              + Add Another Orientee
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-800 p-6 border-t border-slate-700 flex items-center justify-between flex-shrink-0">
          <div className="text-slate-400 text-sm">
            * Required: Name only (other fields optional)
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded-lg transition-colors font-medium"
            >
              {saving ? 'Saving...' : 'Save & Complete Class'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClassSetupModal; 