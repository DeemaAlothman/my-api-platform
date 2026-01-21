import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EmployeeHelper {
  constructor(private prisma: PrismaService) {}

  /**
   * Get employee ID from user ID
   * This is needed because the JWT contains userId but the leave system uses employeeId
   */
  async getEmployeeIdFromUserId(userId: string): Promise<string> {
    // First, try to find employee in the leave service's local users schema
    const employee = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM users.employees WHERE "userId" = ${userId}::text LIMIT 1
    `;

    if (employee && employee.length > 0) {
      return employee[0].id;
    }

    // If not found, the user might not be an employee
    throw new NotFoundException('Employee record not found for this user');
  }

  /**
   * Get employee ID from user ID, or return userId if employee not found
   * Use this for backward compatibility during migration
   */
  async getEmployeeIdFromUserIdOrDefault(userId: string): Promise<string> {
    try {
      return await this.getEmployeeIdFromUserId(userId);
    } catch {
      // Fallback to userId for backward compatibility
      return userId;
    }
  }
}
