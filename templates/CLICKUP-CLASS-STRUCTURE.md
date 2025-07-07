# ClickUp Orientation Class Structure Template

## Overview
This document outlines the complete structure for orientation classes in ClickUp. Each orientation class is created as a folder with three lists containing custom fields and predefined tasks.

## Folder Structure
```
📁 PD OTN [START_DATE] (e.g., "PD OTN 2025-01-13")
├── 📋 Schedule (47 lesson tasks)
├── 📋 Class Details (orientee profiles)
└── 📋 Feedback & Grades (daily scores & homework)
```

## List 1: Schedule
**Purpose**: Contains all 47 lesson tasks for the 9-day orientation schedule

### Custom Fields
| Field Name | Type | Options/Config |
|------------|------|----------------|
| **Week #** | Dropdown | Week 1 (Remote), Week 2 (In Person) |
| **Week Day** | Dropdown | Mon, Tue, Wed, Thu, Fri |
| **Subject** | Dropdown | Vision/Mission/Values, Discovery, Measurement, Process, People, Project Management, Client Alignment & Project Control, Professional Services, Brand MTKG, LifeCycle |
| **Time Estimate** | Short Text | Duration in hours/minutes |
| **Relevant Files** | Attachment | Training materials |
| **Send Invite** | Checkbox | Calendar invitation flag |

## Complete 47-Lesson Schedule

### Week 1 (Remote) - Monday
1. **Welcome & Introductions** - Vision/Mission/Values - 1 hour
2. **Vision, Values & Process** - Vision/Mission/Values - 2 hours  
3. **Measurement Overview** - Measurement - 1.5 hours
4. **Financial Fundamentals** - Measurement - 2 hours
5. **Project Plan Assignment** - Project Management - 0.5 hours

### Week 1 (Remote) - Tuesday  
6. **Discovery Deep Dive** - Discovery - 2 hours
7. **Client Interview Techniques** - Discovery - 1.5 hours
8. **Discovery Tools & Templates** - Discovery - 1 hour
9. **Practice Discovery Calls** - Discovery - 2 hours
10. **Discovery Homework Review** - Discovery - 0.5 hours

### Week 1 (Remote) - Wednesday
11. **Measurement Tools** - Measurement - 2 hours
12. **Financial Analysis** - Measurement - 1.5 hours
13. **KPI Development** - Measurement - 1 hour
14. **Project Plan Presentations** - Project Management - 2 hours
15. **Feedback Session** - People - 0.5 hours

### Week 1 (Remote) - Thursday
16. **Process Mapping** - Process - 2 hours
17. **Process Optimization** - Process - 1.5 hours
18. **Process Documentation** - Process - 1 hour
19. **Process Tools Practice** - Process - 2 hours
20. **Daily Wrap-up** - People - 0.5 hours

### Week 1 (Remote) - Friday
21. **Week 1 Review** - Vision/Mission/Values - 1 hour
22. **WPR (Weekly Progress Report)** - Project Management - 1 hour
23. **WPR Presentations** - Project Management - 2 hours
24. **Week 2 Preparation** - People - 1 hour
25. **Travel & Logistics** - People - 0.5 hours

### Week 2 (In Person) - Monday
26. **Week 2 Kickoff** - Vision/Mission/Values - 0.5 hours
27. **People & Culture** - People - 2 hours
28. **Team Dynamics** - People - 1.5 hours
29. **Communication Skills** - People - 1 hour
30. **Leadership Principles** - People - 2 hours

### Week 2 (In Person) - Tuesday
31. **Project Management Deep Dive** - Project Management - 2 hours
32. **Project Planning Tools** - Project Management - 1.5 hours
33. **Risk Management** - Project Management - 1 hour
34. **Project Execution** - Project Management - 2 hours
35. **PM Practice Session** - Project Management - 1 hour

### Week 2 (In Person) - Wednesday  
36. **Client Alignment** - Client Alignment & Project Control - 2 hours
37. **Project Control Systems** - Client Alignment & Project Control - 1.5 hours
38. **Status Reporting** - Client Alignment & Project Control - 1 hour
39. **Client Communication** - Client Alignment & Project Control - 2 hours
40. **Alignment Workshop** - Client Alignment & Project Control - 1 hour

### Week 2 (In Person) - Thursday
41. **Professional Services** - Professional Services - 2 hours
42. **Service Delivery** - Professional Services - 1.5 hours
43. **Client Success** - Professional Services - 1 hour
44. **Brand & Marketing** - Brand MTKG - 2 hours
45. **LifeCycle Overview** - LifeCycle - 1 hour

### Week 2 (In Person) - Friday
46. **Final Presentations** - Project Management - 3 hours
47. **Graduation & Next Steps** - Vision/Mission/Values - 1 hour

## List 2: Class Details
**Purpose**: Orientee profile information and long-form feedback

### Custom Fields
| Field Name | Type | Options/Config |
|------------|------|----------------|
| **PD Orientee** | Dropdown | Orientee 1, Orientee 2, etc. |
| **WK 1 Feedback for the AD** | Long Text | Week 1 performance feedback |
| **WK 2 Feedback for the AD** | Long Text | Week 2 performance feedback |
| **Pillar** | Dropdown | Operations, People, Biz Dev |
| **Personality TAG** | Labels | Driver, Expressive, Analytic, Amiable |
| **Cogent Email** | Email | firstname.lastname@cogentanalytics.com |
| **LinkedIn Profile** | URL | LinkedIn profile link |
| **Market** | Dropdown | Philadelphia-PA, Boston-MA, North Dallas-TX, N. Houston-TX |

## List 3: Feedback & Grades
**Purpose**: Daily performance scores and homework grades

### Custom Fields
| Field Name | Type | Options/Config |
|------------|------|----------------|
| **PD Orientee** | Dropdown | Orientee 1, Orientee 2, etc. |
| **Comments** | Short Text | Daily feedback comments |
| **Effort** | Number | 1-10 scale |
| **Comp** | Number | 1-10 scale |
| **Application** | Number | 1-10 scale |
| **Week #** | Dropdown | Week 1 (Remote), Week 2 (In Person) |
| **Week Day** | Dropdown | Mon, Tue, Wed, Thu, Fri |
| **Assignment** | Dropdown | Turnover, CMS Build, WPR |
| **Grade** | Number | 0-100 percentage |

## Usage
1. Use NewClassCard component to select Monday start date
2. System validates date is Monday
3. Creates folder: "PD OTN [YYYY-MM-DD]"
4. Creates 3 lists with all custom fields
5. Creates 47 lesson tasks with proper scheduling
6. Manual view configuration required
