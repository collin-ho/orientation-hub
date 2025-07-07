const { fieldDiscovery } = require('./field-discovery');

/**
 * Dropdown Options Service
 * Provides consolidated access to all ClickUp dropdown field options
 * Optimized for admin UI consumption with consistent formatting
 */
class DropdownOptionsService {
  constructor() {
    this.cache = new Map();
    this.CACHE_TTL = 15 * 60 * 1000; // 15 minutes (dropdown options rarely change)
    
    // Known dropdown fields and their purposes
    this.KNOWN_DROPDOWNS = {
      // Schedule list dropdowns
      'weekNum': { 
        name: 'Week #', 
        purpose: 'Class week selection',
        category: 'scheduling'
      },
      'weekDay': { 
        name: 'Week Day', 
        purpose: 'Day of week selection',
        category: 'scheduling'
      },
      'subject': { 
        name: 'Subject', 
        purpose: 'Lesson subject classification',
        category: 'curriculum'
      },
      
      // Class Details list dropdowns
      'pillar': { 
        name: 'Pillar', 
        purpose: 'Business pillar assignment',
        category: 'classification'
      },
      'market': { 
        name: 'Market', 
        purpose: 'Market/territory assignment',
        category: 'classification'
      },
      'orientee': { 
        name: 'PD Orientee', 
        purpose: 'Orientee selection',
        category: 'people'
      },
      
      // Feedback & Grades list dropdowns
      'assignment': { 
        name: 'Assignment', 
        purpose: 'Assignment/task type',
        category: 'grading'
      }
    };
  }

  /**
   * Get all dropdown options across all fields
   */
  async getAllDropdownOptions() {
    try {
      console.log('🎛️ Gathering all dropdown options...');
      
      const cacheKey = 'all-dropdown-options';
      if (this.isCacheValid(cacheKey)) {
        console.log('✅ Using cached dropdown options');
        return this.cache.get(cacheKey);
      }
      
      const startTime = Date.now();
      
      // Get all fields with their options
      const fieldsResult = await fieldDiscovery.discoverAllFields();
      const dropdownFields = fieldsResult.fields.filter(field => field.hasOptions);
      
      console.log(`🔍 Found ${dropdownFields.length} fields with dropdown options`);
      
      // Process each dropdown field
      const allOptions = {};
      const optionsByCategory = {};
      const fieldMetadata = {};
      
      for (const field of dropdownFields) {
        try {
          const options = await this.processDropdownField(field);
          
          // Store by field ID and name for easy lookup
          allOptions[field.id] = options;
          allOptions[field.name.toLowerCase().replace(/\s+/g, '_')] = options;
          
          // Group by category
          const category = options.category;
          if (!optionsByCategory[category]) {
            optionsByCategory[category] = {};
          }
          optionsByCategory[category][field.name] = options;
          
          // Store field metadata
          fieldMetadata[field.id] = {
            name: field.name,
            type: field.type,
            listName: field.listName,
            category: options.category,
            optionCount: options.options.length
          };
          
          console.log(`  ✅ ${field.name}: ${options.options.length} options`);
          
        } catch (error) {
          console.warn(`  ⚠️ Failed to process ${field.name}:`, error.message);
        }
      }
      
      const elapsed = Date.now() - startTime;
      
      const result = {
        allOptions,
        optionsByCategory,
        fieldMetadata,
        metadata: {
          totalDropdownFields: dropdownFields.length,
          totalOptionsProcessed: Object.values(allOptions).reduce((sum, field) => sum + field.options.length, 0),
          categories: Object.keys(optionsByCategory),
          fetchTime: new Date().toISOString(),
          responseTime: elapsed,
          source: 'ClickUp Custom Fields via Field Discovery'
        }
      };
      
      // Cache the result
      this.cache.set(cacheKey, result);
      
      console.log(`✅ Processed ${result.metadata.totalDropdownFields} dropdown fields with ${result.metadata.totalOptionsProcessed} total options in ${elapsed}ms`);
      
      return result;
      
    } catch (error) {
      console.error('💥 Dropdown options gathering failed:', error.message);
      
      // Return stale cache if available
      const staleData = this.cache.get('all-dropdown-options');
      if (staleData) {
        console.warn('⚠️ Returning stale cached dropdown options due to error');
        return {
          ...staleData,
          metadata: {
            ...staleData.metadata,
            stale: true,
            lastError: error.message,
            errorTime: new Date().toISOString()
          }
        };
      }
      
      throw new Error(`Dropdown options service failed: ${error.message}`);
    }
  }

  /**
   * Process a single dropdown field and format its options
   */
  async processDropdownField(field) {
    const knownField = this.findKnownDropdown(field.name);
    
    // Extract and format options
    const rawOptions = field.typeConfig?.formattedOptions || [];
    const formattedOptions = rawOptions.map((option, index) => ({
      id: option.id,
      value: option.id,
      label: option.name,
      name: option.name,
      color: option.color || '#808080',
      orderindex: option.orderindex ?? index,
      
      // UI-specific formatting
      displayName: option.name,
      isActive: true,
      source: 'clickup'
    }));
    
    // Sort by order index for consistent display
    formattedOptions.sort((a, b) => a.orderindex - b.orderindex);
    
    return {
      fieldId: field.id,
      fieldName: field.name,
      listName: field.listName,
      type: field.type,
      
      // Categorization and purpose
      category: knownField?.category || 'uncategorized',
      purpose: knownField?.purpose || 'General dropdown selection',
      
      // Options data
      options: formattedOptions,
      optionCount: formattedOptions.length,
      
      // Admin UI helpers
      isConfigurable: field.isConfigurable,
      supportedOperations: field.supportedOperations || ['view'],
      
      // Metadata
      lastUpdated: new Date().toISOString(),
      source: 'clickup_field_discovery'
    };
  }

  /**
   * Find known dropdown info by field name
   */
  findKnownDropdown(fieldName) {
    const normalized = fieldName.toLowerCase().replace(/\s+/g, '');
    
    for (const [key, info] of Object.entries(this.KNOWN_DROPDOWNS)) {
      const knownNormalized = info.name.toLowerCase().replace(/\s+/g, '');
      if (normalized.includes(knownNormalized) || knownNormalized.includes(normalized)) {
        return info;
      }
    }
    
    return null;
  }

  /**
   * Get options for a specific field
   */
  async getOptionsForField(fieldIdentifier) {
    try {
      const allOptions = await this.getAllDropdownOptions();
      
      // Try field ID first, then field name
      let options = allOptions.allOptions[fieldIdentifier];
      if (!options) {
        // Try normalized field name
        const normalized = fieldIdentifier.toLowerCase().replace(/\s+/g, '_');
        options = allOptions.allOptions[normalized];
      }
      
      if (!options) {
        throw new Error(`Field not found: ${fieldIdentifier}`);
      }
      
      return options;
      
    } catch (error) {
      console.error(`Error getting options for field ${fieldIdentifier}:`, error.message);
      throw error;
    }
  }

  /**
   * Get options by category
   */
  async getOptionsByCategory(category) {
    try {
      const allOptions = await this.getAllDropdownOptions();
      return allOptions.optionsByCategory[category] || {};
    } catch (error) {
      console.error(`Error getting options for category ${category}:`, error.message);
      throw error;
    }
  }

  /**
   * Search options across all fields
   */
  async searchOptions(query) {
    try {
      const allOptions = await this.getAllDropdownOptions();
      const searchTerm = query.toLowerCase();
      const results = [];
      
      for (const [fieldKey, fieldOptions] of Object.entries(allOptions.allOptions)) {
        // Skip duplicate entries (we store by both ID and name)
        if (fieldKey.includes('-')) continue; // Skip UUID-format field IDs
        
        const matchingOptions = fieldOptions.options.filter(option =>
          option.label.toLowerCase().includes(searchTerm) ||
          option.name.toLowerCase().includes(searchTerm)
        );
        
        if (matchingOptions.length > 0) {
          results.push({
            fieldName: fieldOptions.fieldName,
            fieldCategory: fieldOptions.category,
            matchingOptions,
            totalMatches: matchingOptions.length
          });
        }
      }
      
      return results;
      
    } catch (error) {
      console.error(`Error searching options for "${query}":`, error.message);
      throw error;
    }
  }

  /**
   * Get options formatted for specific UI components
   */
  async getOptionsForUI(fieldIdentifier, format = 'react-select') {
    try {
      const fieldOptions = await this.getOptionsForField(fieldIdentifier);
      
      switch (format) {
        case 'react-select':
          return fieldOptions.options.map(option => ({
            value: option.value,
            label: option.label,
            color: option.color
          }));
          
        case 'native-select':
          return fieldOptions.options.map(option => ({
            value: option.value,
            text: option.label
          }));
          
        case 'checkbox-list':
          return fieldOptions.options.map(option => ({
            id: option.value,
            label: option.label,
            checked: false,
            color: option.color
          }));
          
        default:
          return fieldOptions.options;
      }
      
    } catch (error) {
      console.error(`Error formatting options for UI:`, error.message);
      throw error;
    }
  }

  /**
   * Get summary statistics about all dropdown options
   */
  async getOptionsSummary() {
    try {
      const allOptions = await this.getAllDropdownOptions();
      
      const summary = {
        totalFields: Object.keys(allOptions.fieldMetadata).length,
        totalOptions: allOptions.metadata.totalOptionsProcessed,
        categories: {},
        topFields: []
      };
      
      // Category breakdown
      for (const [category, fields] of Object.entries(allOptions.optionsByCategory)) {
        const categoryOptionCount = Object.values(fields).reduce((sum, field) => sum + field.options.length, 0);
        summary.categories[category] = {
          fieldCount: Object.keys(fields).length,
          optionCount: categoryOptionCount
        };
      }
      
      // Top fields by option count
      summary.topFields = Object.values(allOptions.fieldMetadata)
        .sort((a, b) => b.optionCount - a.optionCount)
        .slice(0, 5)
        .map(field => ({
          name: field.name,
          category: field.category,
          optionCount: field.optionCount,
          listName: field.listName
        }));
      
      return summary;
      
    } catch (error) {
      console.error('Error generating options summary:', error.message);
      throw error;
    }
  }

  /**
   * Check if cache is valid
   */
  isCacheValid(key) {
    const cached = this.cache.get(key);
    if (!cached || !cached.metadata) return false;
    
    const cacheTime = new Date(cached.metadata.fetchTime).getTime();
    return (Date.now() - cacheTime) < this.CACHE_TTL;
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.cache.clear();
    console.log('🗑️ Dropdown options cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      totalCacheEntries: this.cache.size,
      cacheKeys: Array.from(this.cache.keys()),
      ttl: this.CACHE_TTL,
      ttlMinutes: this.CACHE_TTL / (60 * 1000)
    };
  }
}

// Create singleton instance
const dropdownOptions = new DropdownOptionsService();

module.exports = {
  DropdownOptionsService,
  dropdownOptions
}; 