import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { AddCommentDto } from './dto/reward.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { User } from '@shared/auth/decorators/current-user.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';

// مسار مختلف عن star-of-month/:year/:month عمداً (candidates/:id بدل :id مباشرة) — تفادي أي
// تضارب بالتوجيه مع مسار الدورة (year/month رقمين كمان)
@Controller('star-of-month/candidates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CommentsController {
  constructor(private readonly service: CommentsService) {}

  @Get(':candidateId/comments')
  @Permission(PERMISSIONS.STAR_OF_MONTH.VIEW)
  list(@Param('candidateId') candidateId: string) {
    return this.service.listComments(candidateId);
  }

  @Post(':candidateId/comments')
  @Permission(PERMISSIONS.STAR_OF_MONTH.VIEW)
  add(@Param('candidateId') candidateId: string, @Body() dto: AddCommentDto, @User() user: any) {
    return this.service.addComment(candidateId, dto, user.userId);
  }
}

@Controller('star-of-month/comments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CommentModerationController {
  constructor(private readonly service: CommentsService) {}

  @Delete(':commentId')
  @Permission(PERMISSIONS.STAR_OF_MONTH.MODERATE_COMMENTS)
  remove(@Param('commentId') commentId: string) {
    return this.service.deleteComment(commentId);
  }
}
