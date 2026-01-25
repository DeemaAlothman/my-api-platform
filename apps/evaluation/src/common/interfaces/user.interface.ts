export interface JwtPayload {
  sub: string;
  username: string;
  permissions?: string[];
  departmentId?: string;
  managerId?: string;
  iat?: number;
  exp?: number;
}

export interface CurrentUser {
  userId: string;
  username: string;
  permissions: string[];
  departmentId?: string;
  managerId?: string;
}
