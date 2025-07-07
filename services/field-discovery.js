const { getCustomFields, getSpaceCustomFields } = require('../utils/clickup-client');

/**
 * Field Discovery Service
 * Dynamically discovers and formats ClickUp custom fields for configuration management
 */
class FieldDiscoveryService {
  constructor() {
    this.WORKSHOP_SPACE_ID = '14869535';
    this.KNOWN_LISTS = {
      schedule: '901409248233',
      classDetails: '901409267881', 
      feedbackGrades: '901409111922'
    };
    // Fields to exclude from discovery (exist in ClickUp but not needed for configuration)
    // These fields exist in the ClickUp lists but are not part of our class creation scope
    // Excluding them prevents INFO validation messages in the FieldMapping component
    this.EXCLUDED_FIELDS = [
      '05ef80cd-d97c-491c-8699-f3f35c4418ce', // Date & Time - not used in class templates
      '8a428012-a9db-4e3b-8512-734d01c4d464'  // Active Date - not used in class templates
    ];
    this.cache = new Map();
    this.CACHE_TTL = 10 * 60 * 1000; // 10 minutes for fields (change less frequently)
  }

  /**
   * Discover all custom fields across all known lists
   */
  async discoverAllFields() {
    try {
      console.log('🔍 Discovering ClickUp custom fields...');
      
      // Check cache first
      const cacheKey = 'all-fields';
      if (this.isCacheValid(cacheKey)) {
        console.log('✅ Using cached field data');
        return this.cache.get(cacheKey);
      }
      
      const startTime = Date.now();
      const fieldsByList = {};
      const allFields = [];
      
      // Fetch fields from each known list
      for (const [listName, listId] of Object.entries(this.KNOWN_LISTS)) {
        try {
          console.log(`  📋 Fetching fields for ${listName} list...`);
          const fields = await getCustomFields(listId);
          
          const formattedFields = this.formatFields(fields, listName, listId);
          fieldsByList[listName] = formattedFields;
          allFields.push(...formattedFields);
          
          console.log(`  ✅ Found ${fields.length} fields in ${listName}`);
          
        } catch (error) {
          console.warn(`  ⚠️ Failed to fetch ${listName} fields:`, error.message);
          fieldsByList[listName] = [];
        }
      }
      
      const elapsed = Date.now() - startTime;
      console.log(`✅ Discovered ${allFields.length} total fields in ${elapsed}ms`);
      
      // Build result with metadata
      const result = {
        fields: allFields,
        fieldsByList,
        metadata: {
          totalFields: allFields.length,
          listsScanned: Object.keys(this.KNOWN_LISTS).length,
          fetchTime: new Date().toISOString(),
          source: 'ClickUp Custom Fields API',
          responseTime: elapsed,
          listBreakdown: Object.entries(fieldsByList).reduce((acc, [list, fields]) => {
            acc[list] = fields.length;
            return acc;
          }, {})
        }
      };
      
      // Update cache
      this.cache.set(cacheKey, result);
      
      return result;
      
    } catch (error) {
      console.error('💥 Field discovery failed:', error.message);
      
      // Return cached data if available, even if stale
      const staleData = this.cache.get('all-fields');
      if (staleData) {
        console.warn('⚠️ Returning stale cached field data due to API error');
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
      
      throw new Error(`Field discovery failed: ${error.message}`);
    }
  }

  /**
   * Discover fields for a specific list
   */
  async discoverFieldsForList(listName) {
    try {
      const listId = this.KNOWN_LISTS[listName];
      if (!listId) {
        throw new Error(`Unknown list: ${listName}. Known lists: ${Object.keys(this.KNOWN_LISTS).join(', ')}`);
      }
      
      const cacheKey = `list-${listName}`;
      if (this.isCacheValid(cacheKey)) {
        console.log(`✅ Using cached field data for ${listName}`);
        return this.cache.get(cacheKey);
      }
      
      console.log(`🔍 Discovering fields for ${listName} list...`);
      const startTime = Date.now();
      
      const fields = await getCustomFields(listId);
      const formattedFields = this.formatFields(fields, listName, listId);
      const elapsed = Date.now() - startTime;
      
      const result = {
        fields: formattedFields,
        metadata: {
          listName,
          listId,
          fieldCount: formattedFields.length,
          fetchTime: new Date().toISOString(),
          responseTime: elapsed
        }
      };
      
      this.cache.set(cacheKey, result);
      console.log(`✅ Found ${formattedFields.length} fields for ${listName} in ${elapsed}ms`);
      
      return result;
      
    } catch (error) {
      console.error(`💥 Field discovery failed for ${listName}:`, error.message);
      throw error;
    }
  }

  /**
   * Format raw ClickUp field data for admin UI consumption
   */
  formatFields(fields, listName, listId) {
    // Filter out excluded fields first
    const filteredFields = fields.filter(field => !this.EXCLUDED_FIELDS.includes(field.id));
    
    return filteredFields.map(field => ({
      // Basic field info
      id: field.id,
      name: field.name,
      type: field.type,
      required: field.required || false,
      
      // List context
      listName,
      listId,
      
      // Type-specific configurations
      typeConfig: this.extractTypeConfig(field),
      
      // Admin UI specific metadata
      displayName: field.name,
      description: this.generateFieldDescription(field),
      category: this.categorizeField(field),
      
      // Validation info
      hasOptions: this.hasDropdownOptions(field),
      optionCount: this.getOptionCount(field),
      
      // Integration readiness
      isConfigurable: this.isFieldConfigurable(field),
      supportedOperations: this.getSupportedOperations(field),
      
      // Raw data for debugging
      rawField: field
    }));
  }

  /**
   * Extract type-specific configuration
   */
  extractTypeConfig(field) {
    if (!field.type_config) return null;
    
    const config = { ...field.type_config };
    
    // Normalize options format for consistent handling
    if (config.options && Array.isArray(config.options)) {
      config.formattedOptions = config.options.map(opt => ({
        id: opt.id,
        name: opt.name || opt.label || 'Unnamed Option',
        color: opt.color || '#808080',
        orderindex: opt.orderindex || 0
      }));
    }
    
    return config;
  }

  /**
   * Generate human-readable field description
   */
  generateFieldDescription(field) {
    const descriptions = {
      'drop_down': `Dropdown field with ${this.getOptionCount(field)} options`,
      'text': 'Text input field',
      'textarea': 'Multi-line text field', 
      'number': 'Numeric input field',
      'date': 'Date picker field',
      'users': 'User assignment field',
      'labels': 'Multiple choice labels field',
      'url': 'URL/link field',
      'email': 'Email address field',
      'phone': 'Phone number field'
    };
    
    return descriptions[field.type] || `${field.type} field`;
  }

  /**
   * Categorize field for UI organization
   */
  categorizeField(field) {
    // Assignment-related fields
    if (field.type === 'users' || field.name.toLowerCase().includes('lead')) {
      return 'assignments';
    }
    
    // Dropdown/selection fields
    if (field.type === 'drop_down' || field.type === 'labels') {
      return 'selections';
    }
    
    // Contact/profile fields
    if (field.type === 'email' || field.type === 'url' || field.type === 'phone') {
      return 'contact';
    }
    
    // Temporal fields
    if (field.type === 'date') {
      return 'scheduling';
    }
    
    // Default
    return 'general';
  }

  /**
   * Check if field has dropdown options
   */
  hasDropdownOptions(field) {
    return field.type_config?.options && Array.isArray(field.type_config.options);
  }

  /**
   * Get option count for dropdown fields
   */
  getOptionCount(field) {
    if (!this.hasDropdownOptions(field)) return 0;
    return field.type_config.options.length;
  }

  /**
   * Check if field can be configured through admin UI
   */
  isFieldConfigurable(field) {
    // Most fields are configurable, but some system fields might not be
    const nonConfigurableTypes = ['formula', 'rollup'];
    return !nonConfigurableTypes.includes(field.type);
  }

  /**
   * Get supported operations for this field type
   */
  getSupportedOperations(field) {
    const operations = {
      'drop_down': ['view', 'add_option', 'remove_option', 'reorder_options'],
      'text': ['view', 'set_default'],
      'users': ['view', 'set_defaults'],
      'labels': ['view', 'add_label', 'remove_label'],
      'number': ['view', 'set_range', 'set_default'],
      'date': ['view', 'set_default_range']
    };
    
    return operations[field.type] || ['view'];
  }

  /**
   * Get fields formatted for dropdown components
   */
  async getFieldsForDropdown() {
    const result = await this.discoverAllFields();
    
    return result.fields.map(field => ({
      value: field.id,
      label: `${field.name} (${field.listName})`,
      type: field.type,
      listName: field.listName,
      hasOptions: field.hasOptions,
      category: field.category
    }));
  }

  /**
   * Get dropdown options for a specific field
   */
  async getFieldOptions(fieldId) {
    try {
      const allFields = await this.discoverAllFields();
      const field = allFields.fields.find(f => f.id === fieldId);
      
      if (!field) {
        throw new Error(`Field not found: ${fieldId}`);
      }
      
      if (!field.hasOptions) {
        return { field: field.name, options: [], message: 'Field does not have dropdown options' };
      }
      
      return {
        field: field.name,
        type: field.type,
        options: field.typeConfig.formattedOptions || [],
        totalOptions: field.optionCount
      };
      
    } catch (error) {
      console.error(`Error getting options for field ${fieldId}:`, error.message);
      throw error;
    }
  }

  /**
   * Search fields by name or type
   */
  async searchFields(query) {
    const result = await this.discoverAllFields();
    const searchTerm = query.toLowerCase();
    
    return result.fields.filter(field => 
      field.name.toLowerCase().includes(searchTerm) ||
      field.type.toLowerCase().includes(searchTerm) ||
      field.listName.toLowerCase().includes(searchTerm) ||
      field.category.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Get fields by category
   */
  async getFieldsByCategory(category) {
    const result = await this.discoverAllFields();
    return result.fields.filter(field => field.category === category);
  }

  /**
   * Check if cache is still valid
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
    console.log('🗑️ Field discovery cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const cacheKeys = Array.from(this.cache.keys());
    const stats = {
      totalCacheEntries: cacheKeys.length,
      cacheKeys,
      ttl: this.CACHE_TTL
    };
    
    // Add age info for each cache entry
    cacheKeys.forEach(key => {
      const cached = this.cache.get(key);
      if (cached?.metadata?.fetchTime) {
        const age = Date.now() - new Date(cached.metadata.fetchTime).getTime();
        stats[`${key}_age`] = age;
        stats[`${key}_valid`] = age < this.CACHE_TTL;
      }
    });
    
    return stats;
  }
}

// Create singleton instance
const fieldDiscovery = new FieldDiscoveryService();

module.exports = {
  FieldDiscoveryService,
  fieldDiscovery
}; 