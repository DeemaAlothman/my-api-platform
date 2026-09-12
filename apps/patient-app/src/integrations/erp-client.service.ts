import { Injectable } from '@nestjs/common';

const PATIENTS_URL = process.env.PATIENTS_SERVICE_URL || 'http://patients:4010';
const PHYSIO_URL = process.env.CLINICAL_PHYSIO_SERVICE_URL || 'http://clinical-physio:4012';
const APPOINTMENTS_URL = process.env.APPOINTMENTS_SERVICE_URL || 'http://appointments:4013';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

export interface ErpSessionSummary {
  id: string;
  caseId: string;
  sessionNumber: number | null;
  sessionDate: string;
  attendanceConfirmed: boolean;
  physiotherapistId: string | null;
  appointmentId: string | null;
}

export interface ErpAppointment {
  id: string;
  appointmentType: string;
  startTime: string;
  endTime: string;
  status: string;
  physiotherapistId: string | null;
  practitionerId: string;
  notes: string | null;
}

export interface ErpPatientSummary {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  phone?: string;
  gender?: string;
  idNumber?: string | null;
}

export interface ErpPhysioSession {
  exists: boolean;
  id?: string;
  caseId?: string;
  patientId?: string;
  physiotherapistId?: string | null;
  sessionNumber?: number | null;
  sessionDate?: string;
  attendanceConfirmed?: boolean;
  appointmentId?: string | null;
  caseStatus?: string;
}

// عميل داخلي (خدمة-لخدمة) للتواصل مع خدمات ERP الموجودة (patients, clinical-physio)
// بنفس نمط x-internal-token المستخدم فعلاً بين كل الخدمات الحالية.
@Injectable()
export class ErpClientService {
  async patientExists(erpPatientId: string): Promise<boolean> {
    try {
      const res = await fetch(`${PATIENTS_URL}/api/v1/patients/internal/${erpPatientId}/exists`, {
        headers: { 'x-internal-token': INTERNAL_TOKEN },
      });
      if (!res.ok) return false;
      const json: any = await res.json();
      return !!(json?.data?.exists ?? json?.exists);
    } catch {
      return false;
    }
  }

  async findPatientsByIds(ids: string[]): Promise<Record<string, ErpPatientSummary>> {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (uniqueIds.length === 0) return {};
    try {
      const res = await fetch(`${PATIENTS_URL}/api/v1/patients/internal/find-by-ids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-token': INTERNAL_TOKEN },
        body: JSON.stringify({ patientIds: uniqueIds }),
      });
      if (!res.ok) return {};
      const json: any = await res.json();
      const list: any[] = Array.isArray(json) ? json : (json?.data ?? []);
      const map: Record<string, ErpPatientSummary> = {};
      for (const p of list) if (p?.id) map[p.id] = p;
      return map;
    } catch {
      return {};
    }
  }

  async findPatientsByPhone(phone: string): Promise<ErpPatientSummary[]> {
    try {
      const res = await fetch(`${PATIENTS_URL}/api/v1/patients/internal/find-by-phone?phone=${encodeURIComponent(phone)}`, {
        headers: { 'x-internal-token': INTERNAL_TOKEN },
      });
      if (!res.ok) return [];
      const json: any = await res.json();
      return Array.isArray(json) ? json : (json?.data ?? []);
    } catch {
      return [];
    }
  }

  async getSession(erpSessionId: string): Promise<ErpPhysioSession> {
    try {
      const res = await fetch(`${PHYSIO_URL}/api/v1/physio/cases/internal/sessions/${erpSessionId}`, {
        headers: { 'x-internal-token': INTERNAL_TOKEN },
      });
      if (!res.ok) return { exists: false };
      const json: any = await res.json();
      return (json?.data ?? json) as ErpPhysioSession;
    } catch {
      return { exists: false };
    }
  }

  // المعالج المسؤول الحالي عن المريض — المريض لا يختار معالجه يدوياً (بند 11 بالتوصيف)
  async getResponsibleTherapist(erpPatientId: string): Promise<{ exists: boolean; erpTherapistId?: string; caseId?: string }> {
    try {
      const res = await fetch(`${PHYSIO_URL}/api/v1/physio/cases/internal/patient/${erpPatientId}/responsible-therapist`, {
        headers: { 'x-internal-token': INTERNAL_TOKEN },
      });
      if (!res.ok) return { exists: false };
      const json: any = await res.json();
      return (json?.data ?? json) as { exists: boolean; erpTherapistId?: string; caseId?: string };
    } catch {
      return { exists: false };
    }
  }

  // كل جلسات المريض عبر حالاته الفيزيائية — لعرضها بالداشبورد عند إسناد تمرين (بند 6/15 بالتوصيف)
  async getPatientSessions(erpPatientId: string): Promise<ErpSessionSummary[]> {
    try {
      const res = await fetch(`${PHYSIO_URL}/api/v1/physio/cases/internal/patient/${erpPatientId}/sessions`, {
        headers: { 'x-internal-token': INTERNAL_TOKEN },
      });
      if (!res.ok) return [];
      const json: any = await res.json();
      return Array.isArray(json) ? json : (json?.data ?? []);
    } catch {
      return [];
    }
  }

  // مواعيد المريض القادمة/الحديثة — لعرضها بالتطبيق (بند 9/15 بالتوصيف)
  async getPatientAppointments(erpPatientId: string): Promise<ErpAppointment[]> {
    try {
      const res = await fetch(`${APPOINTMENTS_URL}/api/v1/appointments/internal/patient/${erpPatientId}`, {
        headers: { 'x-internal-token': INTERNAL_TOKEN },
      });
      if (!res.ok) return [];
      const json: any = await res.json();
      return Array.isArray(json) ? json : (json?.data ?? []);
    } catch {
      return [];
    }
  }
}
