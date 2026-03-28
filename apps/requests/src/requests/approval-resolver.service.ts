import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApprovalResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async getEmployeeIdByUserId(userId: string): Promise<string | null> {
    const result = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM users.employees WHERE "userId" = ${userId} AND "deletedAt" IS NULL LIMIT 1
    `;
    return result[0]?.id ?? null;
  }

  private async getEmployeeManagerId(employeeId: string): Promise<string | null> {
    const result = await this.prisma.$queryRaw<Array<{ managerId: string | null }>>`
      SELECT "managerId" FROM users.employees WHERE id = ${employeeId} AND "deletedAt" IS NULL LIMIT 1
    `;
    return result[0]?.managerId ?? null;
  }

  private async getDepartmentManagerId(departmentId: string): Promise<string | null> {
    const result = await this.prisma.$queryRaw<Array<{ managerId: string | null }>>`
      SELECT "managerId" FROM users.departments WHERE id = ${departmentId} AND "deletedAt" IS NULL LIMIT 1
    `;
    return result[0]?.managerId ?? null;
  }

  private async getEmployeeDeptManagerId(employeeId: string): Promise<string | null> {
    const result = await this.prisma.$queryRaw<Array<{ deptManagerId: string | null }>>`
      SELECT d."managerId" AS "deptManagerId"
      FROM users.employees e
      JOIN users.departments d ON e."departmentId" = d.id
      WHERE e.id = ${employeeId} AND e."deletedAt" IS NULL LIMIT 1
    `;
    return result[0]?.deptManagerId ?? null;
  }

  async hasPermission(userId: string, permissionName: string): Promise<boolean> {
    const result = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count
      FROM users.user_roles ur
      JOIN users.role_permissions rp ON rp."roleId" = ur."roleId"
      JOIN users.permissions p ON p.id = rp."permissionId"
      WHERE ur."userId" = ${userId} AND p.name = ${permissionName}
    `;
    return Number(result[0]?.count ?? 0) > 0;
  }

  async canApprove(
    approverUserId: string,
    requestEmployeeId: string,
    approverRole: string,
    requestDetails?: any,
  ): Promise<boolean> {
    const approverEmployeeId = await this.getEmployeeIdByUserId(approverUserId);
    if (!approverEmployeeId) return false;

    switch (approverRole) {
      case 'DIRECT_MANAGER': {
        const managerId = await this.getEmployeeManagerId(requestEmployeeId);
        if (managerId && managerId === approverEmployeeId) return true;
        // Direct manager OR HR can approve
        return this.hasPermission(approverUserId, 'requests:hr-approve');
      }
      case 'DEPARTMENT_MANAGER': {
        const deptManagerId = await this.getEmployeeDeptManagerId(requestEmployeeId);
        return deptManagerId === approverEmployeeId;
      }
      case 'TARGET_MANAGER': {
        const newDeptId = requestDetails?.newDepartmentId;
        if (!newDeptId) return false;
        const targetManagerId = await this.getDepartmentManagerId(newDeptId);
        return targetManagerId === approverEmployeeId;
      }
      case 'HR':
        return this.hasPermission(approverUserId, 'requests:hr-approve');
      case 'CEO':
        return this.hasPermission(approverUserId, 'requests:ceo-approve');
      case 'CFO':
        return this.hasPermission(approverUserId, 'requests:cfo-approve');
      default:
        return false;
    }
  }
}
