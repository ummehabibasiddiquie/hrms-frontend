// Shift & Goal Configuration
export const SHIFT_START_HOUR = 9; // 9 AM
export const SHIFT_HOURS_COUNT = 13; // 9 AM to 10 PM
export const MONTHLY_GOAL = 450000;

// ViewState Enum
export const ViewState = {
  LOGIN: 'LOGIN',
  ENTRY: 'ENTRY',
  DASHBOARD: 'DASHBOARD',
  ADMIN_PANEL: 'ADMIN_PANEL',
  QUALITY: 'QUALITY',
  SCHEDULER: 'SCHEDULER',
  GUIDELINES: 'GUIDELINES',
  TRACKER_REPORT: 'TRACKER_REPORT',
  AGENT_LIST: 'AGENT_LIST'
};

// Incentive Configuration Defaults
export const DEFAULT_INCENTIVE_CONFIG = {
  otThreshold: 200,
  minDailyHours: 11,
  workingDays: 20,
  slabs: [
    { threshold: 225, incentive50: 2000, incentive75: 2500 },
    { threshold: 250, incentive50: 4000, incentive75: 4000 },
    { threshold: 275, incentive50: 6500, incentive75: 6500 },
    { threshold: 300, incentive50: 10000, incentive75: 10000 }
  ]
};

// Guidelines Seed
export const SEED_GUIDELINES = [
  {
    id: 'g1',
    title: 'Production Entry & Reporting Rules',
    content: `1. Hourly Logging: Agents must log their production numbers at the end of every hour. Accurate real-time data is crucial for project tracking.
2. Adherence Flag: To be considered "Compliant" for the day, you must have logged active production for at least 7 distinct hours.
3. Days with less than 7 active hours will be flagged in the "Reporting Adherence" report visible to Managers and QA.
4. Repeated non-compliance (more than 7 times a month) may impact performance reviews.`
  },
  {
    id: 'g2',
    title: 'Quality Assurance (QC) Impact',
    content: `1. Your Billable Hours are directly linked to your Quality Score.
2. The Formula: If your QC Score is below 98%, your hours are penalized.
   Formula: Adjusted Hours = (Raw Hours * QC Score%)
   Example: 10 Hours worked with 90% QC = 9 Adjusted Billable Hours.
3. If your QC Score is 98% or higher, you retain 100% of your billable hours.`
  },
  {
    id: 'g3',
    title: 'Incentive Qualification Criteria',
    content: `1. Minimum Threshold: Incentives only trigger after achieving 200 Adjusted Billable Hours in the month.
2. Consistency Rule: You must achieve at least 11 Billable Hours/Day on 50% of working days to qualify for the base incentive.
3. High Performance Bonus: Achieving 11+ hours on 75% of working days unlocks higher incentive tiers.
4. Overtime (OT): Paid for every adjusted hour above 200 hours.`
  },
  {
    id: 'g4',
    title: 'Incentive Slabs (Monthly)',
    content: `Slab 1 (200 - 224 Hrs): OT Payment Only.
Slab 2 (225 - 249 Hrs): OT + ₹2,000 Bonus (if 50% consistency) OR ₹2,500 (if 75% consistency).
Slab 3 (250 - 274 Hrs): OT + ₹4,000 Bonus.
Slab 4 (275 - 299 Hrs): OT + ₹6,500 Bonus.
Slab 5 (300+ Hrs): OT + ₹10,000 Bonus.`
  }
];

// Users Seed
export const SEED_USERS = [
  { id: 'u1', empId: 'CEO', name: 'Ashfaq Shilliwala', username: 'ashfaq', email: 'ashfaq@company.com', role: 'ADMIN', designation: 'CEO', password: '01Dec2025', salary: 0, assignedTasks: [] },
  { id: 'u2', empId: '1193', name: 'Sriman Narayan', username: 'sriman', email: 'sriman@company.com', role: 'ADMIN', designation: 'Ops Manager', reportingManager: 'Ashfaq Shilliwala', password: '123', salary: 0, assignedTasks: [] },

  // APMs
  { id: 'u3', empId: '13', name: 'Mohsin Pathan', username: 'mohsin', email: 'mohsin@company.com', role: 'PROJECT_MANAGER', designation: 'Asst. Project Manager', reportingManager: 'Sriman Narayan', password: '123', salary: 0, assignedTasks: [] },
  { id: 'u4', empId: '1161', name: 'Dharmesh Jotania', username: 'dharmesh', email: 'dharmesh@company.com', role: 'PROJECT_MANAGER', designation: 'Asst. Project Manager', reportingManager: 'Sriman Narayan', password: '123', salary: 0, assignedTasks: [] },
  { id: 'uNew1', empId: '1195', name: 'Venkateshwaran Iyer', username: 'venkat', email: 'venkat@company.com', role: 'PROJECT_MANAGER', designation: 'Asst. Project Manager', reportingManager: 'Sriman Narayan', password: '123', salary: 0, assignedTasks: [] },

  // QA Team
  { id: 'u5', empId: '1153', name: 'Jimil Kinariwala', username: 'jimil', email: 'jimil@company.com', role: 'PROJECT_MANAGER', designation: 'QA', reportingManager: 'Mohsin Pathan', password: '123', salary: 0, assignedTasks: [] },
  { id: 'u6', empId: '1142', name: 'Apurva Bhatti', username: 'apurva', email: 'apurva@company.com', role: 'PROJECT_MANAGER', designation: 'QA', reportingManager: 'Dharmesh Jotania', password: '123', salary: 0, assignedTasks: [] },

  // HR & Finance
  { id: 'u7', empId: 'HR01', name: 'Yahya Irani', username: 'yahya', email: 'yahya@company.com', role: 'FINANCE_HR', designation: 'Sr. HR Manager', reportingManager: 'Ashfaq Shilliwala', password: '123', salary: 0, assignedTasks: [] },
  { id: 'u8', empId: 'FIN01', name: 'Amit Mandviwala', username: 'amit', email: 'amit@company.com', role: 'FINANCE_HR', designation: 'Asst. Manager Finance', reportingManager: 'Ashfaq Shilliwala', password: '123', salary: 0, assignedTasks: [] },

  // Agents reporting to Mohsin
  { id: 'a1', empId: '1157', name: 'Bhumin Pathak', username: 'bhumin', email: 'bhumin@company.com', role: 'AGENT', designation: 'Agent', reportingManager: 'Mohsin Pathan', password: '123', salary: 25000, assignedTasks: [] },
  { id: 'a2', empId: '1179', name: 'Manas Pradhan', username: 'manas', email: 'manas@company.com', role: 'AGENT', designation: 'Agent', reportingManager: 'Mohsin Pathan', password: '123', salary: 25000, assignedTasks: [] },
  { id: 'a3', empId: '1151', name: 'Priyanshu Patra', username: 'priyanshu', email: 'priyanshu@company.com', role: 'AGENT', designation: 'Agent', reportingManager: 'Mohsin Pathan', password: '123', salary: 25000, assignedTasks: [] },
  { id: 'a4', empId: '1130', name: 'Shitik Patel', username: 'shitik', email: 'shitik@company.com', role: 'AGENT', designation: 'Agent', reportingManager: 'Mohsin Pathan', password: '123', salary: 25000, assignedTasks: [] },
  { id: 'a5', empId: '1140', name: 'Suhani Patel', username: 'suhani', email: 'suhani@company.com', role: 'AGENT', designation: 'Agent', reportingManager: 'Mohsin Pathan', password: '123', salary: 25000, assignedTasks: [] },
  { id: 'a6', empId: '348', name: 'Chetan Pachchigar', username: 'chetan', email: 'chetan@company.com', role: 'AGENT', designation: 'Agent', reportingManager: 'Mohsin Pathan', password: '123', salary: 25000, assignedTasks: [] },
  { id: 'a7', empId: '1129', name: 'Udit Kamani', username: 'udit', email: 'udit@company.com', role: 'AGENT', designation: 'Agent', reportingManager: 'Mohsin Pathan', password: '123', salary: 25000, assignedTasks: [] },
  { id: 'a8', empId: '1152', name: 'Vivek Bhagwagar', username: 'vivek', email: 'vivek@company.com', role: 'AGENT', designation: 'Agent', reportingManager: 'Mohsin Pathan', password: '123', salary: 25000, assignedTasks: [] },
  { id: 'a9', empId: '1189', name: 'Jash Patel', username: 'jash', email: 'jash@company.com', role: 'AGENT', designation: 'Agent', reportingManager: 'Mohsin Pathan', password: '123', salary: 25000, assignedTasks: [] },
  { id: 'a10', empId: '1185', name: 'Vrushti Trivedi', username: 'vrushti', email: 'vrushti@company.com', role: 'AGENT', designation: 'Agent', reportingManager: 'Mohsin Pathan', password: '123', salary: 25000, assignedTasks: [] },
  { id: 'a11', empId: '1192', name: 'Chaitanya Bhanarkar', username: 'chaitanya', email: 'chaitanya@company.com', role: 'AGENT', designation: 'Agent', reportingManager: 'Mohsin Pathan', password: '123', salary: 25000, assignedTasks: [] },
  { id: 'aNew1', empId: '1199', name: 'Manshi Pandya', username: 'manshi', email: 'manshi@company.com', role: 'AGENT', designation: 'Agent', reportingManager: 'Mohsin Pathan', password: '123', salary: 25000, assignedTasks: [] },
  { id: 'aNew2', empId: '1200', name: 'Vatsal Modi', username: 'vatsal', email: 'vatsal@company.com', role: 'AGENT', designation: 'Agent', reportingManager: 'Mohsin Pathan', password: '123', salary: 25000, assignedTasks: [] },

  // Agents reporting to Dharmesh
  { id: 'a12', empId: '1169', name: 'Ekta Sharma', username: 'ekta', email: 'ekta@company.com', role: 'AGENT', designation: 'Agent', reportingManager: 'Dharmesh Jotania', password: '123', salary: 25000, assignedTasks: [] },
  { id: 'a13', empId: '1156', name: 'Krupa Patel', username: 'krupa', email: 'krupa@company.com', role: 'AGENT', designation: 'Agent', reportingManager: 'Dharmesh Jotania', password: '123', salary: 25000, assignedTasks: [] },
  { id: 'a14', empId: '1171', name: 'Neel Patel', username: 'neel', email: 'neel@company.com', role: 'AGENT', designation: 'Agent', reportingManager: 'Dharmesh Jotania', password: '123', salary: 25000, assignedTasks: [] },
  { id: 'a15', empId: '1150', name: 'Priya Mistry', username: 'priya', email: 'priya@company.com', role: 'AGENT', designation: 'Agent', reportingManager: 'Dharmesh Jotania', password: '123', salary: 25000, assignedTasks: [] },
  { id: 'a16', empId: '1158', name: 'Shehzad Mirza', username: 'shehzad', email: 'shehzad@company.com', role: 'AGENT', designation: 'Agent', reportingManager: 'Dharmesh Jotania', password: '123', salary: 25000, assignedTasks: [] },
  { id: 'a17', empId: '1176', name: 'Sunny Singh', username: 'sunny', email: 'sunny@company.com', role: 'AGENT', designation: 'Agent', reportingManager: 'Dharmesh Jotania', password: '123', salary: 25000, assignedTasks: [] },
  { id: 'a18', empId: '1164', name: 'Vivek Rana', username: 'vrana', email: 'vrana@company.com', role: 'AGENT', designation: 'Agent', reportingManager: 'Dharmesh Jotania', password: '123', salary: 25000, assignedTasks: [] },
  { id: 'a19', empId: '1175', name: 'Yash Patel', username: 'yash', email: 'yash@company.com', role: 'AGENT', designation: 'Agent', reportingManager: 'Dharmesh Jotania', password: '123', salary: 25000, assignedTasks: [] },
  { id: 'a20', empId: '1188', name: 'Khushi Hirpara', username: 'khushi', email: 'khushi@company.com', role: 'AGENT', designation: 'Agent', reportingManager: 'Dharmesh Jotania', password: '123', salary: 25000, assignedTasks: [] },
  { id: 'a21', empId: '1186', name: 'Archana Kota', username: 'archana', email: 'archana@company.com', role: 'AGENT', designation: 'Agent', reportingManager: 'Dharmesh Jotania', password: '123', salary: 25000, assignedTasks: [] },
  { id: 'a22', empId: '1187', name: 'Anchal Yadav', username: 'anchal', email: 'anchal@company.com', role: 'AGENT', designation: 'Agent', reportingManager: 'Dharmesh Jotania', password: '123', salary: 25000, assignedTasks: [] },
  { id: 'aNew3', empId: '1201', name: 'Swapnil Patel', username: 'swapnil', email: 'swapnil@company.com', role: 'AGENT', designation: 'Agent', reportingManager: 'Dharmesh Jotania', password: '123', salary: 25000, assignedTasks: [] },
];

// Projects Seed
export const SEED_PROJECTS = [
  {
    id: 'p1',
    name: 'MoveEasy',
    monthlyHoursTarget: 720,
    teamOwner: 'Mohsin',
    apmOwner: 'Mohsin',
    qaOwner: 'Jimil',
    tasks: [{ id: 't1', name: 'MV', targetPerHour: 50 }]
  },
  {
    id: 'p2',
    name: 'Sunstone Analyst',
    monthlyHoursTarget: 180,
    teamOwner: 'Mohsin',
    apmOwner: 'Mohsin',
    tasks: [{ id: 't2', name: 'REX', targetPerHour: 40 }]
  },
  {
    id: 'p3',
    name: 'Solis Invoice',
    monthlyHoursTarget: 100,
    teamOwner: 'Mohsin',
    qaOwner: 'Apurva',
    tasks: [{ id: 't3', name: 'SLICK', targetPerHour: 60 }]
  },
  {
    id: 'p4',
    name: 'Forgepoint',
    monthlyHoursTarget: 50,
    teamOwner: 'Mohsin',
    tasks: [{ id: 't4', name: 'FGP', targetPerHour: 45 }]
  },
  {
    id: 'p5',
    name: 'Mozato',
    monthlyHoursTarget: 0,
    teamOwner: 'Mohsin',
    tasks: [{ id: 't5', name: 'JADE', targetPerHour: 50 }]
  },
  {
    id: 'p6',
    name: 'Oxford',
    monthlyHoursTarget: 0,
    teamOwner: 'Mohsin',
    tasks: [{ id: 't6', name: 'OXR - Screenshot', targetPerHour: 80 }]
  },
  {
    id: 'p7',
    name: 'Solis 24X7',
    monthlyHoursTarget: 180,
    teamOwner: 'Mohsin',
    tasks: [{ id: 't7', name: 'Solis', targetPerHour: 55 }]
  },
  {
    id: 'p8',
    name: 'Altrum',
    monthlyHoursTarget: 210,
    teamOwner: 'Mohsin',
    apmOwner: 'Mohsin',
    tasks: [{ id: 't8', name: 'BITE', targetPerHour: 40 }]
  },
  {
    id: 'p9',
    name: 'FrontStream',
    monthlyHoursTarget: 30,
    teamOwner: 'Mohsin',
    tasks: [{ id: 't9', name: 'WAVE', targetPerHour: 60 }]
  },

  // Dharmesh's projects
  {
    id: 'p10',
    name: 'FirstIgnite',
    monthlyHoursTarget: 540,
    teamOwner: 'Dharmesh',
    qaOwner: 'Jimil',
    tasks: [{ id: 't10', name: 'FIRST', targetPerHour: 70 }]
  },
  {
    id: 'p11',
    name: 'Mfunds',
    monthlyHoursTarget: 1260,
    teamOwner: 'Dharmesh',
    qaOwner: 'Apurva',
    tasks: [{ id: 't11', name: 'MFUNDS', targetPerHour: 50 }]
  }
];
