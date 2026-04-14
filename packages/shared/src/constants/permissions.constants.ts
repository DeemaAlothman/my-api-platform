/**
 * Centralized permission constants for all services.
 * Format: module:resource:action
 */
export const PERMISSIONS = {
  // ── Users ──────────────────────────────────────────────────────────
  USERS: {
    READ:         'users:read',
    CREATE:       'users:create',
    UPDATE:       'users:update',
    DELETE:       'users:delete',
    ASSIGN_ROLES: 'users:assign_roles',
  },
  EMPLOYEES: {
    READ:   'employees:read',
    CREATE: 'employees:create',
    UPDATE: 'employees:update',
    DELETE: 'employees:delete',
  },
  DEPARTMENTS: {
    READ:   'departments:read',
    CREATE: 'departments:create',
    UPDATE: 'departments:update',
    DELETE: 'departments:delete',
  },
  ROLES: {
    READ:   'roles:read',
    CREATE: 'roles:create',
    UPDATE: 'roles:update',
    DELETE: 'roles:delete',
  },
  JOB_TITLES: {
    READ:   'job-titles:read',
    CREATE: 'job-titles:create',
    UPDATE: 'job-titles:update',
    DELETE: 'job-titles:delete',
  },
  JOB_GRADES: {
    READ:   'job-grades:read',
    CREATE: 'job-grades:create',
    UPDATE: 'job-grades:update',
    DELETE: 'job-grades:delete',
  },

  // ── Leave ──────────────────────────────────────────────────────────
  LEAVE_TYPES: {
    READ:   'leave_types:read',
    CREATE: 'leave_types:create',
    UPDATE: 'leave_types:update',
    DELETE: 'leave_types:delete',
  },
  LEAVE_REQUESTS: {
    READ:             'leave_requests:read',
    READ_ALL:         'leave_requests:read_all',
    CREATE:           'leave_requests:create',
    UPDATE:           'leave_requests:update',
    DELETE:           'leave_requests:delete',
    SUBMIT:           'leave_requests:submit',
    APPROVE_MANAGER:  'leave_requests:approve_manager',
    APPROVE_HR:       'leave_requests:approve_hr',
    CANCEL:           'leave_requests:cancel',
  },
  LEAVE_BALANCES: {
    READ:        'leave_balances:read',
    READ_ALL:    'leave_balances:read_all',
    CREATE:      'leave_balances:create',
    ADJUST:      'leave_balances:adjust',
    INITIALIZE:  'leave_balances:initialize',
    DELETE:      'leave_balances:delete',
    CARRY_OVER:  'leave_balances:carry_over',
  },
  HOLIDAYS: {
    READ:   'holidays:read',
    CREATE: 'holidays:create',
    UPDATE: 'holidays:update',
    DELETE: 'holidays:delete',
  },

  // ── Attendance ─────────────────────────────────────────────────────
  WORK_SCHEDULES: {
    READ:   'attendance.work-schedules.read',
    CREATE: 'attendance.work-schedules.create',
    UPDATE: 'attendance.work-schedules.update',
    DELETE: 'attendance.work-schedules.delete',
  },
  ATTENDANCE_RECORDS: {
    READ:       'attendance.records.read',
    READ_OWN:   'attendance.records.read-own',
    CREATE:     'attendance.records.create',
    UPDATE:     'attendance.records.update',
    DELETE:     'attendance.records.delete',
    CHECK_IN:   'attendance.records.check-in',
    CHECK_OUT:  'attendance.records.check-out',
  },
  ATTENDANCE_ALERTS: {
    READ:     'attendance.alerts.read',
    READ_OWN: 'attendance.alerts.read-own',
    CREATE:   'attendance.alerts.create',
    UPDATE:   'attendance.alerts.update',
    DELETE:   'attendance.alerts.delete',
    RESOLVE:  'attendance.alerts.resolve',
  },
  ATTENDANCE_JUSTIFICATIONS: {
    READ:            'attendance.justifications.read',
    READ_OWN:        'attendance.justifications.read-own',
    CREATE_OWN:      'attendance.justifications.create-own',
    MANAGER_REVIEW:  'attendance.justifications.manager-review',
    HR_REVIEW:       'attendance.justifications.hr-review',
  },
  ATTENDANCE_REPORTS: {
    READ: 'attendance.reports.read',
  },

  // ── Evaluation ─────────────────────────────────────────────────────
  EVALUATION_PERIODS: {
    READ:   'evaluation:periods:read',
    CREATE: 'evaluation:periods:create',
    UPDATE: 'evaluation:periods:update',
    DELETE: 'evaluation:periods:delete',
    MANAGE: 'evaluation:periods:manage',
  },
  EVALUATION_CRITERIA: {
    READ:   'evaluation:criteria:read',
    CREATE: 'evaluation:criteria:create',
    UPDATE: 'evaluation:criteria:update',
    DELETE: 'evaluation:criteria:delete',
  },
  EVALUATION_FORMS: {
    VIEW_OWN:         'evaluation:forms:view-own',
    VIEW_ALL:         'evaluation:forms:view-all',
    SELF_EVALUATE:    'evaluation:forms:self-evaluate',
    MANAGER_EVALUATE: 'evaluation:forms:manager-evaluate',
    HR_REVIEW:        'evaluation:forms:hr-review',
    GM_APPROVAL:      'evaluation:forms:gm-approval',
  },
  EVALUATION_PEERS: {
    SUBMIT: 'evaluation:peer:submit',
  },
  EVALUATION_GOALS: {
    MANAGE: 'evaluation:goals:manage',
  },

  // ── Custodies ──────────────────────────────────────────────────────
  CUSTODIES: {
    READ:   'custodies:read',
    CREATE: 'custodies:create',
    UPDATE: 'custodies:update',
    DELETE: 'custodies:delete',
  },

  // ── Requests ───────────────────────────────────────────────────────
  REQUESTS: {
    READ:             'requests:read',
    MANAGER_APPROVE:  'requests:manager-approve',
    MANAGER_REJECT:   'requests:manager-reject',
    HR_APPROVE:       'requests:hr-approve',
    HR_REJECT:        'requests:hr-reject',
    // Dynamic approval system
    APPROVE:          'requests:approve',
    REJECT:           'requests:reject',
    CEO_APPROVE:      'requests:ceo-approve',
    CFO_APPROVE:      'requests:cfo-approve',
    READ_ALL_STEPS:   'requests:read-all-steps',
    MANAGE_WORKFLOWS: 'requests:manage-workflows',
  },
} as const;
