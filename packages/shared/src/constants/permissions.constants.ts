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
    READ:                 'employees:read',
    CREATE:               'employees:create',
    UPDATE:               'employees:update',
    DELETE:               'employees:delete',
    PROBATION_REPORT_READ:'employees:probation-report:read',
    CONTRACT_REPORT_READ: 'employees:contract-report:read',
    MANAGER_NOTES_READ:   'employees:manager-notes:read',
    MANAGER_NOTES_WRITE:  'employees:manager-notes:write',
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
    READ:          'attendance.records.read',
    READ_OWN:      'attendance.records.read-own',
    CREATE:        'attendance.records.create',
    CREATE_MANUAL: 'attendance.records.create-manual',
    UPDATE:        'attendance.records.update',
    UPDATE_MANUAL: 'attendance.records.update-manual',
    DELETE:        'attendance.records.delete',
    CHECK_IN:      'attendance.records.check-in',
    CHECK_OUT:     'attendance.records.check-out',
    DEVICE:        'attendance.records.device',
  },
  DEDUCTION_POLICIES: {
    READ:   'attendance.policies.read',
    CREATE: 'attendance.policies.create',
    UPDATE: 'attendance.policies.update',
    DELETE: 'attendance.policies.delete',
  },
  ATTENDANCE_CONFIG: {
    READ:   'attendance.config.read',
    CREATE: 'attendance.config.create',
    UPDATE: 'attendance.config.update',
  },
  EMPLOYEE_SCHEDULES: {
    READ:   'attendance.employee-schedules.read',
    CREATE: 'attendance.employee-schedules.create',
    UPDATE: 'attendance.employee-schedules.update',
    DELETE: 'attendance.employee-schedules.delete',
  },
  ATTENDANCE_PAYROLL: {
    READ:    'attendance.payroll.read',
    GENERATE:'attendance.payroll.generate',
    CONFIRM: 'attendance.payroll.confirm',
    EXPORT:  'attendance.payroll.export',
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

  // ── Biometric ──────────────────────────────────────────────────────────
  BIOMETRIC_DEVICES: {
    READ:   'biometric.devices.read',
    CREATE: 'biometric.devices.create',
    UPDATE: 'biometric.devices.update',
    DELETE: 'biometric.devices.delete',
  },
  BIOMETRIC_MAPPINGS: {
    READ:   'biometric.mappings.read',
    CREATE: 'biometric.mappings.create',
    UPDATE: 'biometric.mappings.update',
    DELETE: 'biometric.mappings.delete',
  },

  // ── Jobs ───────────────────────────────────────────────────────────────
  JOB_APPLICATIONS: {
    READ:        'job-applications:read',
    UPDATE:      'job-applications:update',
    CEO_APPROVE: 'job-applications:ceo-approve',
  },

  // ── Custodies ──────────────────────────────────────────────────────
  CUSTODIES: {
    READ:   'custodies:read',
    CREATE: 'custodies:create',
    UPDATE: 'custodies:update',
    DELETE: 'custodies:delete',
  },

  // ── Requests ───────────────────────────────────────────────────────
  // ── Mail ──────────────────────────────────────────────────────────────────
  MAIL: {
    READ_OWN: 'mail:read_own',
    SEND:     'mail:send',
    DRAFT:    'mail:draft',
    UPDATE:   'mail:update',
    DELETE:   'mail:delete',
  },

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
    HIRING_COMPLETE:  'requests:hiring:complete',
  },
} as const;

// ── Type Helpers ──────────────────────────────────────────────────────────────

type ExtractValues<T> = T extends Record<string, infer U>
  ? U extends string ? U : ExtractValues<U>
  : never;

/** Union type of every valid permission string */
export type PermissionName = ExtractValues<typeof PERMISSIONS>;

/** Returns all permission strings as an array */
export function getAllPermissions(): PermissionName[] {
  const result: string[] = [];
  function traverse(obj: any) {
    for (const key in obj) {
      if (typeof obj[key] === 'string') result.push(obj[key]);
      else if (typeof obj[key] === 'object') traverse(obj[key]);
    }
  }
  traverse(PERMISSIONS);
  return result as PermissionName[];
}

export const PERMISSION_MODULES = {
  USERS:       'users',
  EMPLOYEES:   'employees',
  DEPARTMENTS: 'departments',
  ROLES:       'roles',
  LEAVES:      'leaves',
  ATTENDANCE:  'attendance',
  EVALUATION:  'evaluation',
  REQUESTS:    'requests',
  JOBS:        'jobs',
  CUSTODIES:   'custodies',
} as const;
