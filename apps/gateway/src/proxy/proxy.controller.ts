import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ProxyService } from './proxy.service';

@Controller('auth')
export class AuthProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*')
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

  @All('*')
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

  @All('*')
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

  @All('*')
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

  @All('*')
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

  @All('*')
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

  @All('*')
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

  @All('*')
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

  @All('*')
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

  @All('*')
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

  @All('*')
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

  @All('*')
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

  @All('*')
  forwardWithPath(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'attendance');
  }

  @All()
  forward(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res, 'attendance');
  }
}
