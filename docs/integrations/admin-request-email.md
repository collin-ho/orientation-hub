# Email Request to IT Admin - Microsoft Graph API Setup

**Subject:** Azure App Registration Request - Orientation Management System Calendar Integration

---

Hi [Admin Name],

I hope this email finds you well. I'm reaching out to request assistance with setting up a Microsoft Graph API integration for our Orientation Management System. This integration will automate calendar invites and email notifications for our PD orientation classes, eliminating manual scheduling work and ensuring consistent communication.

## **Business Justification**

Currently, our orientation process requires manual creation of calendar invites for each session (typically 10+ sessions per class) and individual welcome emails to orientees. This automation will:

- **Save 2-3 hours per orientation class** in manual scheduling
- **Eliminate scheduling errors** and missed invitations  
- **Ensure consistent professional communication** from a dedicated orientation email
- **Improve orientee experience** with timely, automated welcome emails
- **Integrate seamlessly** with our existing ClickUp-based orientation tracking system

## **Technical Requirements**

I need an **Azure App Registration** created with Microsoft Graph API permissions to enable our Node.js application to send calendar invites and emails on behalf of our organization.

### **Step 1: Create App Registration**

Please navigate to: `Azure Portal → Azure Active Directory → App Registrations → New Registration`

**Configuration Details:**
```
Application Name: "Cogent Analytics - Orientation Management System"
Supported Account Types: "Accounts in this organizational directory only (Cogent Analytics only)"
Redirect URI Type: Web
Redirect URIs: 
  - http://localhost:4000/auth/callback (for development testing)
  - [Production URL to be added later when ready for deployment]
```

**Note:** I'll provide the production redirect URI when we're ready to deploy the system. For now, the localhost URL is sufficient for development and testing.

### **Step 2: Configure API Permissions**

The application requires these Microsoft Graph permissions:

**Calendar Permissions:**
- `Calendars.ReadWrite` - Create and manage calendar events for orientation sessions
- `Calendars.ReadWrite.Shared` - Access shared calendars if we use a shared orientation calendar
- `Calendars.Read` - Check for scheduling conflicts before creating events

**Email Permissions:**
- `Mail.Send` - Send welcome emails and notifications to orientees  
- `Mail.Send.Shared` - Send emails from shared mailbox (orientation@cogentanalytics.com)

**User & Directory Permissions:**
- `User.Read` - Read basic user profile information
- `User.Read.All` - Look up user profiles to add instructors to calendar invites
- `Directory.Read.All` - Enhanced user discovery and organizational structure access

**Teams & Meeting Permissions:**
- `OnlineMeetings.ReadWrite` - Create Teams meeting links for virtual orientation sessions
- `MailboxSettings.Read` - Respect user timezone preferences for accurate scheduling

**Future-Proofing Permissions (Optional but Recommended):**
- `Sites.ReadWrite.All` - SharePoint integration for orientation materials
- `Files.ReadWrite.All` - Document management and attachment capabilities
- `Group.ReadWrite.All` - Cohort group management for organizing orientees

**Important:** All these permissions require **Admin Consent** since they access organizational data.

**Why Request Future-Proofing Permissions Now:**
- Avoids multiple admin requests as we add features
- SharePoint integration is already planned in our roadmap
- Teams meeting links will be essential for hybrid/remote orientations
- Document management supports compliance and record-keeping requirements

### **Step 3: Grant Admin Consent**

After adding the permissions:
1. Go to `API Permissions` tab in the app registration
2. Click **"Grant admin consent for Cogent Analytics"**
3. Confirm consent for all requested permissions

### **Step 4: Create Client Secret**

1. Navigate to `Certificates & secrets` → `Client secrets` → `New client secret`
2. **Description:** "Orientation System - Production Secret"  
3. **Expiration:** 24 months (recommended for production stability)
4. **Important:** Copy the secret **VALUE** (not the Secret ID) immediately - it won't be shown again

### **Step 5: Optional - Shared Mailbox Setup (Recommended)**

For professional communication, please create a shared mailbox:

**Location:** `Microsoft 365 Admin Center → Teams & groups → Shared mailboxes`

**Configuration:**
```
Email: orientation@cogentanalytics.com
Display Name: "Cogent Analytics - PD Orientation"  
Description: "Automated orientation management communications"
```

**Permissions:** Please add the following accounts with "Send As" permissions:
- My account: [your-email@cogentanalytics.com]
- Any other team members who manage orientations

**Alternative:** If creating a shared mailbox isn't feasible, the system can send from my existing email address.

## **Security Considerations**

This integration follows Microsoft security best practices:

- **Client Credentials Flow** - No user interaction required, runs as service
- **Principle of Least Privilege** - Only requests necessary permissions
- **Environment Variables** - All secrets stored securely, never in code
- **Audit Trail** - All calendar/email actions are logged
- **Expiring Secrets** - Client secret has 24-month expiration for regular rotation

**Security Documentation References:**
- [Microsoft Graph Security Best Practices](https://learn.microsoft.com/en-us/graph/best-practices-concept)
- [OAuth 2.0 Client Credentials Best Practices](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow)
- [Azure Secret Management Best Practices](https://learn.microsoft.com/en-us/azure/security/fundamentals/secrets-best-practices)
- [Application Security Guidelines](https://learn.microsoft.com/en-us/azure/well-architected/security/application-secrets)

## **Information I Need**

Once the setup is complete, please provide me with:

1. **Client ID** (Application ID from the app registration overview)
2. **Client Secret Value** (from Step 4 above)  
3. **Tenant ID** (found in Azure AD → Overview)
4. **Shared Mailbox Email** (if created): orientation@cogentanalytics.com

**Example format:**
```
Client ID: 12345678-1234-1234-1234-123456789abc
Client Secret: AbC123XyZ789... (the actual secret value)
Tenant ID: 87654321-4321-4321-4321-cba987654321
From Email: orientation@cogentanalytics.com
```

**Note:** With these permissions, the system will be able to:
- Generate Teams meeting links automatically for virtual sessions
- Check for calendar conflicts before scheduling
- Integrate with SharePoint for document management
- Support future enhancements without additional admin requests

## **Testing & Validation**

Once I receive the credentials, I can immediately test the integration:

1. **Connection Test** - Verify authentication is working
2. **Email Test** - Send a test welcome email  
3. **Calendar Test** - Create a test calendar invite
4. **Full Integration Test** - Process a complete orientation class

I estimate the testing and validation process will take 30-60 minutes once the credentials are provided.

## **Production Rollout Timeline**

- **Phase 1:** Test with existing orientation class (this week)
- **Phase 2:** Full automation for next orientation class  
- **Phase 3:** Training team members on new automated workflow

## **Support & Documentation**

I've created comprehensive technical documentation for this integration, including:
- Setup instructions and troubleshooting guides
- API endpoint documentation  
- Security and maintenance procedures
- User training materials

## **Questions & Additional Information**

If you have any questions about this request or need additional technical details, I'm happy to provide more information. I can also schedule a brief call to walk through the requirements if that would be helpful.

The development work is already complete and tested with mock data - we just need the Azure configuration to go live with the integration.

**Estimated Time Impact for You:** 15-20 minutes for the Azure setup

**Business Impact:** Immediate 2-3 hour time savings per orientation class + improved consistency and professionalism

Thank you for your time and assistance with this integration. Please let me know if you need any clarification or have questions about any of these steps.

Best regards,  
[Your Name]  
[Your Title]  
[Your Contact Information]

---

**P.S.** If there are any corporate policies or additional approval processes required for Microsoft Graph API integrations, please let me know and I can provide additional documentation or go through the appropriate channels.

---

# 🚀 **Implementation Guide (After Admin Setup)**

*This technical section can be used after receiving admin approval and credentials.*

## **Environment Variables Setup**

Add these to your `.env` file:

```bash
# Microsoft Graph API Configuration (from admin)
MICROSOFT_CLIENT_ID=12345678-1234-1234-1234-123456789abc
MICROSOFT_CLIENT_SECRET=your-secret-value-from-admin
MICROSOFT_TENANT_ID=your-org-tenant-id

# Email Configuration
ORIENTATION_FROM_EMAIL=orientation@cogentanalytics.com
```

**How to Find Your Tenant ID:**
```
Azure Portal → Azure Active Directory → Overview → Copy "Tenant ID" value
```

## **Installation & Testing**

### **1. Install Dependencies**
```bash
npm install @microsoft/microsoft-graph-client microsoft-graph cors
```

### **2. Test Connection**
Visit: `http://localhost:4000/api/calendar/test-connection`

**Success Response:**
```json
{
  "success": true,
  "message": "Microsoft Graph connection successful",
  "tokenReceived": true,
  "configuration": {
    "clientIdPresent": true,
    "tenantIdPresent": true,
    "fromEmailConfigured": "orientation@cogentanalytics.com"
  }
}
```

### **3. Test Calendar Invites**
1. Select a class in the dashboard
2. Click "📧 Send All Calendar Invites"
3. Check for success message and calendar events

## **Troubleshooting Common Issues**

**Error: "OAUTH_027" or "Insufficient privileges"**
- Solution: Admin needs to grant consent for API permissions
- Check: Azure Portal → App Registrations → API Permissions

**Error: "Invalid client secret"**
- Solution: Regenerate client secret and update .env file
- Check: Secret hasn't expired (24 month max lifetime)

**Error: "User not found" when sending emails**
- Solution: Verify ORIENTATION_FROM_EMAIL exists and has permissions
- Check: Shared mailbox setup or user account permissions

**Error: "Access token not received"**
- Solution: Check all environment variables are set correctly
- Verify: MICROSOFT_TENANT_ID, CLIENT_ID, and CLIENT_SECRET

## **Available Features**

### **Current Features (Ready Now):**
- ✅ Send calendar invites for all lessons in a class
- ✅ Include orientee details, instructor info, and session descriptions
- ✅ Send welcome emails to new orientees
- ✅ Professional HTML email templates
- ✅ Uses existing ClickUp data seamlessly

### **Future Features (with additional permissions):**
- 🔮 Teams meeting links for virtual sessions
- 🔮 Calendar conflict checking
- 🔮 SharePoint document attachments
- 🔮 Timezone-aware scheduling

## **SharePoint Integration Note**

Yes! **Azure Microsoft Graph API handles SharePoint seamlessly** - it's all part of Microsoft 365. With the `Sites.ReadWrite.All` permission we requested, you'll be able to:

- Attach orientation materials from SharePoint to calendar invites
- Auto-create document folders for each cohort
- Upload feedback forms and reports directly to SharePoint
- Access any SharePoint site in your organization

All through the same API - no separate SharePoint setup needed!

## **Security Best Practices**

- ✅ Never commit secrets to version control
- ✅ Use environment variables for all credentials
- ✅ Regularly rotate client secrets (every 12-24 months)
- ✅ Monitor app permissions and usage in Azure logs
- ✅ Use shared mailboxes instead of personal accounts for production

The integration is now ready to use! Your ScheduleCard already has the "Send Calendar Invites" button functional. 