export class UpdateLeaveRequestDto {
  leaveTypeId?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
  isHalfDay?: boolean;
  halfDayPeriod?: 'MORNING' | 'AFTERNOON';
  substituteId?: string;
  contactDuring?: string;
}
