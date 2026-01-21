export class CreateLeaveRequestDto {
  leaveTypeId: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  reason?: string;
  isHalfDay?: boolean;
  halfDayPeriod?: 'MORNING' | 'AFTERNOON';
  substituteId?: string;
  contactDuring?: string;
}
