export class ApproveLeaveRequestDto {
  notes?: string;
}

export class RejectLeaveRequestDto {
  notes: string; // إجباري عند الرفض
}
