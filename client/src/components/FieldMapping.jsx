import React, { useState, useEffect } from 'react';

function FieldMapping() {
  const [fieldMappings, setFieldMappings] = useState(null);
  const [liveFields, setLiveFields] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedList, setSelectedList] = useState('schedule');
  const [showDiscrepancies, setShowDiscrepancies] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [managementMode, setManagementMode] = useState('validation'); // 'validation' or 'discovery'

  useEffect(() => {
    loadFieldData();
  }, []);

  const loadFieldData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load both config mappings and live field discovery in parallel
      const [mappingsRes, liveRes] = await Promise.all([
        fetch('/api/config/field-mappings'),
        fetch('/api/config/fields')
      ]);

      if (!mappingsRes.ok) {
        throw new Error(`Failed to load field mappings: ${mappingsRes.statusText}`);
      }
      if (!liveRes.ok) {
        throw new Error(`Failed to load live fields: ${liveRes.statusText}`);
      }

      const mappingsData = await mappingsRes.json();
      const liveData = await liveRes.json();

      setFieldMappings(mappingsData);
      setLiveFields(liveData);
      setLastSync(new Date());

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshFields = async () => {
    setError(null);
    // Clear field discovery cache
    try {
      await fetch('/api/config/fields/clear-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      console.warn('Failed to clear cache:', err.message);
    }
    await loadFieldData();
  };

  const getListDisplayName = (listKey) => {
    const names = {
      schedule: 'Schedule',
      classDetails: 'Class Details', 
      feedbackGrades: 'Feedback & Grades'
    };
    return names[listKey] || listKey;
  };

  const getFieldTypeIcon = (type) => {
    const icons = {
      'drop_down': '📋',
      'list': '👥',
      'text': '📝',
      'number': '🔢',
      'date': '📅',
      'checkbox': '☑️',
      'url': '🔗',
      'email': '📧'
    };
    return icons[type] || '❓';
  };

  const analyzeDiscrepancies = () => {
    if (!fieldMappings || !liveFields) return { issues: [], summary: {} };

    const issues = [];
    const summary = { total: 0, missing: 0, mismatch: 0, extra: 0 };

    // Check each configured field against live data
    Object.entries(fieldMappings.customFields).forEach(([listType, configFields]) => {
      const liveListFields = liveFields.fieldsByList[listType] || {};

      Object.entries(configFields).forEach(([fieldName, configField]) => {
        summary.total++;

        const liveField = Object.values(liveListFields).find(f => f.name === configField.name);

        if (!liveField) {
          issues.push({
            type: 'missing',
            severity: 'error',
            list: listType,
            field: fieldName,
            description: `Field "${fieldName}" configured but not found in live ClickUp ${getListDisplayName(listType)} list`,
            configId: configField.id,
            configType: configField.type
          });
          summary.missing++;
        } else {
          // Field exists - check for type/ID mismatches
          if (liveField.id !== configField.id) {
            issues.push({
              type: 'id_mismatch',
              severity: 'warning',
              list: listType,
              field: fieldName,
              description: `Field ID mismatch for "${fieldName}": config=${configField.id}, live=${liveField.id}`,
              configId: configField.id,
              liveId: liveField.id
            });
            summary.mismatch++;
          }

          if (liveField.type !== configField.type) {
            issues.push({
              type: 'type_mismatch',
              severity: 'warning',
              list: listType,
              field: fieldName,
              description: `Field type mismatch for "${fieldName}": config=${configField.type}, live=${liveField.type}`,
              configType: configField.type,
              liveType: liveField.type
            });
            summary.mismatch++;
          }
        }
      });
    });

    // Check for extra fields in ClickUp not in config
    Object.entries(liveFields.fieldsByList).forEach(([listType, liveListFields]) => {
      const configFields = fieldMappings.customFields[listType] || {};

      Object.values(liveListFields).forEach(liveField => {
        const isConfigured = Object.values(configFields).some(configField => configField.name === liveField.name);

        if (!isConfigured) {
          issues.push({
            type: 'extra',
            severity: 'info',
            list: listType,
            field: liveField.name,
            description: `Field "${liveField.name}" exists in ClickUp but not in configuration`,
            liveId: liveField.id,
            liveType: liveField.type
          });
          summary.extra++;
        }
      });
    });

    return { issues, summary };
  };

  const getDiscoveredFields = () => {
    if (!fieldMappings || !liveFields) return { configured: [], discoverable: [] };

    const configured = [];
    const discoverable = [];

    // Go through each list type
    Object.entries(liveFields.fieldsByList).forEach(([listType, liveListFields]) => {
      const configFields = fieldMappings.customFields[listType] || {};

      Object.values(liveListFields).forEach(liveField => {
        const isConfigured = Object.values(configFields).some(configField => 
          configField.name === liveField.name
        );

        const fieldWithContext = {
          ...liveField,
          listType,
          listDisplayName: getListDisplayName(listType)
        };

        if (isConfigured) {
          // Find the config entry
          const configEntry = Object.entries(configFields).find(([key, config]) => 
            config.name === liveField.name
          );
          configured.push({
            ...fieldWithContext,
            configKey: configEntry[0],
            configData: configEntry[1]
          });
        } else {
          discoverable.push(fieldWithContext);
        }
      });
    });

    return { configured, discoverable };
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-slate-300">Loading field mappings...</p>
      </div>
    );
  }

  const { issues, summary } = analyzeDiscrepancies();
  const filteredIssues = showDiscrepancies ? issues : [];
  const { configured, discoverable } = getDiscoveredFields();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Field Mapping</h2>
            <p className="text-slate-400">
              {managementMode === 'validation' 
                ? 'Validate configuration vs live ClickUp fields'
                : 'Discover and manage ClickUp field mappings'
              }
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {/* Mode Toggle */}
            <div className="bg-slate-700 rounded-lg p-1 flex">
              <button
                onClick={() => setManagementMode('validation')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                  managementMode === 'validation'
                    ? 'bg-sky-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🔍 Validation
              </button>
              <button
                onClick={() => setManagementMode('discovery')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                  managementMode === 'discovery'
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🚀 Discovery
              </button>
            </div>
            
            <button
              onClick={refreshFields}
              className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-slate-100">{summary.total}</div>
            <div className="text-sm text-slate-400">Configured Fields</div>
          </div>
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-400">{summary.total - summary.missing - summary.mismatch}</div>
            <div className="text-sm text-slate-400">Valid Mappings</div>
          </div>
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-orange-400">{summary.mismatch}</div>
            <div className="text-sm text-slate-400">Mismatches</div>
          </div>
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-red-400">{summary.missing}</div>
            <div className="text-sm text-slate-400">Missing Fields</div>
          </div>
        </div>

        {/* Sync Info */}
        <div className="bg-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${issues.length === 0 ? 'bg-green-400' : 'bg-orange-400'}`}></div>
                <span className="text-slate-300 font-medium">
                  {issues.length === 0 ? 'All mappings valid' : `${issues.length} issues found`}
                </span>
              </div>
              {lastSync && (
                <span className="text-slate-500 text-sm">
                  Last sync: {lastSync.toLocaleTimeString()}
                </span>
              )}
            </div>
            
            {issues.length > 0 && (
              <button
                onClick={() => setShowDiscrepancies(!showDiscrepancies)}
                className="text-orange-400 hover:text-orange-300 text-sm flex items-center space-x-1"
              >
                <span>{showDiscrepancies ? 'Hide' : 'Show'} Issues</span>
                <svg className={`w-4 h-4 transition-transform ${showDiscrepancies ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
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

      {/* Issues Panel */}
      {showDiscrepancies && issues.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Configuration Issues</h3>
          <div className="space-y-3">
            {filteredIssues.map((issue, index) => (
              <div
                key={index}
                className={`rounded-lg p-4 border-l-4 ${
                  issue.severity === 'error' ? 'bg-red-900/20 border-red-500' :
                  issue.severity === 'warning' ? 'bg-orange-900/20 border-orange-500' :
                  'bg-blue-900/20 border-blue-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        issue.severity === 'error' ? 'bg-red-600 text-red-100' :
                        issue.severity === 'warning' ? 'bg-orange-600 text-orange-100' :
                        'bg-blue-600 text-blue-100'
                      }`}>
                        {issue.severity.toUpperCase()}
                      </span>
                      <span className="text-slate-300 text-sm font-medium">
                        {getListDisplayName(issue.list)} • {issue.field}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm">{issue.description}</p>
                    
                    {/* Additional Details */}
                    {(issue.configId || issue.liveId) && (
                      <div className="mt-2 text-xs text-slate-500 space-x-4">
                        {issue.configId && <span>Config ID: {issue.configId}</span>}
                        {issue.liveId && <span>Live ID: {issue.liveId}</span>}
                        {issue.configType && <span>Config Type: {issue.configType}</span>}
                        {issue.liveType && <span>Live Type: {issue.liveType}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Discovery Mode */}
      {managementMode === 'discovery' && (
        <div className="bg-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Field Discovery Console</h3>
          
          {/* Discovery Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-400">{configured.length}</div>
              <div className="text-sm text-slate-400">Configured Fields</div>
            </div>
            <div className="bg-slate-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-400">{discoverable.length}</div>
              <div className="text-sm text-slate-400">Available to Configure</div>
            </div>
          </div>

          {/* Discoverable Fields */}
          {discoverable.length > 0 && (
            <div className="mb-6">
              <h4 className="text-md font-semibold text-slate-200 mb-3">Available Fields (Not Configured)</h4>
              <div className="space-y-3">
                {discoverable.map((field, index) => (
                  <div
                    key={`${field.listType}-${field.id}`}
                    className="bg-slate-700 rounded-lg p-4 border-l-4 border-purple-500"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="text-2xl">{getFieldTypeIcon(field.type)}</span>
                          <h5 className="font-semibold text-slate-100">{field.name}</h5>
                          <span className="bg-slate-600 text-slate-300 px-2 py-1 rounded text-xs">
                            {field.type}
                          </span>
                          <span className="bg-purple-600 text-purple-100 px-2 py-1 rounded text-xs">
                            {field.listDisplayName}
                          </span>
                        </div>
                        
                        <div className="text-sm text-slate-400">
                          <span className="font-mono text-xs">ID: {field.id}</span>
                          {field.options && (
                            <span className="ml-4">Options: {field.options.length}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            // TODO: Implement add to configuration
                            alert(`Add "${field.name}" to configuration - Feature coming in Phase 4!`);
                          }}
                          className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                          + Add to Config
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Configured Fields Summary */}
          <div>
            <h4 className="text-md font-semibold text-slate-200 mb-3">Currently Configured Fields</h4>
            <div className="space-y-2">
              {configured.map((field, index) => (
                <div
                  key={`${field.listType}-${field.configKey}`}
                  className="bg-slate-700 rounded-lg p-3 border-l-4 border-green-500"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{getFieldTypeIcon(field.type)}</span>
                      <span className="font-medium text-slate-100">{field.name}</span>
                      <span className="bg-slate-600 text-slate-300 px-2 py-1 rounded text-xs">
                        {field.configKey}
                      </span>
                      <span className="bg-green-600 text-green-100 px-2 py-1 rounded text-xs">
                        {field.listDisplayName}
                      </span>
                    </div>
                    
                    <button
                      onClick={() => {
                        // TODO: Implement remove from configuration
                        alert(`Remove "${field.name}" from configuration - Feature coming in Phase 4!`);
                      }}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Field List Tabs - Only show in validation mode */}
      {managementMode === 'validation' && (
        <div className="bg-slate-800 rounded-xl p-6">
          <div className="flex items-center space-x-4 mb-6">
            {fieldMappings && Object.keys(fieldMappings.customFields).map(listKey => (
              <button
                key={listKey}
                onClick={() => setSelectedList(listKey)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedList === listKey
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {getListDisplayName(listKey)}
              </button>
            ))}
          </div>

          {/* Field Details */}
          {fieldMappings && selectedList && (
            <div>
              <h3 className="text-lg font-semibold text-slate-100 mb-4">
                {getListDisplayName(selectedList)} Fields
              </h3>
              
              <div className="space-y-3">
                {Object.entries(fieldMappings.customFields[selectedList] || {}).map(([fieldName, fieldConfig]) => {
                  const liveField = liveFields?.fieldsByList[selectedList] && 
                    Object.values(liveFields.fieldsByList[selectedList]).find(f => f.name === fieldConfig.name);
                  
                  const hasIssue = issues.some(issue => 
                    issue.list === selectedList && issue.field === fieldName
                  );

                  return (
                    <div
                      key={fieldName}
                      className={`bg-slate-700 rounded-lg p-4 border-l-4 ${
                        hasIssue ? 'border-orange-500' : 
                        liveField ? 'border-green-500' : 'border-red-500'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className="text-2xl">{getFieldTypeIcon(fieldConfig.type)}</span>
                            <h4 className="font-semibold text-slate-100">{fieldName}</h4>
                            <span className="bg-slate-600 text-slate-300 px-2 py-1 rounded text-xs">
                              {fieldConfig.type}
                            </span>
                            {liveField && (
                              <span className="bg-green-600 text-green-100 px-2 py-1 rounded text-xs">
                                Live
                              </span>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            {/* Config Info */}
                            <div>
                              <div className="text-slate-400 mb-1">Configuration</div>
                              <div className="text-slate-300 space-y-1">
                                <div>ID: <span className="font-mono text-xs">{fieldConfig.id}</span></div>
                                <div>Type: <span className="text-sky-400">{fieldConfig.type}</span></div>
                                {fieldConfig.required && (
                                  <div>Required: <span className="text-orange-400">Yes</span></div>
                                )}
                              </div>
                            </div>

                            {/* Live Info */}
                            <div>
                              <div className="text-slate-400 mb-1">Live ClickUp</div>
                              {liveField ? (
                                <div className="text-slate-300 space-y-1">
                                  <div>ID: <span className="font-mono text-xs">{liveField.id}</span></div>
                                  <div>Type: <span className="text-sky-400">{liveField.type}</span></div>
                                  {liveField.options && (
                                    <div>Options: <span className="text-purple-400">{liveField.options.length}</span></div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-red-400">Field not found in ClickUp</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FieldMapping; 