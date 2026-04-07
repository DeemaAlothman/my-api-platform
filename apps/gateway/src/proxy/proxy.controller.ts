import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ProxyService } from './proxy.service';

@Controller('auth')
export class AuthProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'auth');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'auth');
  }
}

@Controller('users')
export class UsersProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'users');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'users');
  }
}

@Controller('employees')
export class EmployeesProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'users');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'users');
  }
}

@Controller('departments')
export class DepartmentsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'users');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'users');
  }
}

@Controller('roles')
export class RolesProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'users');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'users');
  }
}

@Controller('permissions')
export class PermissionsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'users');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'users');
  }
}

@Controller('leave-requests')
export class LeaveRequestsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'leave');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'leave');
  }
}

@Controller('leave-balances')
export class LeaveBalancesProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'leave');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'leave');
  }
}

@Controller('leave-types')
export class LeaveTypesProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'leave');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'leave');
  }
}

@Controller('holidays')
export class HolidaysProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'leave');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'leave');
  }
}

@Controller('work-schedules')
export class WorkSchedulesProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'attendance');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'attendance');
  }
}

@Controller('attendance-records')
export class AttendanceRecordsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'attendance');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'attendance');
  }
}

@Controller('attendance-alerts')
export class AttendanceAlertsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'attendance');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'attendance');
  }
}

@Controller('attendance-justifications')
export class AttendanceJustificationsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'attendance');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'attendance');
  }
}

@Controller('employee-schedules')
export class EmployeeSchedulesProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'attendance');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'attendance');
  }
}

@Controller('evaluation-periods')
export class EvaluationPeriodsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'evaluation');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'evaluation');
  }
}

@Controller('evaluation-criteria')
export class EvaluationCriteriaProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'evaluation');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'evaluation');
  }
}

@Controller('evaluation-forms')
export class EvaluationFormsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'evaluation');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'evaluation');
  }
}

@Controller('peer-evaluations')
export class PeerEvaluationsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'evaluation');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'evaluation');
  }
}

@Controller('employee-goals')
export class EmployeeGoalsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'evaluation');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'evaluation');
  }
}

@Controller('job-titles')
export class JobTitlesProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'users');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'users');
  }
}

@Controller('job-grades')
export class JobGradesProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'users');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'users');
  }
}

@Controller('requests')
export class RequestsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'requests');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'requests');
  }
}

@Controller('attendance-reports')
export class AttendanceReportsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'attendance');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'attendance');
  }
}

@Controller('custodies')
export class CustodiesProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'users');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'users');
  }
}

@Controller('biometric-devices')
export class BiometricDevicesProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'zkteco');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'zkteco');
  }
}

@Controller('employee-fingerprints')
export class EmployeeFingerprintsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'zkteco');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'zkteco');
  }
}

@Controller('employee-attendance-config')
export class EmployeeAttendanceConfigProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'attendance');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'attendance');
  }
}

@Controller('iclock')
export class IclockProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'zkteco');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'zkteco');
  }
}

@Controller('interview-positions')
export class InterviewPositionsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'jobs');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'jobs');
  }
}

@Controller('interview-criteria')
export class InterviewCriteriaProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'jobs');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'jobs');
  }
}

@Controller('interview-evaluations')
export class InterviewEvaluationsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'jobs');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'jobs');
  }
}

@Controller('probation')
export class ProbationProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'evaluation');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'evaluation');
  }
}

@Controller('job-applications')
export class JobApplicationsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'jobs');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'jobs');
  }
}

@Controller('candidates')
export class CandidatesProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'jobs');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'jobs');
  }
}

@Controller('deduction-policies')
export class DeductionPoliciesProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'attendance');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'attendance');
  }
}

@Controller('payroll')
export class PayrollProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'attendance');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'attendance');
  }
}

@Controller('onboarding')
export class OnboardingProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'users');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'users');
  }
}

@Controller('notifications')
export class NotificationsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'users');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'users');
  }
}

@Controller('documents')
export class DocumentsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'users');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'users');
  }
}
