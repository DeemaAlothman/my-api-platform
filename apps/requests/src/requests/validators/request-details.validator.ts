import { BadRequestException } from '@nestjs/common';

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
      const effectiveDate = new Date(details.effectiveDate);
      const minDate = new Date();
      minDate.setDate(minDate.getDate() + 30);
      if (effectiveDate < minDate) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Resignation effective date must be at least 30 days from today',
          details: [{ field: 'effectiveDate' }],
        });
      }
      break;
    }

    case 'TRANSFER': {
      requireFields(details, ['currentDepartmentId', 'currentJobTitleId', 'newDepartmentId', 'newJobTitleId'], 'TRANSFER');
      break;
    }

    case 'PENALTY_PROPOSAL': {
      requireFields(details, ['targetEmployeeId', 'targetJobTitle', 'violationDescription'], 'PENALTY_PROPOSAL');
      break;
    }

    case 'OVERTIME_EMPLOYEE': {
      requireFields(details, ['overtimeDate', 'startTime', 'endTime', 'totalHours', 'tasks'], 'OVERTIME_EMPLOYEE');
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
      break;
    }

    case 'OVERTIME_MANAGER': {
      requireFields(details, ['overtimeDate', 'startTime', 'endTime', 'totalHours', 'purpose'], 'OVERTIME_MANAGER');
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
      break;
    }

    case 'BUSINESS_MISSION': {
      requireFields(details, ['missionType', 'startDate', 'endDate', 'totalDays', 'destination', 'missionReason'], 'BUSINESS_MISSION');
      if (!['INTERNAL', 'EXTERNAL'].includes(details.missionType)) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: "missionType must be 'INTERNAL' or 'EXTERNAL'",
          details: [{ field: 'missionType' }],
        });
      }
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
        const missing = ['employeeId', 'rewardType', 'amount', 'reason'].filter(
          f => emp[f] === undefined || emp[f] === null || emp[f] === '',
        );
        if (missing.length > 0) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: `Employee[${i}] missing required fields: ${missing.join(', ')}`,
            details: missing.map(f => ({ field: `employees[${i}].${f}` })),
          });
        }
      });
      break;
    }

    case 'COMPLAINT': {
      requireFields(details, ['complaintDescription'], 'COMPLAINT');
      break;
    }

    // Types with no special validation — reason field in base request is sufficient
    default:
      break;
  }
}
