# Project Vision: The Orientation Hub

This document outlines the master plan for evolving the `feedback-forms` project from a collection of backend scripts into a full-fledged, UI-driven application. The ultimate goal is to create a tool that allows a non-technical user to manage the entire PD Orientation workflow from a simple web interface.

## 1. High-Level Goal

To build a standalone web application, accessible via a dedicated URL (e.g., using Duck DNS), that serves as a centralized, no-code control panel for all aspects of the PD Orientation process.

## 2. The Target User

A non-technical manager or administrator who is responsible for setting up, running, and reporting on orientation classes. The user should not need to understand ClickUp's internal structure, manually edit lists, or interact with any code.

## 3. Core Principles

*   **No-Code Operation:** The user will perform all tasks through a graphical user interface (GUI). There will be no need to edit configuration files or manually update IDs.
*   **Simple & Intuitive UX:** The design will be clean and task-oriented, with clear buttons, forms, and dropdowns to guide the user through each workflow.
*   **Centralized Control:** The UI will be the single source of truth for managing all orientation classes.

## 4. Key Features (The "What")

The application will be built around a few key modules:

#### A. Dashboard
The main landing page will display a list of all active and past orientation classes, discovered by finding all folders in the ClickUp space that match the `PD OTN...` naming convention.

#### B. Class Management
*   **View Classes:** The dashboard will be the primary view for all classes.
*   **Create New Class:** A prominent "Create New Class" button will allow the user to start a new orientation.
    *   The UI will prompt for a **Start Date**.
    *   The backend will then use the ClickUp API to duplicate a master template folder, renaming the new folder correctly (e.g., `PD OTN 2024-10-28`).

#### C. Orientee Management
*   A dedicated section for managing the list of orientees.
*   A simple form with "Add New Orientee" will allow for adding new people to the master dropdown field in ClickUp, making them available for all future classes.

#### D. Integrated Feedback & Grading
*   The existing HTML feedback form will be integrated directly into the UI.
*   It will feature a dropdown menu, populated by the list of classes from the Dashboard, to ensure feedback is submitted to the correct, active class.
*   **PLANNED ENHANCEMENT:** Class-Aware Orientee Filtering
    - Add class selection step to feedback form (user picks which class they're grading first)
    - Dynamically filter orientee dropdown to only show orientees from that specific class
    - Eliminates confusion from seeing all orientees from every class ever created
    - Implementation: Query specific class folder's "Class Details" list to get relevant orientees
    - No data model changes needed - pure filtering solution

#### E. Reporting
*   A "Generate Report" section.
*   The user will select a class from a dropdown.
*   Clicking "Generate" will trigger the backend to fetch all required data from the various lists within that class's folder, compile it, and deliver a PDF report to the user's browser.

#### F. Scheduling & Calendar Integration ⚠️ **ARCHITECTURE UPDATED**
**Problem Identified:** ClickUp has fundamental limitations with time handling in both API and automations. Times get reset to midnight/4AM regardless of input values, making precise scheduling impossible.

**Solution:** **Hybrid Architecture - ClickUp + Outlook Calendar**
*   **ClickUp:** Handles task management, lesson data, custom fields, orientee tracking (dates only, no times)
*   **Outlook Calendar:** Handles precise scheduling, times, calendar invites, meeting coordination
*   **Integration:** Lesson data from ClickUp templates → Calendar events with proper times via Microsoft Graph API

**Features:**
*   **Webapp Calendar View:** Custom calendar display showing only orientation schedules (not personal/shared Outlook calendars)
*   **Auto-Invite System:** Automatically sends calendar invites to lesson leads with Teams meeting links
*   **Template Time Sync:** Times from lesson templates → Outlook calendar events with precise start/end times
*   **Conflict Detection:** Check for scheduling conflicts before creating events
*   **Professional Invites:** Calendar invites from orientation@cogentanalytics.com with SharePoint materials attached

## 5. Technical Architecture - Hybrid Integration (Updated)

### **Core Architecture:** ClickUp + Outlook Calendar Integration

**Frontend:** React.js with Tailwind CSS
*   Task management UI (ClickUp integration)
*   **Custom calendar component** (displays orientation schedules only)
*   Template comparison tool (uses Outlook calendar times vs template times)
*   Embedded calendar view (webapp-generated, not Outlook embed)

**Backend:** Node.js/Express with dual API integration
*   **ClickUp API:** Task management, orientee data, lesson metadata  
*   **Microsoft Graph API:** Calendar events, precise timing, auto-invites
*   **Sync Service:** Bridges ClickUp lesson data → Outlook calendar events
*   **Calendar Service:** Handles timing, conflicts, invite generation

**Database:** Configuration-driven (JSON files + API discovery)
*   `lesson-templates.json` - Contains lesson timing data (start/end times)
*   Live ClickUp data - Task details, orientee info, custom fields
*   Outlook Calendar - Actual scheduled events with precise times

**Deployment:** Docker containerization for production VPS

## 6. Phased Rollout Plan (Updated Architecture)

1.  **Phase 1 (Core Engine):** Build the dynamic backend logic. Implement the "Folder Finder" and the report generation service that can target a dynamically selected class.
2.  **Phase 2 (Minimum Viable Product):** Develop the initial UI. Create the dashboard to list classes and the reporting page where a user can select a class and generate a PDF.
3.  **Phase 3 (Feedback Integration):** Integrate the feedback form into the UI and connect it to the dynamic class selection system.
4.  **Phase 4 (Full Class Management):** Implement the "Create New Class" and "Orientee Management" features.
5.  **Phase 5 (Calendar Integration):** 
   - **5a.** Implement Microsoft Graph API integration for Outlook Calendar
   - **5b.** Build calendar sync service (ClickUp lessons → Outlook events)
   - **5c.** Create custom webapp calendar view component
   - **5d.** Implement auto-invite system with Teams meeting links
   - **5e.** Add template comparison using Outlook calendar times
   - **5f.** Deploy professional calendar invite system from orientation@cogentanalytics.com

## 6.5. ClickUp Time Limitations & Architectural Decision

### **Problem Statement**
**Date Discovered:** July 1, 2025  
**Severity:** Critical - Breaks automation value proposition  

ClickUp has fundamental limitations with time handling that make precise scheduling automation impossible:

1. **API Limitations:** 
   - `start_date`/`due_date` fields accept Unix timestamps with times
   - API ignores time portions and resets all times to midnight
   - Working task: Manual creation preserves times ✅
   - API creation: Times reset to 00:00:00 ❌

2. **Custom Date Fields:**
   - Date custom fields only store dates (no time support)  
   - `"time": true` parameter exists but doesn't work in practice
   - Automations default to 4:00 AM regardless of input

3. **Automation Limitations:**
   - ClickUp automations can only set dates, not times
   - 3,600+ user votes on feature requests for time support
   - Official ClickUp staff confirm "no support for entering specific times in automations"

### **Impact on Orientation System**
- ✅ **Lesson creation** works (dates, instructors, subjects, etc.)
- ❌ **Precise scheduling** impossible (8:30 AM - 9:00 AM lesson times)
- ❌ **Calendar view** unusable (all lessons show midnight)
- ❌ **Auto-invites** broken (wrong times sent to leads)
- **Result:** Manual time-setting required for every lesson (defeats automation purpose)

### **Architectural Solution: Hybrid ClickUp + Outlook**
**Decision:** Use the right tool for each job instead of forcing ClickUp to do what it can't.

**ClickUp Responsibilities:**
- ✅ Task management and workflow
- ✅ Orientee data and custom fields  
- ✅ Lesson metadata and assignments
- ✅ Feedback collection and grading

**Outlook Calendar Responsibilities:**
- ✅ Precise scheduling with exact start/end times
- ✅ Professional calendar invites with Teams links
- ✅ Conflict detection and timezone handling
- ✅ SharePoint material attachments

**Benefits:**
- **Full automation** - No manual time setting required
- **Professional invites** - From orientation@cogentanalytics.com  
- **Proper calendar view** - Shows actual lesson times
- **Future-proof** - Not dependent on ClickUp fixing time limitations

## 7. Configuration Management System Implementation

**GOAL:** Build a hybrid API-driven + JSON configuration system that allows complete in-app editing of lesson templates, user assignments, and class structure without code changes.

### 📋 **Implementation Checklist**

#### **🏗️ Phase 1: Configuration Foundation**
- [x] **1.1** Create `config/` directory structure
- [x] **1.2** Build `lesson-templates.json` with current 67 lessons
- [x] **1.3** Build `field-mappings.json` with custom field configurations  
- [x] **1.4** Build `user-assignments.json` with instructor mappings
- [x] **1.5** Create configuration loader service
- [x] **1.6** Test configuration loading and validation

#### **🔌 Phase 2: API Discovery Layer**
- [x] **2.1** Build user discovery service (`/api/config/users`) ✅
- [x] **2.2** Build field discovery service (`/api/config/fields`) ✅ 
- [x] **2.3** Build dropdown options service (`/api/config/field-options`) ✅
- [x] **2.4** Test API discovery with existing manual folder ✅
- [x] **2.5** Implement caching for performance ✅
- [x] **2.6** Add error handling and fallbacks ✅

#### **🎛️ Phase 3: Admin UI Components** ✅ **COMPLETE**
- [x] **3.1** Create `ConfigurationPanel` main component ✅
- [x] **3.2** Build `UserManagement` component (view/sync users) ✅
- [x] **3.3** Build `LessonEditor` component (add/edit/reorder lessons) ✅ **Comprehensive Curriculum & Template Manager**
  - Template vs Live ClickUp mode with class selection
  - Add/edit/delete lessons with instructor assignment  
  - Schedule visualization with timeline view (📅 Schedule mode)
  - CSV export functionality for schedules
  - Template backup and ClickUp sync capabilities
  - Consolidated all lesson and template management in one interface
- [x] **3.4** Build `FieldMapping` component (view/validate fields) ✅ **Strategy 3: Hybrid Discovery + Selective Configuration**
- [x] **3.5** Build `ClassStructure` component (preview/modify schedule) ✅ **Integrated into LessonEditor** 
  - Enhanced LessonEditor with schedule visualization (📅 Schedule view)
  - Fixed "Day 0" display issue (now shows Day 1, Day 2, etc.)
  - Added timeline view grouped by week and day with visual cards
  - Added CSV export functionality for schedule templates
  - Removed redundant Class Structure tab (consolidated into Lesson Editor)
- [x] **3.6** Build `TemplateManager` component (modify template for permanent changes) ✅ **Consolidated into LessonEditor**
  - Template management integrated into LessonEditor Template mode
  - Added backup template functionality (JSON download)
  - Added sync to ClickUp functionality 
  - Single interface for all lesson and template operations
  - Removed redundant Template Manager tab
- [x] **3.7** Test UI components with mock data ✅ **Components tested and functional in development**

#### **⚙️ Phase 4: Configuration Integration**
- [ ] **4.1** Modify `class-creator.js` to use config files
- [ ] **4.2** Add configuration validation to class creation
- [ ] **4.3** Implement real-time config updates
- [ ] **4.4** Test class creation with modified configurations
- [ ] **4.5** Add configuration backup/restore
- [ ] **4.6** Performance testing with large configurations

#### **🧪 Phase 5: End-to-End Testing**
- [ ] **5.1** Test adding new instructor scenario
- [ ] **5.2** Test adding new lessons scenario
- [ ] **5.3** Test modifying existing lesson scenario
- [ ] **5.4** Test field mapping changes scenario
- [ ] **5.5** Test error recovery scenarios
- [ ] **5.6** Performance testing and optimization

#### **📚 Phase 6: Documentation & Training**
- [ ] **6.1** Document configuration file schemas
- [ ] **6.2** Create admin user guide
- [ ] **6.3** Document API endpoints
- [ ] **6.4** Create troubleshooting guide
- [ ] **6.5** Record demo video
- [ ] **6.6** Production deployment checklist

#### **🔧 Phase 7: Continuous Improvements & Tweaks**
*Ongoing enhancements and quality-of-life improvements*

**📋 Field Management Enhancements:**
- [x] **7.1** Dynamic field add/remove buttons in FieldMapping component ✅ **UI Complete** (buttons exist in Discovery mode, need backend implementation)
- [ ] **7.2** Field scope management backend implementation (save add/remove actions to config)
- [ ] **7.3** Custom field creation workflow (add new fields to ClickUp + config)
- [ ] **7.4** Field validation rule builder (required fields, data types, etc.)

**📧 Communication Automation:**
- [ ] **7.5** Automate sending daily reports and weekly summaries
- [ ] **7.6** Welcome email auto-send for new orientees
- [x] **7.7** Calendar invites from orientation@cogentanalytics.com (via Outlook integration) ✅ **Planned via Microsoft Graph API**
- [ ] **7.8** Email templates and customization system
- [ ] **7.9** Teams meeting auto-generation for virtual sessions

**🔄 Sync & Integration:**
- [ ] **7.9** Real-time ClickUp changes sync with webapp
- [ ] **7.10** SharePoint connection and document management
- [ ] **7.11** Webhook system for instant updates
- [ ] **7.12** Two-way sync validation and conflict resolution

**📊 Advanced Reporting:**
- [ ] **7.13** Automated report scheduling and delivery
- [ ] **7.14** Custom report builder with drag-and-drop fields
- [ ] **7.15** Report templates for different stakeholders
- [ ] **7.16** Data visualization and dashboard charts

**🎯 UX/Performance Optimizations:**
- [ ] **7.17** Advanced search and filtering across all components
- [ ] **7.18** Bulk operations (mass email, bulk field updates, etc.)
- [ ] **7.19** Mobile-responsive design improvements
- [ ] **7.20** Performance monitoring and optimization tools

### 🎯 **Success Criteria**
✅ **Zero Code Changes Required** for adding new instructors/lessons  
✅ **Real-time API Discovery** keeps user/field lists current  
✅ **Visual Configuration UI** allows non-technical editing  
✅ **Automatic Validation** prevents configuration errors  
✅ **Performance Maintained** (<15 seconds class creation)  
✅ **Production Ready** with error handling and fallbacks

## Post-Mordum

After the core phases are complete, we'll track "nice-to-have" polish items here.

* **Automate Schedule Embed View (ClickUp API)**
  * When the Schedule list is created, call the ClickUp View API to add:
    * `"All Lessons"` → standard list view.
    * `"Calendar"` → embed view pointing to the GitHub Pages URL `https://collin-ho.github.io/orientation-static/schedule/`.
  * Ensures every new class instantly includes the printable calendar without manual setup.
  * Phase 2 enhancement: convert the static calendar HTML into an **interactive view** – each lesson rectangle becomes a hyperlink that opens the corresponding ClickUp task (`https://app.clickup.com/t/<TASK_ID>`). This gives directors one-click drill-down from the schedule to task details.

## 7. Development Notes & Debugging Gotchas

### 🔑 ClickUp Permission Architecture

**CRITICAL:** Due to ClickUp workspace permission limitations, we use a **mixed-space architecture**:

**User Discovery ONLY:** Sandbox Space (`16835428`)
- ✅ Can read user lists (176 users including all instructors)
- ❌ Cannot read folders/tasks (no permission)
- **Why:** 1100 Workshop space has limited user visibility (only 8 users)

**All Other Operations:** 1100 Workshop Space (`14869535`) 
- ✅ Can read fields, folders, tasks, create classes
- ❌ Limited user visibility (missing instructors)
- **Why:** This is our primary working space with full permissions

**Services Configuration:**
- `UserDiscoveryService`: Uses Sandbox space (`16835428`) - users only
- `FieldDiscoveryService`: Uses 1100 Workshop space (`14869535`)
- `ClickUpLessonReader`: Uses 1100 Workshop space (`14869535`) ✅ **Fixed**
- `ClassCreator`: Uses 1100 Workshop space (`14869535`)

**Common Error:** `HTTP 401 OAUTH_027` when services try to access wrong space or operation they don't have permission for.

### 📋 ClickUp Field Name Parsing

**Issue:** Live ClickUp mode showing "Unknown" values for all fields  
**Root Cause:** ClickUp API returns field names with type suffixes like `"Lead(s) (users)"` and `"Week Day (drop down)"`, not simplified names like `"Leads"` and `"Week Day"`  
**Solution:** Updated field extraction in `ClickUpLessonReader.convertTasksToLessons()` to use actual field names:
- `"Lead(s)"` instead of `"Leads"` (no type suffix)
- `"Week #"` instead of `"Week"`  
- `"Week Day"` instead of `"Day"`
- `"Subject"` (confirmed exact name)
- Added string conversion to prevent `.includes()` errors on undefined values

**Prevention:** Always check actual field names in ClickUp exports/API responses before coding field extraction logic.

### ⚠️ Critical Integration Issues to Watch For:

#### **Case Sensitivity in ClickUp API Data**
**Date Discovered:** June 20, 2025  
**Issue:** ClickUp API returns task status values in lowercase (e.g., `"graduated"`, `"resigned"`) but our template logic was expecting proper case (`"Graduated"`, `"Resigned"`).  
**Symptoms:** 
- Report generates successfully (no errors)
- PDF file size is suspiciously small (~58KB vs expected ~1MB+)
- Report shows headers but no actual orientee data
- All sections appear empty despite data existing in ClickUp

**Root Cause:** Status grouping logic fails silently when case doesn't match:
```javascript
// ❌ This fails silently
const statusOrder = ['Graduated', 'Resigned', 'Released'];
// ClickUp returns: { status: { status: "graduated" } }
// No match found → empty groups → empty report
```

**Solution:** Always normalize string comparisons from external APIs:
```javascript
// ✅ Normalize case before processing
const rawStatus = task.status?.status || 'Unknown';
const normalizedStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();
```

**Prevention:** 
- Always log actual API response values during development
- Never assume external API case formatting
- Test with actual data, not just mock data
- Add data validation logging to catch empty result sets

**Time Cost:** This single bug cost ~3 hours of debugging time. Document similar issues here to prevent future time loss. 

**🔄 Automation Roadmap (Updated for Hybrid Architecture):**
* ✅ Automate calendar invites from orientation@cogentanalytics.com (via Outlook integration)
* ✅ Teams meeting links auto-generation for virtual sessions  
* 📧 Automate sending daily reports and weekly summaries
* 📧 Welcome email auto-send for new orientees
* 🔄 Ensure ClickUp changes sync with webapp
* 📁 SharePoint connection and document attachments to calendar invites
* 📊 Real-time sync between ClickUp lesson data and Outlook calendar events

### 🚧 ClickUp API Limitations (Documented)

1. **Time Fields Reset to Midnight**  
  Setting `start_date` or `due_date` via API always strips the time portion (task shows 12:00 AM / 4 AM).  
  Work-around: keep times in JSON config, but don't send them to ClickUp; use Outlook Calendar for real scheduling.

2. **Cannot Add Dropdown / Label Options via API**  
  Attempts to POST

  * `POST /api/v2/custom_field/{field_id}/option` (dropdown)
  * `POST /api/v2/custom_field/{field_id}/label` (labels)

  both return **404 Cannot POST**. As a result, new orientees _must_ be pre-seeded manually in the **PD Orientee** dropdown before running automation.  
  The backend will surface a clear error if the option is missing.

These limitations are tracked for future re-evaluation if ClickUp releases v3 endpoints that solve them.