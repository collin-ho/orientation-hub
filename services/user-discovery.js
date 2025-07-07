const { getSpaceMembers } = require('../utils/clickup-client');
const { configLoader } = require('./config-loader');

/**
 * User Discovery Service
 * Dynamically discovers and formats ClickUp users for configuration management
 */
class UserDiscoveryService {
  constructor() {
    this.SANDBOX_SPACE_ID = '16835428'; // 1000: Sandbox - All users have access (176 members)
    this.cache = null;
    this.cacheTime = null;
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Discover all users in the ClickUp workspace
   */
  async discoverUsers() {
    try {
      console.log('🔍 Discovering ClickUp users...');
      
      // Check cache first
      if (this.isCacheValid()) {
        console.log('✅ Using cached user data');
        return this.cache;
      }
      
      // Fetch fresh data from ClickUp
      const startTime = Date.now();
      const spaceMembers = await getSpaceMembers(this.SANDBOX_SPACE_ID);
      const elapsed = Date.now() - startTime;
      
      console.log(`✅ Fetched ${spaceMembers.length} users in ${elapsed}ms`);
      
      // Format user data for admin UI
      const formattedUsers = await this.formatUsers(spaceMembers);
      
      // Update cache
      this.cache = {
        users: formattedUsers,
        metadata: {
          totalUsers: formattedUsers.length,
          fetchTime: new Date().toISOString(),
          source: 'ClickUp Space Members API (Sandbox)',
          spaceId: this.SANDBOX_SPACE_ID,
          responseTime: elapsed
        },
        rawData: spaceMembers // Keep raw data for debugging
      };
      this.cacheTime = Date.now();
      
      return this.cache;
      
    } catch (error) {
      console.error('💥 User discovery failed:', error.message);
      
      // Return cached data if available, even if stale
      if (this.cache) {
        console.warn('⚠️ Returning stale cached user data due to API error');
        return {
          ...this.cache,
          metadata: {
            ...this.cache.metadata,
            stale: true,
            lastError: error.message,
            errorTime: new Date().toISOString()
          }
        };
      }
      
      throw new Error(`User discovery failed: ${error.message}`);
    }
  }

  /**
   * Format raw ClickUp user data for admin UI consumption
   */
  async formatUsers(spaceMembers) {
    const formattedUsers = [];
    
    for (const member of spaceMembers) {
      // Extract user data (ClickUp returns wrapped user objects)
      const user = member.user || member;
      
      const formattedUser = {
        id: user.id?.toString(),
        name: user.username || 'Unknown User',
        email: user.email || '',
        initials: user.initials || '',
        color: user.color || '#808080',
        profilePicture: user.profilePicture || null,
        
        // Additional metadata for admin UI
        displayName: user.username || user.email || `User ${user.id}`,
        isActive: true, // All fetched users are considered active
        source: 'clickup',
        lastSeen: new Date().toISOString(),
        
        // Admin UI specific fields
        canBeAssigned: true,
        isInstructor: await this.isKnownInstructor(user.username),
        estimatedRole: await this.estimateUserRole(user.username)
      };
      
      formattedUsers.push(formattedUser);
    }
    
    return formattedUsers;
  }

  /**
   * Check if user is a known instructor from our configuration
   */
  async isKnownInstructor(username) {
    try {
      // Ensure config is loaded
      if (!configLoader.loaded) {
        await configLoader.loadConfigurations();
      }
      
      // Get actual lesson leads from configuration
      const lessons = configLoader.getLessons();
      const allLeads = new Set();
      
      // Extract all unique lesson leads
      lessons.forEach(lesson => {
        if (lesson.leads && Array.isArray(lesson.leads)) {
          lesson.leads.forEach(lead => allLeads.add(lead));
        }
      });
      
      // Check if username is in the actual instructor list
      return allLeads.has(username);
      
    } catch (error) {
      console.warn('⚠️ Could not load lesson configuration, falling back to hardcoded list:', error.message);
      
      // Fallback to hardcoded list if config loading fails
      const knownInstructors = [
        'Adam Williams', 'Tim Grabrovaz', 'Pete Villari', 'Josh Bresler',
        'Kai Hungerford', 'Ryland McClain-Rubin', 'Dakota Madison', 'Raul Ruiz',
        'Billy Hardison', 'Rob Braiman', 'Joshua Harvey', 'Randi Rhinehardt',
        'Isabelle Welch', 'Kaitlyn Tedder', 'CJ Johnson', 'SarahRose Mosh',
        'Ronnie Blanton', 'Nathan Stone', 'Shane Wilson', 'Ethan Prehoda',
        'Caleb Connerty'
      ];
      
      return knownInstructors.includes(username);
    }
  }

  /**
   * Estimate user role based on name patterns and configuration data
   */
  async estimateUserRole(username) {
    if (!username) return 'Unknown';
    
    try {
      // Ensure config is loaded
      if (!configLoader.loaded) {
        await configLoader.loadConfigurations();
      }
      
      // Get instructor data from user assignments configuration
      const userAssignments = configLoader.getUserAssignments();
      const instructor = Object.values(userAssignments.instructorProfiles)
        .find(profile => profile.name === username);
      
      if (instructor) {
        return instructor.role || 'Instructor';
      }
      
    } catch (error) {
      console.warn('⚠️ Could not load user assignments, using basic role estimation');
    }
    
    // Fallback to basic role estimation
    if (username.includes('Rob Braiman')) return 'Owner';
    if (username.includes('Caleb Connerty')) return 'Vice President'; 
    if (username.includes('Adam Williams')) return 'Associate Director';
    if (username.includes('Pete Villari')) return 'LifeCycle Director';
    
    // Default for known instructors
    if (await this.isKnownInstructor(username)) {
      return 'Instructor';
    }
    
    return 'Team Member';
  }

  /**
   * Get users formatted for dropdown components
   */
  async getUsersForDropdown() {
    const result = await this.discoverUsers();
    
    return result.users.map(user => ({
      value: user.id,
      label: user.displayName,
      email: user.email,
      initials: user.initials,
      color: user.color,
      isInstructor: user.isInstructor,
      role: user.estimatedRole
    }));
  }

  /**
   * Get instructors only (filtered for lesson assignment)
   */
  async getInstructorsOnly() {
    const result = await this.discoverUsers();
    
    return result.users.filter(user => user.isInstructor);
  }

  /**
   * Search users by name or email
   */
  async searchUsers(query) {
    const result = await this.discoverUsers();
    const searchTerm = query.toLowerCase();
    
    return result.users.filter(user => 
      user.name.toLowerCase().includes(searchTerm) ||
      user.email.toLowerCase().includes(searchTerm) ||
      user.displayName.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    const result = await this.discoverUsers();
    return result.users.find(user => user.id === userId.toString());
  }

  /**
   * Check if cache is still valid
   */
  isCacheValid() {
    return this.cache && 
           this.cacheTime && 
           (Date.now() - this.cacheTime) < this.CACHE_TTL;
  }

  /**
   * Clear cache (useful for development/testing)
   */
  clearCache() {
    this.cache = null;
    this.cacheTime = null;
    console.log('🗑️ User discovery cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      isCached: !!this.cache,
      cacheAge: this.cacheTime ? Date.now() - this.cacheTime : null,
      cacheValid: this.isCacheValid(),
      ttl: this.CACHE_TTL,
      userCount: this.cache?.users?.length || 0
    };
  }

  /**
   * Get instructor analysis - compare ClickUp users vs lesson leads
   */
  async getInstructorAnalysis() {
    try {
      // Ensure config is loaded
      if (!configLoader.loaded) {
        await configLoader.loadConfigurations();
      }
      
      // Get ClickUp users
      const result = await this.discoverUsers();
      const clickupUsers = result.users;
      
      // Get lesson leads from configuration
      const lessons = configLoader.getLessons();
      const allLeads = new Set();
      lessons.forEach(lesson => {
        if (lesson.leads && Array.isArray(lesson.leads)) {
          lesson.leads.forEach(lead => allLeads.add(lead));
        }
      });
      const lessonLeads = Array.from(allLeads);
      
      // Identify instructors found in ClickUp
      const instructorsInClickup = clickupUsers
        .filter(user => user.isInstructor)
        .map(user => user.name);
      
      // Find lesson leads NOT in ClickUp
      const leadsNotInClickup = lessonLeads.filter(lead => 
        !instructorsInClickup.includes(lead)
      );
      
      // Find ClickUp users marked as instructors but not lesson leads
      const clickupInstructorsNotLeads = instructorsInClickup.filter(instructor =>
        !lessonLeads.includes(instructor)
      );
      
      return {
        summary: {
          totalLessonLeads: lessonLeads.length,
          totalClickupUsers: clickupUsers.length,
          instructorsInClickup: instructorsInClickup.length,
          leadsNotFound: leadsNotInClickup.length,
          clickupOnlyInstructors: clickupInstructorsNotLeads.length
        },
        details: {
          lessonLeads,
          instructorsInClickup,
          leadsNotInClickup,
          clickupInstructorsNotLeads,
          allClickupUsers: clickupUsers.map(u => ({
            name: u.name,
            email: u.email,
            isInstructor: u.isInstructor,
            role: u.estimatedRole
          }))
        }
      };
      
    } catch (error) {
      throw new Error(`Instructor analysis failed: ${error.message}`);
    }
  }
}

// Create singleton instance
const userDiscovery = new UserDiscoveryService();

module.exports = {
  UserDiscoveryService,
  userDiscovery
}; 