/**
 * Role name constants — single source of truth matching DB values exactly.
 * Update here if a role is renamed in DB.
 */
export const ROLES = {
  SUPER_ADMIN:      'super_admin',
  HR:               'HR',
  HR_SPECIALIST:    'HR_Specialist',
  CEO:              'CEO',
  CFO:              'CFO',
  GENERAL_MANAGER:  'General Manager',
  DIRECT_MANAGER:   'DIRECT_MANAGER',
  FOLLOW_UP_OFFICER:'Follow-up official',
  EMPLOYEE:         'موظف',
} as const;

export type RoleName = typeof ROLES[keyof typeof ROLES];

/** Roles that should receive HR-targeted notifications */
export const HR_NOTIFICATION_ROLES: RoleName[] = [
  ROLES.SUPER_ADMIN,
  ROLES.HR,
  ROLES.HR_SPECIALIST,
];
