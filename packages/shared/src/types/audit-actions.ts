export enum AuditAction {
  // Roles
  ROLE_CREATED               = 'ROLE_CREATED',
  ROLE_UPDATED               = 'ROLE_UPDATED',
  ROLE_DELETED               = 'ROLE_DELETED',
  ROLE_PERMISSIONS_CHANGED   = 'ROLE_PERMISSIONS_CHANGED',

  // User-Role assignments
  ROLE_ASSIGNED_TO_USER      = 'ROLE_ASSIGNED_TO_USER',
  ROLE_REVOKED_FROM_USER     = 'ROLE_REVOKED_FROM_USER',

  // Login events
  LOGIN_SUCCESS              = 'LOGIN_SUCCESS',
  LOGIN_FAILED               = 'LOGIN_FAILED',

  // Security
  ACCESS_DENIED              = 'ACCESS_DENIED',
  SUSPICIOUS_REFRESH_REUSE   = 'SUSPICIOUS_REFRESH_REUSE',
}
