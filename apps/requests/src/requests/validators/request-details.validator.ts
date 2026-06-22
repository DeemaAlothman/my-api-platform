import { BadRequestException } from '@nestjs/common';

function calcDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
}

function calcHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const diff = endMinutes > startMinutes ? endMinutes - startMinutes : (24 * 60) - startMinutes + endMinutes;
  return Math.round((diff / 60) * 100) / 100;
}

function requireFields(details: any, fields: string[], typeName: string) {
  if (!details || typeof details !== 'object') {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `Request of type ${typeName} requires a 'details' object`,
      details: [],
    });
  }
  const missing = fields.filter(f => details[f] === undefined || details[f] === null || details[f] === '');
  if (missing.length > 0) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `Missing required fields for ${typeName}: ${missing.join(', ')}`,
      details: missing.map(f => ({ field: f })),
    });
  }
}

export function validateRequestDetails(type: string, details: any): void {
  switch (type) {

    case 'RESIGNATION': {
      requireFields(details, ['effectiveDate', 'reasons'], 'RESIGNATION');
      // أُزيل قيد «تاريخ النفاذ بعد 30 يوم» — يُقبل أي تاريخ نفاذ
      break;
    }

    case 'TRANSFER': {
      requireFields(details, ['currentDepartmentId', 'currentJobTitleId', 'newDepartmentId', 'newJobTitleId'], 'TRANSFER');
      break;
    }

    case 'PENALTY_PROPOSAL': {
      requireFields(details, ['targetEmployeeId', 'targetJobTitle', 'violationDescription', 'category'], 'PENALTY_PROPOSAL');

      if (!['MATERIAL', 'MORAL'].includes(details.category)) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: "category must be 'MATERIAL' or 'MORAL'",
          details: [{ field: 'category' }],
        });
      }

      const moralTypes = ['NOTICE', 'WARNING_1', 'WARNING_2'];
      if (details.category === 'MORAL') {
        if (!moralTypes.includes(details.penaltyType)) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: `penaltyType for MORAL penalty must be one of: ${moralTypes.join(', ')}`,
            details: [{ field: 'penaltyType' }],
          });
        }
      }

      if (details.category === 'MATERIAL') {
        if (details.penaltyType !== 'DAYS_DEDUCTION') {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: "penaltyType for MATERIAL penalty must be 'DAYS_DEDUCTION'",
            details: [{ field: 'penaltyType' }],
          });
        }
        const days = Number(details.penaltyDays);
        if (!details.penaltyDays || isNaN(days) || days <= 0 || (days * 2) % 1 !== 0) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: 'penaltyDays is required for MATERIAL penalty, must be > 0 and in increments of 0.5',
            details: [{ field: 'penaltyDays' }],
          });
        }
      }
      break;
    }

    case 'OVERTIME_EMPLOYEE': {
      requireFields(details, ['overtimeDate', 'startTime', 'endTime', 'tasks'], 'OVERTIME_EMPLOYEE');
      const overtimeDate = new Date(details.overtimeDate);
      const today = new Date();
      const isSameDay =
        overtimeDate.getFullYear() === today.getFullYear() &&
        overtimeDate.getMonth() === today.getMonth() &&
        overtimeDate.getDate() === today.getDate();
      if (isSameDay && today.getHours() >= 12) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Overtime requests for today cannot be submitted after 12:00 PM',
          details: [{ field: 'overtimeDate' }],
        });
      }
      details.totalHours = calcHours(details.startTime, details.endTime);
      break;
    }

    case 'OVERTIME_MANAGER': {
      requireFields(details, ['startDate', 'endDate', 'startTime', 'endTime', 'purpose'], 'OVERTIME_MANAGER');
      if (!Array.isArray(details.employeeIds) || details.employeeIds.length === 0) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'OVERTIME_MANAGER requires at least one employee in employeeIds',
          details: [{ field: 'employeeIds' }],
        });
      }
      details.totalDays = calcDays(details.startDate, details.endDate);
      details.totalHours = calcHours(details.startTime, details.endTime);
      break;
    }

    case 'BUSINESS_MISSION': {
      requireFields(details, ['missionType', 'startDate', 'endDate', 'destination', 'missionReason'], 'BUSINESS_MISSION');
      if (!['INTERNAL', 'EXTERNAL'].includes(details.missionType)) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: "missionType must be 'INTERNAL' or 'EXTERNAL'",
          details: [{ field: 'missionType' }],
        });
      }
      details.totalDays = calcDays(details.startDate, details.endDate);
      break;
    }

    case 'DELEGATION': {
      requireFields(details, ['delegationType', 'startDate', 'endDate', 'delegateEmployeeId', 'delegateJobTitle'], 'DELEGATION');
      if (!['FULL', 'PARTIAL'].includes(details.delegationType)) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: "delegationType must be 'FULL' or 'PARTIAL'",
          details: [{ field: 'delegationType' }],
        });
      }
      break;
    }

    case 'HIRING_REQUEST': {
      if (!details?.positions || !Array.isArray(details.positions) || details.positions.length === 0) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'HIRING_REQUEST requires at least one position in details.positions',
          details: [],
        });
      }
      if (details.positions.length > 10) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Maximum 10 positions per hiring request',
          details: [],
        });
      }
      details.positions.forEach((pos: any, i: number) => {
        const missing = ['departmentId', 'jobTitle', 'count', 'reason'].filter(
          f => pos[f] === undefined || pos[f] === null || pos[f] === '',
        );
        if (missing.length > 0) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: `Position[${i}] missing required fields: ${missing.join(', ')}`,
            details: missing.map(f => ({ field: `positions[${i}].${f}` })),
          });
        }
      });
      break;
    }

    case 'REWARD': {
      if (!details?.employees || !Array.isArray(details.employees) || details.employees.length === 0) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'REWARD requires at least one employee in details.employees',
          details: [],
        });
      }
      if (details.employees.length > 10) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Maximum 10 employees per reward request',
          details: [],
        });
      }
      details.employees.forEach((emp: any, i: number) => {
        const alwaysRequired = ['employeeId', 'rewardType', 'reason', 'category'];
        const missing = alwaysRequired.filter(
          f => emp[f] === undefined || emp[f] === null || emp[f] === '',
        );
        if (missing.length > 0) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: `Employee[${i}] missing required fields: ${missing.join(', ')}`,
            details: missing.map(f => ({ field: `employees[${i}].${f}` })),
          });
        }
        if (!['MATERIAL', 'MORAL'].includes(emp.category)) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: `Employee[${i}] category must be 'MATERIAL' or 'MORAL'`,
            details: [{ field: `employees[${i}].category` }],
          });
        }
        if (emp.category === 'MATERIAL') {
          const amt = Number(emp.amount);
          if (!emp.amount || isNaN(amt) || amt <= 0) {
            throw new BadRequestException({
              code: 'VALIDATION_ERROR',
              message: `Employee[${i}] amount is required and must be > 0 for MATERIAL reward`,
              details: [{ field: `employees[${i}].amount` }],
            });
          }
        }
      });
      break;
    }

    case 'COMPLAINT': {
      requireFields(details, ['complaintDescription'], 'COMPLAINT');
      break;
    }

    case 'REMOTE_WORK': {
      requireFields(details, ['startDate', 'endDate'], 'REMOTE_WORK');
      if (new Date(details.endDate) < new Date(details.startDate)) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'endDate must be after startDate',
          details: [{ field: 'endDate' }],
        });
      }
      break;
    }

    // Types with no special validation — reason field in base request is sufficient
    default:
      break;
  }
}
