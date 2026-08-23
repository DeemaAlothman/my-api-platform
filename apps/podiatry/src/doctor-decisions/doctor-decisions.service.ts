import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertDoctorDecisionDto } from './dto/doctor-decision.dto';

const USERS_URL       = process.env.USERS_SERVICE_URL    || 'http://users:4002';
const INTERNAL_TOKEN  = process.env.INTERNAL_SERVICE_TOKEN || '';
const DOCTOR_JOB_CODE = 'VTX-JTL-000007';

@Injectable()
export class DoctorDecisionsService {
  private readonly logger = new Logger(DoctorDecisionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async upsert(receptionId: string, dto: UpsertDoctorDecisionDto, userId: string) {
    const reception = await this.prisma.podiatryReception.findUnique({ where: { id: receptionId } });
    if (!reception) throw new NotFoundException('Reception not found');

    return this.prisma.podiatryDoctorDecision.upsert({
      where:  { receptionId },
      create: { receptionId, decision: dto.decision ?? null, createdBy: userId },
      update: { decision: dto.decision ?? null, updatedBy: userId },
    });
  }

  async findOne(receptionId: string) {
    const reception = await this.prisma.podiatryReception.findUnique({ where: { id: receptionId } });
    if (!reception) throw new NotFoundException('Reception not found');
    return this.prisma.podiatryDoctorDecision.findUnique({ where: { receptionId } });
  }

  async notifyDoctor(receptionId: string) {
    const reception = await this.prisma.podiatryReception.findUnique({ where: { id: receptionId } });
    if (!reception) throw new NotFoundException('Reception not found');

    // أوجد كل المستخدمين النشطين بالمسمى الوظيفي VTX-JTL-000007
    const doctors = await this.prisma.$queryRawUnsafe<Array<{ userId: string }>>(
      `SELECT DISTINCT u.id AS "userId"
       FROM users.users u
       JOIN users.employees e ON e."userId" = u.id
       JOIN users.job_titles jt ON jt.id = e."jobTitleId"
       WHERE jt.code = $1
         AND e."employmentStatus" = 'ACTIVE'
         AND e."deletedAt" IS NULL`,
      DOCTOR_JOB_CODE,
    );

    if (doctors.length === 0) {
      this.logger.warn(`No active users found with job title ${DOCTOR_JOB_CODE}`);
      return { notified: 0 };
    }

    let notified = 0;
    for (const doc of doctors) {
      try {
        const res = await fetch(`${USERS_URL}/api/v1/notifications/internal`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-token': INTERNAL_TOKEN,
          },
          body: JSON.stringify({
            userId:    doc.userId,
            type:      'GENERAL',
            titleAr:   'قرار طبي بانتظارك',
            titleEn:   'Doctor Decision Required',
            messageAr: 'يوجد قرار طبي يتطلب مراجعتك في عيادة طب الأقدام',
            messageEn: 'A doctor decision is awaiting your review in the podiatry clinic',
            data:      { receptionId },
          }),
        });
        if (res.ok) notified++;
      } catch (err) {
        this.logger.error(`Failed to notify userId ${doc.userId}: ${err}`);
      }
    }

    return { notified };
  }
}
