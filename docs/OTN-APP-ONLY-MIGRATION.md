# OTN App-Only Migration Guide

**Version:** 0.1 – _living document_

---

## 1. Purpose & Rationale
We are deprecating **all ClickUp dependencies** for the Orientation & Training (OTN) application.  
The goals are:

1. Reduce complexity & external failure modes (API changes, auth errors, field mismatches).
2. Consolidate user experience into a single app with reliable local data storage.
3. Prepare for seamless hand-off to the future Learning Management System (LMS) while continuing to export CSVs to SharePoint via Microsoft Graph [[memory:21788]].

---

## 2. Current ClickUp Touch Points
| Area | File(s) / Service(s) | Usage |
|------|----------------------|-------|
| **User discovery** | `services/user-discovery.js`, `utils/clickup-client.js` | Pull full workspace user list. |
| **Lesson → Task sync** | `services/lesson-sync.js`, `clickup-lesson-reader.js` | Optional; maps lessons to ClickUp tasks. |
| **Class folders & lists** | `services/class-creator.js`, `services/class-store.js` | Creates ClickUp folder/list per cohort. |
| **Schedule embed** | _None_ (pure HTML) | Already in-app.
| **Feedback & grading** | _None_ (app-native) | Only mirrored to ClickUp manually.

> ✅ **Confirmed:** `services/lesson-store.js` persists lessons in SQLite (`data/orientation.db`). Lesson data is no longer required from ClickUp.

---

## 3. Target State
1. **Local DB is source of truth** for Lessons, Classes, Users, Feedback, Reports.
2. **CSV export** endpoint/button writes files to `/exports/*.csv` and optionally auto-uploads to SharePoint.
3. **ClickUp codepaths** gated behind `USE_CLICKUP` env flag (default `false`) → scheduled for deletion once migration is stable.
4. **User refresh** still supported via one-off script that hits ClickUp _or_ Azure AD (TBD) and writes into `instructors` table.

---

## 4. Migration Phases  
_We will proceed one phase at a time; complete **every** step in a phase before moving on._

### PHASE 0 | Project Duplication & Version Control
1. **Create** `app-only-migration` branch off `main` and push an empty commit.  
2. **Tag** the current `main` as `v1-clickup-edition` for reference.  
3. Protect `main` (require PR reviews & passing CI).  
4. (Optional) Clone repo again if you want a separate working copy.

### PHASE 1 | Environment Flag & Dead-End Blocking
1. Add `USE_CLICKUP` to server/client env files (default `false`).  
2. Wrap every ClickUp import/call in a flag check.  
3. Verify the app boots with the flag off and on.  
4. Commit: _feat(flag): add USE_CLICKUP toggle_.

### PHASE 2 | Freeze & Cache Needed ClickUp Data
1. Run a one-off script to fetch users and store them in `instructors` table + `data/bootstrap/instructors.json`.  
2. Add `npm run refresh:users` CLI for future refreshes.

### PHASE 3 | Refactor Services to Pure DB
Refactor each service (lesson-sync, class-creator, class-store, etc.) to remove ClickUp calls, unit-test, and commit.

### PHASE 4 | UI / Client Cleanup
Remove all ClickUp references from React components and ensure Tailwind layouts still render correctly.

### PHASE 5 | CSV Export & SharePoint Upload
1. Define CSV schemas.  
2. Implement `/api/exports/:type` route.  
3. (Optional) Upload exports to SharePoint via Graph API.

### PHASE 6 | QA, Regression & Cleanup
Run full regression tests, then delete ClickUp code and dependencies once stable.

### PHASE 7 | Documentation & Debrief
Finalize docs, archive this guide, and write a post-mortem.

---

## 5. Task Checklist
- [ ] Add `USE_CLICKUP` flag to `.env` and `README`.
- [ ] Inject flag into Vite client & Node services.  
- [ ] Migrate user list to DB (__script ready__).
- [ ] Verify lessons table completeness (compare with `config/lesson-templates.json`).
- [ ] Patch reports to pull data locally only.
- [ ] Build CSV export util + SharePoint upload.
- [ ] Replace ClickUp links/buttons in UI.
- [ ] Delete dead code & update `package.json` deps.

---

## 6. Open Questions
1. **User source of truth:** Keep ClickUp pull, switch to Azure AD, or manual CSV?  
   • For now we’ll keep the existing ClickUp fetch script as a one-off CLI.
2. **Historical data:** Do we need to migrate past class/task history from ClickUp?  
   • TBD – likely _no_ if reports already generated.
3. **Instructor profile pictures:** We currently pull `profilePicture` from ClickUp. Keep?  
   • Optional; can be dropped to simplify.
4. **LMS integration timeline:** When will LMS own assignments & grading?  
   • Determine hand-off to avoid duplicate work.
5. **Schedule changes:** Should instructors be able to edit schedule directly in app post-migration?
6. **Authentication & Permissions:** Any new roles/scopes needed now that everything is local?

Add comments/questions below – we’ll iterate.

---

## 7. References & Links
- `services/lesson-store.js` – Lesson DB access layer.  
- `services/user-discovery.js` – ClickUp user fetch (keep as CLI).  
- `scripts/build-schedule-html.js` – Static schedule generator (already ClickUp-free).  
- SharePoint Graph API guide: `docs/integrations/additional-permissions-guide.md`.

---

_End of document_ 