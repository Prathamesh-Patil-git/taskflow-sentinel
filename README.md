# TaskFlow Sentinel

Build a complete, production-quality web application UI for a project called:

Fault-Tolerant Distributed Task Scheduling & Resource Allocation System

The application is a real-time monitoring and management dashboard for a distributed computing platform. It manages tasks, worker nodes, resource allocation, scheduling decisions, failures, retries, and system performance.

The UI should look like a premium modern SaaS/devops monitoring product, NOT like a generic admin dashboard.

1. DESIGN SYSTEM — CLAYMORPHISM

Use a polished Claymorphism + Soft Neumorphism visual style throughout the application.

Visual characteristics:

Soft 3D clay-like cards

Large rounded corners: 20–28px

Soft outer shadows

Very subtle inner shadows

Slightly raised UI elements

Floating cards

Rounded buttons

Smooth gradients

Soft depth and elevation

Minimal borders

Clean spacious layouts

Modern typography

Premium SaaS appearance

Use a light background with a very subtle warm/cool neutral gradient.

Suggested visual palette:

Background: #F4F6FA / #F7F8FC

Primary: Indigo / Violet

Success: Emerald

Warning: Amber

Danger: Red

Info: Blue

Text: Dark navy/charcoal

Secondary text: Muted gray

Do not make the interface overly colorful.

Use color primarily for:

status

alerts

charts

metrics

active navigation

important actions

Cards should have a subtle 3D raised appearance.

Use consistent spacing and a strong visual hierarchy.

2. TECH STACK

Use:

React

TypeScript

Vite

Tailwind CSS

shadcn/ui where appropriate

Lucide React icons

Recharts for charts

Framer Motion for subtle animations

React Router

TanStack Query for API/data fetching

Axios for API requests

Backend-ready architecture:

Python

FastAPI

PostgreSQL

Redis

WebSockets for real-time worker/task updates

For this Lovable implementation, initially use realistic mock data and a clean service/API abstraction so the backend can be connected later without redesigning the frontend.

Structure the frontend so API calls are separated from UI components.

3. APPLICATION STRUCTURE

Create the following main pages:

Dashboard

Tasks

Workers

Scheduler

Resource Allocation

Fault Monitor

Analytics

Logs

Settings

Use a persistent left sidebar navigation on desktop.

On mobile, convert the sidebar into a drawer/bottom navigation.

Top navigation should contain:

Page title

Global search

System health indicator

Notifications

User/profile menu

4. GLOBAL LAYOUT

Desktop layout:

| Sidebar | Top Header |
| |--------------------------------------|
| | Main Content |
| | |
| | |

Sidebar:

Product logo

Product name:
"TaskFlow"

Subtitle:
"Distributed Scheduler"

Navigation:

Overview
Dashboard
Tasks
Workers
Scheduler
Resources
Fault Monitor
Analytics
Logs

Bottom:

Settings
System Status

Use icons from Lucide React.

The active navigation item should appear as a raised clay pill/card.

5. DASHBOARD — MAIN SCREEN

Create a highly polished operational dashboard.

Header:

"Distributed System Overview"

Subtitle:

"Real-time monitoring of tasks, workers, resources and fault recovery."

Top-right:

Live indicator

Last updated timestamp

Refresh button

KPI ROW

Create 6 premium metric cards.

Total Tasks

Running Tasks

Completed Tasks

Failed Tasks

Active Workers

System Throughput

Each metric card should contain:

Small icon

Metric label

Large number

Percentage change

Small trend indicator

Mini sparkline chart

Example:

TOTAL TASKS
12,486
↑ 12.8%
vs last 24h

Make each card clay-like and slightly raised.

6. CIRCULAR SPEEDOMETER METRICS

This is very important.

Create large circular speedometer/gauge components for:

CPU Utilization

Example:

78%

Below:

"Average across 8 workers"

Memory Utilization

Example:

64%

System Health

Example:

92%

Scheduler Efficiency

Example:

87%

Use beautiful circular progress gauges.

Requirements:

Large circular ring

Gradient progress

Percentage displayed in center

Small label underneath

Animated progress when the page loads

Different semantic colors for healthy/warning/critical

Smooth animation

Use Recharts RadialBarChart or a custom SVG implementation

Do NOT use simple progress bars for these metrics.

The circular gauges should feel like premium monitoring instruments.

7. SYSTEM HEALTH SECTION

Create a large card titled:

"System Health"

Show:

Overall Health: 92%

Then 4 horizontal health indicators:

Scheduler
Healthy

Worker Network
Healthy

Task Queue
Healthy

Database
Healthy

Use status dots and subtle animations.

Add:

"All systems operational"

with a green status indicator.

8. LIVE TASK EXECUTION

Create a large dashboard card titled:

"Live Task Execution"

Display a real-time area/line chart showing:

Tasks submitted

Tasks running

Tasks completed

Tasks failed

X-axis:

Time

Y-axis:

Task count

Use Recharts.

Above the chart show small legend pills.

Add a time selector:

1H
6H
24H
7D

9. WORKER CLUSTER

Create a section:

"Worker Cluster"

Display workers as attractive clay cards.

Each worker card should show:

Worker ID:
worker-01

Status:
ONLINE

CPU:
42%

RAM:
58%

Tasks:
12

Network:
Healthy

Each worker card should have:

Status indicator

Circular mini CPU gauge

Circular mini RAM gauge

Current task count

Worker uptime

Last heartbeat

3-dot menu

Example:

WORKER-01
● ONLINE

CPU
42%

RAM
58%

12 Active Tasks

Uptime
4d 12h

Heartbeat
2 sec ago

Add a "View All Workers" button.

10. WORKER STATUS VISUALIZATION

Create a cluster overview visualization.

Display:

    SCHEDULER
        |
-------------------
|        |        |


Worker 01 Worker 02 Worker 03
| | |
Tasks Tasks Tasks

Make it visually attractive using connected nodes/cards.

Show worker status:

Green = healthy
Amber = overloaded
Red = failed
Gray = offline

Animate the connection lines subtly.

11. TASK QUEUE

Create a large card:

"Task Queue"

Tabs:

All
Pending
Running
Completed
Failed
Retrying

Table columns:

Task ID
Task Name
Priority
CPU
Memory
Worker
Status
Duration
Created

Example rows:

T-10241
Image Processing
High
4 CPU
2 GB
worker-03
Running
18s

Use status badges with clay-like styling.

Priority badges:

Critical
High
Medium
Low

Task status:

Pending
Running
Completed
Failed
Retrying

Add:

Search tasks

Filter

Sort

Pagination

12. TASK DETAIL PAGE

When a task is selected, show a detailed page/drawer.

Header:

Task T-10241

Status:
RUNNING

Show:

Task Name
Priority
Created At
Started At
Assigned Worker
CPU Requirement
Memory Requirement
Execution Time
Retry Count

Then display a task lifecycle timeline:

Submitted
↓
Queued
↓
Scheduled
↓
Running
↓
Completed

Highlight current state.

Add an execution log section.

13. SCHEDULER PAGE

Create a dedicated page:

"Scheduler Control Center"

Show:

Scheduling Algorithm:

Resource-Aware

Dropdown options:

Round Robin

Least Loaded

Resource Aware

Priority Based

Show scheduler metrics:

Scheduling Rate
Tasks/sec

Average Scheduling Latency
42 ms

Queue Depth
128

Scheduling Efficiency
87%

Create a visual "Scheduling Decisions" section.

Example:

Task T-1042
↓
Requirements:
CPU 4
RAM 2GB
↓
Worker Scoring
Worker 01 → 74
Worker 02 → 91
Worker 03 → 62
↓
Selected:
Worker 02

Represent this using attractive cards and connecting arrows.

14. RESOURCE ALLOCATION PAGE

Create:

"Resource Allocation"

Top circular gauges:

CPU Allocation
72%

Memory Allocation
64%

Storage
48%

Network
31%

Then create a worker resource table:

Worker
CPU Capacity
CPU Used
RAM Capacity
RAM Used
Tasks
Load

Use visual mini-bars and gauges.

Add a large resource utilization chart.

Charts:

CPU utilization over time
Memory utilization over time
Task distribution

15. FAULT MONITOR PAGE

This is one of the most important pages.

Title:

"Fault Monitor"

Show a large system fault status card.

Current Status:

"0 Active Failures"

Then metrics:

Failures Today
4

Recovered Automatically
4

Recovery Rate
100%

Average Recovery Time
3.2 sec

Create a fault event timeline.

Example:

10:42:31
Worker-03 heartbeat timeout

10:42:33
Worker-03 marked FAILED

10:42:34
3 tasks detected as interrupted

10:42:35
Tasks requeued

10:42:37
Tasks reassigned to Worker-01

10:42:39
Recovery completed

Use a timeline with colored status indicators.

16. FAULT TOLERANCE VISUALIZATION

Create a large interactive visualization showing:

Worker 01
Worker 02
Worker 03

If Worker 03 fails:

Worker 03
↓
FAILED
↓
Tasks detected
↓
Retry Queue
↓
Scheduler
↓
Worker 01 / Worker 02
↓
Recovered

Use animated transitions.

Provide a "Simulate Failure" button for demo purposes.

When clicked:

Select a worker

Change status to FAILED

Show failure event

Move active tasks to retry queue

Reassign tasks

Update dashboard metrics

Show recovery notification

This is a key demonstration feature.

17. ANALYTICS PAGE

Create an analytics dashboard.

Metrics:

Total Tasks
Success Rate
Failure Rate
Average Execution Time
Average Queue Time
Average Recovery Time
Throughput
Resource Utilization

Charts:

Task throughput over time

Success vs failure

CPU utilization

Memory utilization

Worker workload distribution

Scheduling algorithm comparison

For algorithm comparison:

Round Robin
Least Loaded
Resource Aware

Display:

Average Completion Time
CPU Utilization
Task Failure Rate
Scheduling Latency

Use a clean comparison chart.

18. PERFORMANCE METRICS

Create premium metric cards for:

Throughput

1,240 tasks/min

Average Latency

184 ms

Success Rate

98.7%

Recovery Rate

100%

Average Recovery Time

3.2 sec

CPU Utilization

76%

Memory Utilization

64%

Worker Availability

99.8%

Use circular gauges for the percentage metrics.

19. LOGS PAGE

Create a professional log viewer.

Columns:

Timestamp
Level
Component
Worker
Message

Levels:

INFO
WARNING
ERROR
CRITICAL

Add:

Search logs
Filter by level
Filter by worker
Date range
Auto-scroll toggle

Use a monospace font for log messages.

20. NOTIFICATIONS

Create a notification dropdown.

Examples:

"Worker-03 recovered successfully."

"12 tasks were reassigned."

"Worker-02 CPU utilization exceeded 85%."

"Task T-1024 failed and is being retried."

Use appropriate icons and severity indicators.

21. INTERACTIONS

Add polished interactions:

Hover elevation on cards

Smooth page transitions

Animated gauges

Animated chart loading

Button press animations

Toast notifications

Modal dialogs

Dropdown filters

Table sorting

Search

Pagination

Worker detail drawer

Task detail drawer

Failure simulation

Dark/light theme toggle

Animations should be subtle and professional.

Do NOT over-animate the dashboard.

22. RESPONSIVE DESIGN

Desktop:

Full sidebar + multi-column dashboard.

Tablet:

Collapsible sidebar + 2-column cards.

Mobile:

Single-column layout.

Important dashboard metrics should remain readable on mobile.

Circular gauges should resize appropriately.

Tables should become horizontally scrollable cards on mobile.

23. DARK MODE

Implement a premium dark mode.

Dark mode should maintain the claymorphism aesthetic.

Use:

Dark charcoal background

Elevated clay cards

Soft shadows

Indigo/violet highlights

Muted text

Bright semantic status colors

Do not simply invert the colors.

24. MOCK REAL-TIME DATA

Create realistic mock data and simulate real-time updates.

Every few seconds:

CPU utilization changes

Memory changes

Task counts change

New tasks appear

Worker heartbeats update

Throughput changes

The dashboard should feel like a genuinely live distributed system.

Use a clean mock service layer so this can later be replaced by:

FastAPI REST APIs + WebSockets.

25. DATA MODELS

Prepare frontend types/interfaces for:

Worker:

id
name
status
cpuCapacity
cpuUsage
memoryCapacity
memoryUsage
activeTasks
uptime
lastHeartbeat
reliability

Task:

id
name
priority
status
cpuRequired
memoryRequired
workerId
createdAt
startedAt
completedAt
duration
retryCount

Scheduler:

algorithm
queueDepth
schedulingRate
averageLatency
efficiency

Fault:

id
workerId
type
severity
timestamp
status
affectedTasks
recoveryTime

26. API-READY ARCHITECTURE

Prepare service functions such as:

GET /api/dashboard
GET /api/workers
GET /api/workers/:id
GET /api/tasks
GET /api/tasks/:id
POST /api/tasks
GET /api/scheduler
GET /api/resources
GET /api/faults
GET /api/logs

WebSocket:

/ws/dashboard

Use mock implementations initially.

27. EMPTY, LOADING AND ERROR STATES

Every major page must have:

Loading skeleton

Empty state

Error state

Retry button

Do not leave blank screens.

28. ACCESSIBILITY

Use:

Semantic HTML

Accessible buttons

Keyboard navigation

Proper labels

Sufficient contrast

Tooltips for unfamiliar icons

ARIA labels where needed

29. IMPORTANT VISUAL DETAILS

The final UI should feel like:

"Datadog + modern cloud control center + premium SaaS dashboard + claymorphism"

but do NOT copy any existing company's design.

Prioritize:

Excellent visual hierarchy

Clear metrics

Circular speedometer/radial gauges

Real-time monitoring feel

Fault-tolerance visualization

Worker cluster visualization

Clean charts

Premium clay cards

Responsive layout

Professional engineering dashboard aesthetic

Avoid:

Generic Bootstrap dashboard appearance

Excessive gradients

Excessive glassmorphism

Huge unnecessary illustrations

Excessive rounded pills

Clutter

Excessive animations

Random decorative elements

Fake 3D objects that reduce usability

30. LANDING / LOGIN EXPERIENCE

Create a polished login page before the dashboard.

Logo:

TaskFlow

Tagline:

"Intelligent scheduling. Resilient infrastructure."

Show a subtle abstract distributed-node background.

Login card should use the same claymorphism design language.

After login, navigate to Dashboard.

31. FINAL QUALITY BAR

The result should look like a real product that could be shown in a final-year project presentation or technical demonstration.

The dashboard must immediately communicate:

How many tasks are running

How healthy the workers are

How resources are being used

How efficiently tasks are scheduled

Whether failures are occurring

How quickly the system recovers

Use realistic values and realistic data.

Make the dashboard visually impressive, but prioritize usability and technical clarity.

Build all pages and navigation, not just the dashboard.

Ensure the application runs without broken routes, missing components, console errors, or placeholder screens.

Use reusable components for:

MetricCard

CircularGauge

WorkerCard

StatusBadge

TaskTable

PerformanceChart

HealthIndicator

Timeline

ResourceGauge

NotificationPanel

FailureSimulationModal

PageHeader

Sidebar

TopNavigation

The final application should be cohesive, responsive, animated subtly, and ready to connect to a FastAPI/PostgreSQL/Redis backend.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/55f4deca-4194-4fbe-8841-5e4df4c0a87c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
