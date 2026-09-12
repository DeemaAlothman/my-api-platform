import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ErpClientService } from '../integrations/erp-client.service';
import { CreateRatingDto, ListRatingsQueryDto } from './dto/rating.dto';

@Injectable()
export class RatingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly erp: ErpClientService,
  ) {}

  // تقييم واحد لكل جلسة، ويظهر فقط بعد انتهاء الجلسة الفعلي (بند 12/17 بالتوصيف)
  async create(erpPatientId: string, patientAccountId: string, erpSessionId: string, dto: CreateRatingDto) {
    const session = await this.erp.getSession(erpSessionId);
    if (!session.exists) throw new NotFoundException({ code: 'SESSION_NOT_FOUND', message: 'الجلسة غير موجودة' });
    if (session.patientId !== erpPatientId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'هذه الجلسة ليست لك' });
    }
    if (!session.attendanceConfirmed) {
      throw new BadRequestException({ code: 'SESSION_NOT_COMPLETED', message: 'لا يمكن تقييم جلسة لم تنتهِ بعد' });
    }

    const existing = await this.prisma.therapistRating.findUnique({ where: { erpSessionId } });
    if (existing) throw new ConflictException({ code: 'RATING_ALREADY_EXISTS', message: 'تم تقييم هذه الجلسة مسبقاً' });

    return this.prisma.therapistRating.create({
      data: {
        erpSessionId,
        erpPatientId,
        erpTherapistId: session.physiotherapistId ?? '',
        patientAccountId,
        score: dto.score,
        privateNote: dto.privateNote,
      },
    });
  }

  // للداشبورد — حصراً لرئيس قسم الفيزيو (VIEW_THERAPIST_RATINGS)، مع تسجيل audit صريح للوصول
  async list(query: ListRatingsQueryDto, viewerUserId: string, viewerUsername: string, ip: string | null) {
    const ratings = await this.prisma.therapistRating.findMany({
      where: {
        ...(query.erpTherapistId ? { erpTherapistId: query.erpTherapistId } : {}),
        ...(query.erpPatientId ? { erpPatientId: query.erpPatientId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    // audit صريح — الـinterceptor العام يتجاهل GET، وهذا مورد حساس جداً حسب التوصيف (بند 12/18)
    await this.prisma.$executeRaw`
      INSERT INTO public.audit_logs ("userId", username, action, resource, "resourceId", method, path, ip, metadata, "createdAt")
      VALUES (${viewerUserId}, ${viewerUsername}, 'VIEW_THERAPIST_RATINGS', 'therapist_ratings', NULL, 'GET', '/api/v1/patient-app/admin/ratings', ${ip}, ${JSON.stringify({ resultCount: ratings.length, filters: query })}::jsonb, NOW())
    `.catch(() => {});

    return ratings;
  }
}
