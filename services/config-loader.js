const fs = require('fs');
const path = require('path');

/**
 * Configuration Loader Service
 * Loads, validates, and provides access to all configuration files
 */
class ConfigurationLoader {
  constructor() {
    this.configPath = path.join(__dirname, '..', 'config');
    this.configs = {};
    this.loaded = false;
    this.lastLoadTime = null;
    this.validationErrors = [];
  }

  /**
   * Load all configuration files
   */
  async loadConfigurations() {
    try {
      console.log('🔧 Loading configuration files...');
      
      // Reset state
      this.configs = {};
      this.validationErrors = [];
      
      // Load lesson templates
      console.log('📚 Loading lesson templates...');
      this.configs.lessons = await this.loadJsonConfig('lesson-templates.json');
      this.validateLessonTemplates();
      
      // Load field mappings
      console.log('🏷️ Loading field mappings...');
      this.configs.fields = await this.loadJsonConfig('field-mappings.json');
      this.validateFieldMappings();
      
      // Load user assignments
      console.log('👥 Loading user assignments...');
      this.configs.users = await this.loadJsonConfig('user-assignments.json');
      this.validateUserAssignments();
      
      // Cross-validate configurations
      this.crossValidateConfigurations();
      
      this.loaded = true;
      this.lastLoadTime = new Date();
      
      if (this.validationErrors.length > 0) {
        console.warn(`⚠️ Configuration loaded with ${this.validationErrors.length} warnings:`);
        this.validationErrors.forEach(error => console.warn(`   - ${error}`));
      } else {
        console.log('✅ All configurations loaded and validated successfully');
      }
      
      return {
        success: true,
        loadTime: this.lastLoadTime,
        warnings: this.validationErrors
      };
      
    } catch (error) {
      console.error('💥 Failed to load configurations:', error.message);
      this.loaded = false;
      throw error;
    }
  }

  /**
   * Load a JSON configuration file
   */
  async loadJsonConfig(filename) {
    const filePath = path.join(this.configPath, filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Configuration file not found: ${filename}`);
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const config = JSON.parse(content);
      
      console.log(`✅ Loaded ${filename} (v${config.version || 'unknown'})`);
      return config;
      
    } catch (error) {
      throw new Error(`Failed to parse ${filename}: ${error.message}`);
    }
  }

  /**
   * Validate lesson templates configuration
   */
  validateLessonTemplates() {
    const config = this.configs.lessons;
    
    // Check metadata consistency
    if (config.lessons.length !== config.metadata.totalLessons) {
      this.validationErrors.push(
        `Lesson count mismatch: ${config.lessons.length} lessons vs ${config.metadata.totalLessons} in metadata`
      );
    }
    
    // Validate lesson structure
    const requiredFields = ['id', 'name', 'dayOffset', 'week', 'weekDay'];
    config.lessons.forEach((lesson, index) => {
      requiredFields.forEach(field => {
        if (!lesson[field] && lesson[field] !== 0) {
          this.validationErrors.push(`Lesson ${index + 1} missing required field: ${field}`);
        }
      });
      
      // Validate day offset ranges
      if (typeof lesson.dayOffset !== 'number' || lesson.dayOffset < 0 || lesson.dayOffset > 10) {
        this.validationErrors.push(`Lesson ${lesson.name} has invalid dayOffset: ${lesson.dayOffset}`);
      }
    });
    
    // Check for duplicate IDs
    const ids = config.lessons.map(l => l.id);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      this.validationErrors.push(`Duplicate lesson IDs found: ${duplicateIds.join(', ')}`);
    }
  }

  /**
   * Validate field mappings configuration
   */
  validateFieldMappings() {
    const config = this.configs.fields;
    
    // Validate list IDs format (should be numeric strings)
    Object.entries(config.listIds).forEach(([listName, listId]) => {
      if (!/^\d+$/.test(listId)) {
        this.validationErrors.push(`Invalid list ID format for ${listName}: ${listId}`);
      }
    });
    
    // Validate custom field IDs format (should be UUID-like)
    Object.entries(config.customFields).forEach(([listType, fields]) => {
      Object.entries(fields).forEach(([fieldName, fieldConfig]) => {
        if (!fieldConfig.id || typeof fieldConfig.id !== 'string') {
          this.validationErrors.push(`Missing or invalid field ID for ${listType}.${fieldName}`);
        }
        
        if (!fieldConfig.type) {
          this.validationErrors.push(`Missing field type for ${listType}.${fieldName}`);
        }
      });
    });
    
    // Validate user IDs in userMappings (should be numeric strings)
    Object.entries(config.userMappings.instructors).forEach(([name, userId]) => {
      if (!/^\d+$/.test(userId)) {
        this.validationErrors.push(`Invalid user ID format for ${name}: ${userId}`);
      }
    });
  }

  /**
   * Validate user assignments configuration
   */
  validateUserAssignments() {
    const config = this.configs.users;
    
    // Check metadata consistency
    const actualInstructorCount = Object.keys(config.instructorProfiles).length;
    if (actualInstructorCount !== config.metadata.totalInstructors) {
      this.validationErrors.push(
        `Instructor count mismatch: ${actualInstructorCount} profiles vs ${config.metadata.totalInstructors} in metadata`
      );
    }
    
    // Validate instructor profiles
    Object.entries(config.instructorProfiles).forEach(([key, profile]) => {
      const requiredFields = ['id', 'name', 'email', 'role', 'status'];
      requiredFields.forEach(field => {
        if (!profile[field]) {
          this.validationErrors.push(`Instructor ${key} missing required field: ${field}`);
        }
      });
      
      // Validate email format
      if (profile.email && !profile.email.includes('@')) {
        this.validationErrors.push(`Invalid email format for instructor ${key}: ${profile.email}`);
      }
    });
  }

  /**
   * Cross-validate configurations for consistency
   */
  crossValidateConfigurations() {
    // Check that all lesson leads exist in user assignments
    if (this.configs.lessons && this.configs.users) {
      const allInstructorNames = Object.values(this.configs.users.instructorProfiles).map(p => p.name);
      
      this.configs.lessons.lessons.forEach(lesson => {
        if (lesson.leads && Array.isArray(lesson.leads)) {
          lesson.leads.forEach(leadName => {
            if (!allInstructorNames.includes(leadName)) {
              this.validationErrors.push(`Lesson "${lesson.name}" has unknown lead: ${leadName}`);
            }
          });
        }
      });
    }
    
    // Check that field mapping user IDs match user assignment IDs
    if (this.configs.fields && this.configs.users) {
      const fieldUserIds = Object.values(this.configs.fields.userMappings.instructors);
      const assignmentUserIds = Object.values(this.configs.users.instructorProfiles).map(p => p.id);
      
      fieldUserIds.forEach(userId => {
        if (!assignmentUserIds.includes(userId)) {
          this.validationErrors.push(`Field mapping has user ID not in assignments: ${userId}`);
        }
      });
    }
  }

  /**
   * Get lesson templates configuration
   */
  getLessonTemplates() {
    this.ensureLoaded();
    return this.configs.lessons;
  }

  /**
   * Get specific lessons by criteria
   */
  getLessons(filters = {}) {
    this.ensureLoaded();
    let lessons = [...this.configs.lessons.lessons];
    
    // Apply filters
    if (filters.week) {
      lessons = lessons.filter(l => l.week === filters.week);
    }
    
    if (filters.weekDay) {
      lessons = lessons.filter(l => l.weekDay === filters.weekDay);
    }
    
    if (filters.subject) {
      lessons = lessons.filter(l => l.subject === filters.subject);
    }
    
    if (filters.lead) {
      lessons = lessons.filter(l => l.leads && l.leads.includes(filters.lead));
    }
    
    if (filters.isActive !== undefined) {
      lessons = lessons.filter(l => l.isActive === filters.isActive);
    }
    
    return lessons;
  }

  /**
   * Get field mappings configuration
   */
  getFieldMappings() {
    this.ensureLoaded();
    return this.configs.fields;
  }

  /**
   * Get specific field configuration
   */
  getField(listType, fieldName) {
    this.ensureLoaded();
    const fields = this.configs.fields.customFields[listType];
    return fields ? fields[fieldName] : null;
  }

  /**
   * Get dropdown options for a specific field
   */
  getDropdownOptions(optionType) {
    this.ensureLoaded();
    return this.configs.fields.dropdownOptions[optionType] || {};
  }

  /**
   * Get user assignments configuration
   */
  getUserAssignments() {
    this.ensureLoaded();
    return this.configs.users;
  }

  /**
   * Get instructor profile by name or ID
   */
  getInstructor(nameOrId) {
    this.ensureLoaded();
    
    // Try by key first
    if (this.configs.users.instructorProfiles[nameOrId]) {
      return this.configs.users.instructorProfiles[nameOrId];
    }
    
    // Try by name
    const byName = Object.values(this.configs.users.instructorProfiles)
      .find(profile => profile.name === nameOrId);
    if (byName) return byName;
    
    // Try by ID
    const byId = Object.values(this.configs.users.instructorProfiles)
      .find(profile => profile.id === nameOrId);
    return byId || null;
  }

  /**
   * Get instructors by subject expertise
   */
  getInstructorsBySubject(subject) {
    this.ensureLoaded();
    const experts = this.configs.users.roleBasedAssignments.subjectExperts[subject] || [];
    return experts.map(key => this.configs.users.instructorProfiles[key]).filter(Boolean);
  }

  /**
   * Get configuration statistics
   */
  getStats() {
    this.ensureLoaded();
    
    return {
      loadTime: this.lastLoadTime,
      totalLessons: this.configs.lessons.lessons.length,
      totalInstructors: Object.keys(this.configs.users.instructorProfiles).length,
      totalFields: Object.values(this.configs.fields.customFields)
        .reduce((sum, fields) => sum + Object.keys(fields).length, 0),
      validationErrors: this.validationErrors.length,
      isValid: this.validationErrors.length === 0
    };
  }

  /**
   * Reload configurations (useful for development)
   */
  async reload() {
    console.log('🔄 Reloading configurations...');
    return await this.loadConfigurations();
  }

  /**
   * Ensure configurations are loaded
   */
  ensureLoaded() {
    if (!this.loaded) {
      throw new Error('Configurations not loaded. Call loadConfigurations() first.');
    }
  }

  /**
   * Get configuration file paths
   */
  getConfigPaths() {
    return {
      lessons: path.join(this.configPath, 'lesson-templates.json'),
      fields: path.join(this.configPath, 'field-mappings.json'),
      users: path.join(this.configPath, 'user-assignments.json')
    };
  }
}

// Create singleton instance
const configLoader = new ConfigurationLoader();

module.exports = {
  ConfigurationLoader,
  configLoader
}; 