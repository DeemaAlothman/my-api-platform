import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class DashboardService {
  private readonly urls = {
    users:      process.env.USERS_SERVICE_URL      || 'http://localhost:4002',
    attendance: process.env.ATTENDANCE_SERVICE_URL || 'http://localhost:4004',
    leave:      process.env.LEAVE_SERVICE_URL      || 'http://localhost:4003',
    requests:   process.env.REQUESTS_SERVICE_URL   || 'http://localhost:4006',
    evaluation: process.env.EVALUATION_SERVICE_URL || 'http://localhost:4005',
    jobs:       process.env.JOBS_SERVICE_URL        || 'http://localhost:4008',
  };

  constructor(private readonly http: HttpService) {}

  decodeJwt(token: string): { userId: string; permissions: string[] } {
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
      return { userId: decoded.sub || '', permissions: decoded.permissions || [] };
    } catch {
      return { userId: '', permissions: [] };
    }
  }

  deriveRole(permissions: string[]): string {
    if (permissions.includes('requests:ceo-approve'))  return 'CEO';
    if (permissions.includes('requests:cfo-approve'))  return 'CFO';
    if (permissions.includes('employees:create'))      return 'HR';
    if (permissions.includes('leave_requests:approve_manager')) return 'MANAGER';
    return 'EMPLOYEE';
  }

  private async fetch(url: string, token: string): Promise<any> {
    try {
      const res = await firstValueFrom(
        this.http.get(url, {
          headers: { Authorization: `Bearer ${token}` },
          validateStatus: () => true,
        }),
      );
      if (res.status >= 200 && res.status < 300) {
        return res.data?.data ?? res.data ?? null;
      }
      return null;
    } catch {
      return null;
    }
  }

  async getDashboard(token: string): Promise<any> {
    const { userId, permissions } = this.decodeJwt(token);
    const role = this.deriveRole(permissions);
    const q = `userId=${userId}&role=${role}`;

    const serviceUrl = (svc: string) => `${this.urls[svc]}/api/v1/dashboard/data?${q}`;

    // Always fetch users data
    const usersPromise = this.fetch(serviceUrl('users'), token);

    let attendancePromise: Promise<any> = Promise.resolve(null);
    let leavePromise: Promise<any>      = Promise.resolve(null);
    let requestsPromise: Promise<any>   = Promise.resolve(null);
    let evaluationPromise: Promise<any> = Promise.resolve(null);
    let jobsPromise: Promise<any>       = Promise.resolve(null);

    if (role === 'EMPLOYEE') {
      attendancePromise = this.fetch(serviceUrl('attendance'), token);
      leavePromise      = this.fetch(serviceUrl('leave'), token);
      requestsPromise   = this.fetch(serviceUrl('requests'), token);
      evaluationPromise = this.fetch(serviceUrl('evaluation'), token);
    } else if (role === 'MANAGER') {
      attendancePromise = this.fetch(serviceUrl('attendance'), token);
      leavePromise      = this.fetch(serviceUrl('leave'), token);
      requestsPromise   = this.fetch(serviceUrl('requests'), token);
      evaluationPromise = this.fetch(serviceUrl('evaluation'), token);
    } else if (role === 'HR') {
      attendancePromise = this.fetch(serviceUrl('attendance'), token);
      leavePromise      = this.fetch(serviceUrl('leave'), token);
      evaluationPromise = this.fetch(serviceUrl('evaluation'), token);
      jobsPromise       = this.fetch(serviceUrl('jobs'), token);
    } else if (role === 'CEO') {
      attendancePromise = this.fetch(serviceUrl('attendance'), token);
      leavePromise      = this.fetch(serviceUrl('leave'), token);
      requestsPromise   = this.fetch(serviceUrl('requests'), token);
      evaluationPromise = this.fetch(serviceUrl('evaluation'), token);
      jobsPromise       = this.fetch(serviceUrl('jobs'), token);
    } else if (role === 'CFO') {
      attendancePromise = this.fetch(serviceUrl('attendance'), token);
      leavePromise      = this.fetch(serviceUrl('leave'), token);
      requestsPromise   = this.fetch(serviceUrl('requests'), token);
    }

    const [usersData, attendanceData, leaveData, requestsData, evaluationData, jobsData] =
      await Promise.all([usersPromise, attendancePromise, leavePromise, requestsPromise, evaluationPromise, jobsPromise]);

    return {
      role,
      ...(usersData      || {}),
      ...(attendanceData || {}),
      ...(leaveData      || {}),
      ...(requestsData   || {}),
      ...(evaluationData || {}),
      ...(jobsData       || {}),
    };
  }
}
