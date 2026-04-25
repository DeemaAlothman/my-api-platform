import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardDataController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('data')
  async getData(@Req() req: Request, @Query('role') role: string) {
    const userId: string = (req as any).user?.userId;

    const employee = await this.prisma.employee.findFirst({
      where: { userId, deletedAt: null },
      include: {
        department: { select: { id: true, nameAr: true, nameEn: true } },
        jobTitle: { select: { id: true, nameAr: true, nameEn: true } },
      },
    });

    const notifications = await this.prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        titleAr: true,
        titleEn: true,
        messageAr: true,
        messageEn: true,
        type: true,
        createdAt: true,
      },
    });

    const employeeProfile = employee
      ? {
          id: employee.id,
          employeeNumber: employee.employeeNumber,
          firstNameAr: employee.firstNameAr,
          lastNameAr: employee.lastNameAr,
          firstNameEn: employee.firstNameEn,
          lastNameEn: employee.lastNameEn,
          profilePhoto: employee.profilePhoto,
          department: employee.department,
          jobTitle: employee.jobTitle,
          employmentStatus: employee.employmentStatus,
        }
      : null;

    if (role === 'EMPLOYEE') {
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const expiringDocuments = employee
        ? await this.prisma.employeeDocument.findMany({
            where: {
              employeeId: employee.id,
              expiryDate: { lte: thirtyDaysFromNow, gte: new Date() },
              deletedAt: null,
            },
            select: {
              id: true,
              titleAr: true,
              titleEn: true,
              expiryDate: true,
              type: true,
            },
          })
        : [];

      return { employee: employeeProfile, notifications, expiringDocuments };
    }

    if (role === 'MANAGER') {
      const subordinates = employee
        ? await this.prisma.employee.findMany({
            where: { managerId: employee.id, deletedAt: null },
            select: {
              id: true,
              firstNameAr: true,
              lastNameAr: true,
              firstNameEn: true,
              lastNameEn: true,
              profilePhoto: true,
              employmentStatus: true,
            },
          })
        : [];

      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const teamAlerts = subordinates.length
        ? await this.prisma.employeeDocument.findMany({
            where: {
              employeeId: { in: subordinates.map((s) => s.id) },
              expiryDate: { lte: thirtyDaysFromNow, gte: new Date() },
              deletedAt: null,
            },
            select: {
              id: true,
              employeeId: true,
              titleAr: true,
              expiryDate: true,
            },
          })
        : [];

      return {
        employee: employeeProfile,
        notifications,
        team: subordinates,
        teamAlerts,
      };
    }

    if (role === 'HR') {
      const totalEmployees = await this.prisma.employee.count({
        where: { deletedAt: null, employmentStatus: 'ACTIVE' },
      });

      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const expiringDocs = await this.prisma.employeeDocument.count({
        where: {
          expiryDate: { lte: thirtyDaysFromNow, gte: new Date() },
          deletedAt: null,
        },
      });

      const expiringContracts = await this.prisma.employee.count({
        where: {
          contractEndDate: { lte: thirtyDaysFromNow, gte: new Date() },
          deletedAt: null,
        },
      });

      return {
        employee: employeeProfile,
        notifications,
        totalEmployees,
        expiringDocsCount: expiringDocs,
        expiringContractsCount: expiringContracts,
      };
    }

    if (role === 'CEO') {
      return { employee: employeeProfile, notifications };
    }

    if (role === 'CFO') {
      const allowances = employee
        ? await this.prisma.employeeAllowance.findMany({
            where: { employeeId: employee.id },
            select: { type: true, amount: true },
          })
        : [];
      const allowancesTotal = allowances.reduce(
        (sum, a) => sum + Number(a.amount),
        0,
      );
      return {
        employee: employeeProfile,
        notifications,
        allowances,
        allowancesTotal,
      };
    }

    // GENERAL_MANAGER
    const totalEmployees = await this.prisma.employee.count({
      where: { deletedAt: null, employmentStatus: 'ACTIVE' },
    });

    const firstDayOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );
    const newEmployeesThisMonth = await this.prisma.employee.count({
      where: { hireDate: { gte: firstDayOfMonth }, deletedAt: null },
    });

    const deptDistribution = await this.prisma.department.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        _count: { select: { employees: { where: { deletedAt: null } } } },
      },
    });

    return {
      employee: employeeProfile,
      notifications,
      totalEmployees,
      newEmployeesThisMonth,
      departmentDistribution: deptDistribution,
    };
  }
}
