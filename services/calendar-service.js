const { Client } = require('@microsoft/microsoft-graph-client');
const { AuthenticationProvider } = require('@microsoft/microsoft-graph-client');

class CalendarService {
  constructor() {
    this.graphClient = null;
    this.initializeClient();
  }

  async initializeClient() {
    // Custom auth provider for your app
    const authProvider = {
      getAccessToken: async () => {
        // Your OAuth flow here - could be client credentials or user auth
        return await this.getAccessToken();
      }
    };

    this.graphClient = Client.initWithMiddleware({ authProvider });
  }

  async getAccessToken() {
    // Implement OAuth2 flow using your Azure app credentials
    const tokenEndpoint = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;
    
    const body = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body
    });

    const data = await response.json();
    return data.access_token;
  }

  /**
   * Send calendar invite for an orientation class
   * @param {Object} classData - Class information from ClickUp
   * @param {Array} orientees - List of orientees with email addresses
   */
  async sendClassCalendarInvite(classData, orientees) {
    try {
      const startDate = new Date(classData.startDate);
      const endDate = new Date(startDate);
      endDate.setHours(startDate.getHours() + 2); // 2-hour sessions

      // TODO: With additional permissions, add conflict checking:
      // const conflicts = await this.checkCalendarConflicts(startDate, attendees);
      // if (conflicts.length > 0) { /* handle conflicts */ }

      // TODO: With OnlineMeetings.ReadWrite permission, add Teams meeting:
      // const teamsMeeting = await this.createTeamsMeeting(classData);

      const event = {
        subject: `PD Orientation - Week ${classData.week} Day ${classData.day}`,
        body: {
          contentType: 'HTML',
          content: `
            <h3>PD Orientation Session</h3>
            <p><strong>Week:</strong> ${classData.week}</p>
            <p><strong>Day:</strong> ${classData.day}</p>
            <p><strong>Subject:</strong> ${classData.subject}</p>
            <p><strong>Lead:</strong> ${classData.lead}</p>
            
            <h4>Orientees:</h4>
            <ul>
              ${orientees.map(o => `<li>${o.name} (${o.cogentEmail})</li>`).join('')}
            </ul>
            
            <!-- TODO: Add Teams meeting link when OnlineMeetings permission is available -->
            <!-- <p><strong>Teams Meeting:</strong> <a href="${teamsMeeting.joinUrl}">Join Meeting</a></p> -->
          `
        },
        start: {
          dateTime: startDate.toISOString(),
          timeZone: 'America/New_York'
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: 'America/New_York'
        },
        attendees: [
          // Add orientees
          ...orientees.map(orientee => ({
            emailAddress: {
              address: orientee.cogentEmail,
              name: orientee.name
            },
            type: 'required'
          })),
          // Add lead instructor
          {
            emailAddress: {
              address: classData.leadEmail,
              name: classData.lead
            },
            type: 'required'
          }
        ],
        location: {
          displayName: 'Cogent Analytics Office / Virtual'
        }
      };

      // Send from orientation email if configured
      const fromEmail = process.env.ORIENTATION_FROM_EMAIL || 'orientation@cogentanalytics.com';
      
      const result = await this.graphClient
        .users(fromEmail)
        .events
        .post(event);

      console.log(`✅ Calendar invite sent for ${classData.subject} - Event ID: ${result.id}`);
      return result;

    } catch (error) {
      console.error('❌ Failed to send calendar invite:', error);
      throw error;
    }
  }

  /**
   * Send welcome email to new orientee
   * @param {Object} orientee - Orientee information
   * @param {Object} classData - Class information
   */
  async sendWelcomeEmail(orientee, classData) {
    try {
      const message = {
        subject: `Welcome to PD Orientation - Starting ${classData.startDate}`,
        body: {
          contentType: 'HTML',
          content: `
            <h2>Welcome to Cogent Analytics PD Orientation!</h2>
            
            <p>Hi ${orientee.name},</p>
            
            <p>Welcome to the team! Your PD Orientation will begin on <strong>${classData.startDate}</strong>.</p>
            
            <h3>Class Details:</h3>
            <ul>
              <li><strong>Start Date:</strong> ${classData.startDate}</li>
              <li><strong>Your Pillar:</strong> ${orientee.pillar}</li>
              <li><strong>Your Email:</strong> ${orientee.cogentEmail}</li>
            </ul>
            
            <p>You'll receive calendar invites for each session shortly. If you have any questions, please don't hesitate to reach out!</p>
            
            <p>Best regards,<br>The Cogent Analytics Team</p>
          `
        },
        toRecipients: [{
          emailAddress: {
            address: orientee.cogentEmail,
            name: orientee.name
          }
        }]
      };

      const fromEmail = process.env.ORIENTATION_FROM_EMAIL || 'orientation@cogentanalytics.com';
      
      await this.graphClient
        .users(fromEmail)
        .sendMail({
          message,
          saveToSentItems: true
        });

      console.log(`✅ Welcome email sent to ${orientee.name} (${orientee.cogentEmail})`);

    } catch (error) {
      console.error(`❌ Failed to send welcome email to ${orientee.name}:`, error);
      throw error;
    }
  }

  /**
   * Bulk send calendar invites for an entire class
   * @param {string} classId - ClickUp folder ID for the class
   */
  async sendAllClassInvites(classId) {
    try {
      // This would integrate with your existing ClickUp services
      const ClickUpLessonReader = require('./clickup-lesson-reader');
      const reader = new ClickUpLessonReader();
      
      const lessons = await reader.getClassLessons(classId);
      const orientees = await reader.getClassOrientees(classId);
      
      for (const lesson of lessons) {
        await this.sendClassCalendarInvite(lesson, orientees);
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`✅ All calendar invites sent for class ${classId}`);
      
    } catch (error) {
      console.error('❌ Failed to send class invites:', error);
      throw error;
    }
  }

  // ===========================
  // FUTURE FEATURES (require additional permissions)
  // ===========================

  /**
   * Check for calendar conflicts before scheduling (requires Calendars.Read)
   * @param {Date} startTime - Proposed start time
   * @param {Array} attendees - List of attendee email addresses
   */
  async checkCalendarConflicts(startTime, attendees) {
    // TODO: Implement with Calendars.Read permission
    // const conflicts = await this.graphClient
    //   .users(attendee.email)
    //   .calendar
    //   .calendarView
    //   .get({ startDateTime: startTime, endDateTime: endTime });
    
    console.log('🔮 Conflict checking will be available with Calendars.Read permission');
    return [];
  }

  /**
   * Create Teams meeting link (requires OnlineMeetings.ReadWrite)
   * @param {Object} classData - Class information
   */
  async createTeamsMeeting(classData) {
    // TODO: Implement with OnlineMeetings.ReadWrite permission
    // const meeting = await this.graphClient
    //   .users(fromEmail)
    //   .onlineMeetings
    //   .post({
    //     subject: `PD Orientation - ${classData.subject}`,
    //     startDateTime: classData.startDate,
    //     endDateTime: classData.endDate
    //   });
    
    console.log('🔮 Teams meeting creation will be available with OnlineMeetings.ReadWrite permission');
    return { joinUrl: 'https://teams.microsoft.com/...' };
  }

  /**
   * Attach orientation materials from SharePoint (requires Sites.ReadWrite.All)
   * @param {string} eventId - Calendar event ID
   * @param {Array} documentPaths - SharePoint document paths
   */
  async attachOrientationMaterials(eventId, documentPaths) {
    // TODO: Implement with Sites.ReadWrite.All permission
    // for (const docPath of documentPaths) {
    //   const file = await this.graphClient
    //     .sites('cogentanalytics.sharepoint.com')
    //     .drive
    //     .root
    //     .itemWithPath(docPath)
    //     .get();
    //   
    //   // Attach file to calendar event
    //   await this.graphClient
    //     .users(fromEmail)
    //     .events(eventId)
    //     .attachments
    //     .post({ /* attachment data */ });
    // }
    
    console.log('🔮 SharePoint integration will be available with Sites.ReadWrite.All permission');
  }

  /**
   * Get user timezone for accurate scheduling (requires MailboxSettings.Read)
   * @param {string} userEmail - User email address
   */
  async getUserTimezone(userEmail) {
    // TODO: Implement with MailboxSettings.Read permission
    // const settings = await this.graphClient
    //   .users(userEmail)
    //   .mailboxSettings
    //   .get();
    // 
    // return settings.timeZone || 'America/New_York';
    
    console.log('🔮 Timezone detection will be available with MailboxSettings.Read permission');
    return 'America/New_York'; // Default for now
  }
}

module.exports = CalendarService; 