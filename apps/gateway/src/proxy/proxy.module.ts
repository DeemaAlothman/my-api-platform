import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProxyService } from './proxy.service';
import {
  AuthProxyController,
  UsersProxyController,
  EmployeesProxyController,
  DepartmentsProxyController,
  RolesProxyController,
  PermissionsProxyController,
  LeaveRequestsProxyController,
  LeaveBalancesProxyController,
  LeaveTypesProxyController,
  HolidaysProxyController,
  WorkSchedulesProxyController,
  AttendanceRecordsProxyController,
  AttendanceAlertsProxyController,
  EvaluationPeriodsProxyController,
  EvaluationCriteriaProxyController,
  EvaluationFormsProxyController,
  PeerEvaluationsProxyController,
  EmployeeGoalsProxyController,
} from './proxy.controller';

@Module({
  imports: [HttpModule],
  controllers: [
    AuthProxyController,
    UsersProxyController,
    EmployeesProxyController,
    DepartmentsProxyController,
    RolesProxyController,
    PermissionsProxyController,
    LeaveRequestsProxyController,
    LeaveBalancesProxyController,
    LeaveTypesProxyController,
    HolidaysProxyController,
    WorkSchedulesProxyController,
    AttendanceRecordsProxyController,
    AttendanceAlertsProxyController,
    EvaluationPeriodsProxyController,
    EvaluationCriteriaProxyController,
    EvaluationFormsProxyController,
    PeerEvaluationsProxyController,
    EmployeeGoalsProxyController,
  ],
  providers: [ProxyService],
})
export class ProxyModule {}
