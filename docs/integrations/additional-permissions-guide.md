# Additional Microsoft Graph Permissions - Future Considerations

## 🎯 **Current Permissions (Already Requested)**
✅ `Calendars.ReadWrite` - Create/edit calendar events  
✅ `Calendars.ReadWrite.Shared` - Access shared calendars  
✅ `Mail.Send` - Send emails  
✅ `Mail.Send.Shared` - Send from shared mailboxes  
✅ `User.Read` - Read user profiles  
✅ `User.Read.All` - Read all user profiles  

## 🔮 **Likely Additional Permissions Needed**

### **📅 Enhanced Calendar Features**
```
Calendars.Read                    # Read existing calendar events (conflict checking)
MailboxSettings.Read             # Get user timezone & calendar settings
MailboxSettings.ReadWrite        # Update user calendar preferences
```
**Use Cases:**
- Check for scheduling conflicts before creating events
- Respect user timezone preferences  
- Auto-configure calendar settings for new orientees

### **👥 Directory & User Management**
```
Directory.Read.All               # Read organizational directory
Group.Read.All                   # Read group memberships
Group.ReadWrite.All              # Manage groups (for orientation cohorts)
```
**Use Cases:**
- Auto-discover users by department/role
- Create orientation cohort groups
- Validate user organizational structure

### **🔗 Teams Integration (Highly Likely)**
```
OnlineMeetings.ReadWrite         # Create Teams meeting links
Team.ReadBasic.All               # Read Teams information
Channel.ReadBasic.All            # Read Teams channels
ChatMessage.Send                 # Send Teams messages
```
**Use Cases:**
- Auto-generate Teams meeting links for virtual sessions
- Send Teams notifications about orientation
- Create dedicated orientation Teams channels

## 📈 **Advanced Features You'll Probably Want**

### **📁 SharePoint & File Management** 
*(You mentioned SharePoint integration in your master plan)*
```
Sites.ReadWrite.All              # Access SharePoint sites
Files.ReadWrite.All              # Read/write files across organization
Files.ReadWrite.Selected         # Access specific file sets
```
**Use Cases:**
- Attach orientation materials to calendar invites
- Auto-create document folders for each cohort
- Upload feedback forms and reports to SharePoint

### **📊 Advanced Reporting & Analytics**
```
Reports.Read.All                 # Read usage reports
AuditLog.Read.All               # Read audit logs
Directory.AccessAsUser.All       # Act on behalf of users
```
**Use Cases:**
- Track email open rates and calendar acceptance
- Generate usage analytics for orientation program
- Audit trail for compliance

### **🔔 Notifications & Presence**
```
Presence.Read.All                # Check user availability
Notifications.ReadWrite.CreatedByApp  # Send push notifications
```
**Use Cases:**
- Check instructor availability before scheduling
- Send mobile push notifications for orientation updates

## ⚠️ **Permission Types Matter**

### **Application vs Delegated Permissions**

**Current Request (Application Permissions):**
- Runs as service without user interaction ✅
- Good for automated calendar invites ✅
- Requires admin consent ✅

**You Might Also Need Delegated Permissions For:**
```
Calendars.ReadWrite              # When users interact directly
Mail.Send                        # When users send from UI
Files.ReadWrite                  # When users upload documents
```

### **Recommended Hybrid Approach**
Request both Application AND Delegated versions of key permissions:

```
# Application Permissions (for automation)
Calendars.ReadWrite              
Mail.Send
Files.ReadWrite.All

# Delegated Permissions (for user actions)  
Calendars.ReadWrite
Mail.Send
Files.ReadWrite
```

## 🎯 **Immediate Additions to Request**

I recommend adding these to your current admin request:

### **Phase 1 Additions (Request Now):**
```
Calendars.Read                   # Check existing events
MailboxSettings.Read             # User timezone settings
Directory.Read.All               # User directory access
OnlineMeetings.ReadWrite         # Teams meeting links
```

### **Phase 2 Additions (Request Soon):**
```
Sites.ReadWrite.All              # SharePoint integration
Files.ReadWrite.All              # Document management
Group.ReadWrite.All              # Cohort management
```

## 📝 **Updated Admin Request Addition**

Add this section to your admin email:

---

### **Additional Permissions for Future Features**

To support planned enhancements without requiring additional admin requests, please also add these permissions:

**Phase 1 (Immediate Use):**
- `Calendars.Read` - Check for scheduling conflicts
- `MailboxSettings.Read` - Respect user timezone preferences  
- `Directory.Read.All` - Enhanced user discovery
- `OnlineMeetings.ReadWrite` - Teams meeting integration

**Phase 2 (Planned Features):**
- `Sites.ReadWrite.All` - SharePoint document integration
- `Files.ReadWrite.All` - Orientation material management
- `Group.ReadWrite.All` - Cohort group management

**Rationale:** Adding these now prevents future admin requests and supports the full orientation automation roadmap.

---

## 🔍 **Permission Audit Tool**

Use this PowerShell command to check what permissions your app currently has:

```powershell
# Connect to Microsoft Graph PowerShell
Connect-MgGraph

# Get your app registration
Get-MgApplication -Filter "DisplayName eq 'Cogent Analytics - Orientation Management System'"

# Check current permissions
Get-MgApplicationApiPermission -ApplicationId <your-app-id>
```

## 🚨 **Common Missing Permissions**

Based on similar integrations, you'll almost certainly need:

1. **`Directory.Read.All`** - For robust user lookups
2. **`OnlineMeetings.ReadWrite`** - For virtual orientation sessions  
3. **`MailboxSettings.Read`** - For timezone-aware scheduling
4. **`Calendars.Read`** - For conflict detection

I strongly recommend adding at least these 4 to your current request.

## 💡 **Pro Tip: Request Broad Permissions Early**

It's much easier to request comprehensive permissions upfront than to go back to your admin multiple times. Consider requesting the "Phase 1 Additions" immediately, even if you don't use them right away. 