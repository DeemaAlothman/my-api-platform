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
