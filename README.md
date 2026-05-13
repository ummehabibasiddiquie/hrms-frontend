# HRMS Testing Frontend

Production frontend for HRMS operations and QC workflows.  
This app connects to **two backends**:

- `hrms-testing-backend` (Python/Flask) for HRMS core modules
- `qc-backend` (Node/Express) for AI/QC-specific workflows

---

## 1) Product Scope (Business View)

This frontend is the single operational console used by multiple roles:

- **Admin / Super Admin**
  - user management, project/task/category management, reporting
- **Project Manager / Assistant Manager**
  - monitoring, team/project-level reports, workflow supervision
- **QA**
  - QC scoring, correction/rework routing, audit reporting
- **Agent**
  - tracker entry, file upload, AI duplicate/evaluation checks, self reports

Core business modules:

- Authentication and password reset
- Tracker submission and production logging
- QC lifecycle (`regular`, `correction`, `rework`)
- AFD/category-driven quality scoring
- Daily/monthly billable and productivity reports
- Permission-based UI and action control

---

## 2) Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | React 19 + Vite |
| Router | `react-router-dom` |
| HTTP | `axios` |
| UI | Tailwind CSS v4 + AntD + custom UI components |
| Charts | `recharts` |
| Date/Time | `date-fns`, `dayjs` |
| Utility | `xlsx`, `uuid`, `crypto-js` |
| Notifications | `react-hot-toast` |
| Lint | ESLint 9 |

Scripts:

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`

---

## 3) Runtime Architecture (Coding Flow)

High-level flow:

```text
src/main.jsx
  -> App
     -> AuthProvider + Router
        -> AppRoutes
           -> ProtectedRoute (role guarded)
              -> Page
                 -> Feature Components
                    -> Services (api.js or nodeApi.js)
                       -> Flask backend OR Node QC backend
```

### Auth + Session

- `src/context/AuthContext.jsx` is the primary auth state manager.
- User is stored in `sessionStorage` and normalized (`user_id` mapping).
- Cross-tab login/logout synchronization is implemented via `localStorage` events.
- Permission helpers exposed:
  - `canManageUsers`
  - `canManageProjects`
  - `canPerformAction`

### Routing + Authorization

- `src/routes/AppRoutes.jsx` contains all route definitions.
- `src/routes/ProtectedRoutes.jsx` enforces `allowedRoles`.
- Role IDs are used heavily in route and feature branching:
  - `1 SUPER_ADMIN`, `2 ADMIN`, `3 PROJECT_MANAGER`, `4 ASSISTANT_MANAGER`, `5 QA_AGENT`, `6 AGENT`

### Backend Split (Critical)

Two axios clients:

- `src/services/api.js` -> Python backend (`VITE_API_BASE_URL`)
- `src/services/nodeApi.js` -> Node QC backend (`VITE_API_NODE_BASE_URL`)

Interceptors:

- Inject bearer token when available
- Handle multipart/form-data headers automatically
- Redirect to login on unauthorized responses outside auth routes

---

## 4) Business-Critical User Journeys

### A) Login Journey

1. `src/pages/LoginPage.jsx` submits credentials
2. `src/services/authService.js` -> `POST /auth/user` (Python)
3. `AuthContext.login()` stores session user + session ID
4. User redirected by role:
   - agent -> `/agent`
   - others -> `/dashboard`

### B) Agent Tracker + AI Validation Journey

1. Agent enters data in `src/components/AgentDashboard/Tracker.jsx`
2. Optional AI steps use Node endpoints:
   - `/ai/evaluate`
   - `/ai/duplicate-check`
3. File processing may call Node:
   - `/tracker/process-excel`
4. Main tracker create/update uses Python:
   - `/tracker/add`, `/tracker/update`
5. Lists refresh through `/tracker/view` or `/tracker/view_daily`

### C) QC Form Journey (QA)

1. QA opens `src/pages/QCFormPage.jsx`
2. Fetches AFD/category metadata (Python + Node paths depending on module)
3. Generates sample via Node:
   - `/qc-records/generate-sample`
4. Computes QC scoring on selected row/category/subcategory defects
5. Submits status via Node (in `src/services/qcService.js`):
   - `regular` -> `/qc-regular/save`
   - `correction` -> `/qc-correction/save`
   - `rework` -> `/qc-rework/save`

### D) Reporting + Oversight Journey

1. `src/pages/DashboardPage.jsx` branches tabs by role
2. Dashboard/report components fetch from Python APIs:
   - `/dashboard/filter`
   - `/tracker/view_daily`
   - `/user_monthly_tracker/list`
3. QA audit and QC report modules aggregate tracker + QC result views

---

## 5) API Integration Map

### Python backend (`api.js`)

Typical modules:

- Auth/password: `/auth/*`, `/password_reset/*`
- Users/projects/tasks/dropdowns:
  - `/user/*`, `/project/*`, `/task/*`, `/dropdown/get`
- Tracker/report:
  - `/tracker/add`, `/tracker/update`, `/tracker/view`, `/tracker/view_daily`, `/tracker/delete`
- Dashboard:
  - `/dashboard/filter`
- QC support modules:
  - `/qc/temp-qc`, `/qc_afd/*`, `/qc_audit/*`

### Node QC backend (`nodeApi.js`)

Typical modules:

- QC record lifecycle:
  - `/qc-records/*`, `/qc-regular/*`, `/qc-correction/*`, `/qc-rework/*`
- AI:
  - `/ai/evaluate`, `/ai/duplicate-check`
- File processing:
  - `/tracker/process-excel`
- Gemini key:
  - `/gemini-key/save`, `/gemini-key/get`, `/gemini-key/delete`

---

## 6) Folder Ownership + Business Meaning

## `src/pages`

- `LoginPage.jsx` -> login form, validation, role redirect
- `ResetPasswordPage.jsx` -> token-based password reset flow
- `DashboardPage.jsx` -> central role-based operations shell
- `QCFormPage.jsx` -> QC scoring + submission engine
- `AgentQCReportPage.jsx` -> agent-side QC history/reporting view
- `AdminPage.jsx` -> admin management shell (legacy + active logic mix)
- `UserMonthlyTargetCard.jsx` -> target card page (currently limited usage)

## `src/routes`

- `AppRoutes.jsx` -> all app routes + route-role mapping
- `ProtectedRoutes.jsx` -> auth/role gate logic

## `src/context`

- `AuthContext.jsx` -> active auth + permission context
- `UserContext.jsx` -> older/secondary context usage

## `src/services`

- `api.js` -> Python API transport + interceptor policy
- `nodeApi.js` -> Node API transport + interceptor policy
- `authService.js` -> login/auth requests
- `userService.js` -> user CRUD/list workflows
- `projectService.js` -> project/task workflows
- `dropdownService.js`, `dropdownApi.js` -> dropdown and selector datasets
- `qcService.js` -> QC sample, save, list, review flows
- `agentService.js` -> Gemini key save/get/delete
- `billableReportService.js` -> daily/monthly report APIs

## `src/components/AgentDashboard`

- `Tracker.jsx` -> primary agent workbench for tracker submit/update + file + AI checks
- `AIEvaluation.jsx` -> explicit AI evaluation page
- `AgentProjectList.jsx` -> assigned project/task view
- `AgentBillableReport.jsx` -> agent billable reporting
- `AgentQCReport.jsx` -> agent QC results
- `AgentTabsNavigation.jsx` -> agent tab controls

## `src/components/dashboard`

- `AdminDashboard.jsx` -> admin dashboard composition
- `AssistantManagerDashboard.jsx` -> assistant manager dashboard composition
- `ManagerQCReportsOverview.jsx` -> QC leadership overview
- `QATrackerReport.jsx` -> QA-focused tracker report panel
- `QAAgentList.jsx` -> QA agent selection/listing for QC actions
- `QAAgentAudit.jsx` -> QA audit workflow/report
- `QAAgentQCFormReport.jsx` -> QC form report rendering
- `QCFormReportView.jsx` -> QC report detail view
- `QAAgentReworkCorrectionReview.jsx` -> pending correction/rework review
- `ProjectMonthlyReport.jsx` -> project-level monthly metrics
- `UserMonthlyReport.jsx` -> user-level monthly metrics
- `FilterBar.jsx` -> top-level dashboard filter controls
- `TabsNavigation.jsx` -> general dashboard tabs
- `AssistantManagerTabsNavigation.jsx` -> assistant-manager tab map

## `src/components/dashboard/overview`

- `OverviewTab.jsx` -> role-driven overview container (agent and non-agent views)
- `AgentFilterBar.jsx` -> agent filter section
- `HourlyChart.jsx` -> billable/production chart
- `StatCard.jsx` -> reusable metric card
- `index.js` -> module exports

## `src/components/dashboard/manage/user`

- `UsersManagement.jsx` -> user management orchestration
- `UsersTable.jsx` -> users list/table rendering
- `AddUserFormModal.jsx` -> create user flow
- `EditUserFormModal.jsx` -> update user flow
- `DeleteUserModal.jsx` -> delete/deactivate user flow
- `TaskAssignmentModal.jsx` -> user-task assignment flow
- `ManageModule.jsx` -> manage section wrapper

## `src/components/dashboard/manage/project`

- `ProjectsManagement.jsx` -> project management orchestration
- `ProjectHeader.jsx` -> project module header/actions
- `ProjectCard.jsx` -> project card/list unit
- `AddProjectForm.jsx`, `AddProjectFormModal.jsx` -> project create form
- `EditProjectModal.jsx` -> project update flow
- `DeleteProjectModal.jsx` -> project delete flow
- `TasksModal.jsx` -> task list modal inside project context
- `TaskTable.jsx` -> task table
- `EditTaskModal.jsx` -> task update flow
- `DeleteTaskModal.jsx` -> task delete flow
- `index.js` -> module exports

## `src/components/dashboard/manage/category`

- `ProjectCategory.jsx` -> category CRUD/list logic for projects

## `src/components/dashboard/manage/afd`

- `AFDManagement.jsx` -> AFD definitions management used by QC scoring

## `src/components/QAAgentDashboard`

- `QAAgentDashboard.jsx` -> QA agent dashboard wrapper
- `QATabsNavigation.jsx` -> QA tab controls
- `QAFilterBar.jsx` -> QA-specific filter panel
- `QAIndividualAuditReport.jsx` -> detailed audit report

## `src/components/common`

- `UserTrackingView.jsx` -> user permission/tracking workflow module
- `BillableReport.jsx` -> reusable billable report view
- `QCHistoryTimeline.jsx` -> QC status/history chronology
- `QCConfirmationModal.jsx` -> QC submission confirmation
- `MonthCard.jsx` -> monthly summary card
- `UserCard.jsx` -> user metric card
- `SearchableSelect.jsx`, `CustomSelect.jsx`, `MultiSelectWithCheckbox.jsx` -> shared selectors
- `CustomCalendar.jsx` -> shared calendar widget
- `DailyEntryFormModal.jsx` -> daily entry modal
- `DeleteConfirmationModal.jsx` -> common delete confirmation
- `LoadingSpinner.jsx` -> loading state component
- `ErrorMessage.jsx` -> reusable error display

## `src/components/header`

- `Header.jsx` -> top navigation, role-based menu visibility, logout actions

## `src/components/ui`

- `button.tsx`, `calendar.tsx`, `popover.tsx`, `pagination.tsx` -> primitive reusable UI controls

## `src/layouts`

- `AppLayout.jsx` -> app shell layout (header + content)
- `AdminLayout.jsx` -> admin-specific content layout

## `src/hooks`

- `useDeviceInfo.js` -> device metadata attached to API payloads
- `useUserDropdowns.js` -> shared dropdown datasets for user forms
- `useProjectManagement.js` -> project module orchestration helper
- `useCurrentUserRole.js` -> role helper (legacy/limited usage paths)

## `src/config`

- `environment.js` -> env resolution, logging helpers, base URL config

## `src/utils`

- `errorMessages.js` -> backend error to user message mapping
- `csvExport.js` -> CSV export helper for report views
- `dateHelpers.js` -> date formatting/helper utilities
- `constants.js` -> app-wide constants
- `fileToBase64.js` -> file conversion utility
- `db.js` -> local/mock helper (legacy utility path)

## Root app files

- `src/main.jsx` -> React app bootstrap
- `src/App.jsx` -> providers + router mount

---

## 7) Environment & Setup

Required env keys (in `.env`):

- `VITE_API_BASE_URL` -> Flask backend URL
- `VITE_API_NODE_BASE_URL` -> Node QC backend URL

Install and run:

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

---

## 8) New Developer Checklist (Recommended)

1. Start both backends first (Flask + Node QC).
2. Validate env URLs in frontend `.env`.
3. Login with each role and verify:
   - route landing page
   - tab visibility
   - permission-based buttons
4. Run end-to-end flows:
   - Agent tracker submit with file
   - AI evaluate + duplicate check
   - QA QC form submit (`regular/correction/rework`)
   - Daily/monthly report filters and export
5. Check browser console for API URL mismatch or 401 loops.

---

## 9) Important Gotchas

- `vite.config.js` proxy target and `.env` backend IPs can drift; keep them aligned.
- Token storage uses both session and local patterns across clients; avoid introducing a third token strategy.
- Many major screens are large orchestration components; prefer extracting logic into hooks/services before adding complexity.
- No automated test suite is currently configured; manual regression checklist is mandatory for QA-sensitive changes.

