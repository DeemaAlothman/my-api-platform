import { Controller, Get, Post, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { CyclesService } from './cycles.service';
import { VotesService } from './votes.service';
import { RewardsService } from './rewards.service';
import { AddHrNomineeDto } from './dto/cycle.dto';
import { CastVoteDto, TieBreakDto } from './dto/vote.dto';
import { SetRewardDto, SetWinnerImageDto } from './dto/reward.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';
import { User } from '@shared/auth/decorators/current-user.decorator';
import { PERMISSIONS } from '@shared/constants/permissions.constants';

@Controller('star-of-month')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CyclesController {
  constructor(
    private readonly service: CyclesService,
    private readonly votes: VotesService,
    private readonly rewards: RewardsService,
  ) {}

  // نجوم الشهر الحالية للواجهة الرئيسية (آخر دورة مغلقة، كل الشركات)
  @Get('current')
  @Permission(PERMISSIONS.STAR_OF_MONTH.VIEW)
  getCurrent() {
    return this.rewards.getCurrent();
  }

  @Get(':year/:month')
  @Permission(PERMISSIONS.STAR_OF_MONTH.VIEW)
  getCycle(@Param('year', ParseIntPipe) year: number, @Param('month', ParseIntPipe) month: number) {
    return this.service.getCycle(year, month);
  }

  // توليد/إعادة توليد القائمة التلقائية — عادةً من cron يوم 1، ومتاح يدوياً هون كمان
  @Post(':year/:month/generate')
  @Permission(PERMISSIONS.STAR_OF_MONTH.NOMINATE)
  generate(@Param('year', ParseIntPipe) year: number, @Param('month', ParseIntPipe) month: number) {
    return this.service.generateCycle(year, month);
  }

  @Post(':year/:month/hr-nominee')
  @Permission(PERMISSIONS.STAR_OF_MONTH.NOMINATE)
  addHrNominee(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Body() dto: AddHrNomineeDto,
  ) {
    return this.service.addHrNominee(year, month, dto);
  }

  // فتح التصويت — عادةً يدوي من HR بعد إضافة مرشحها، 3 أيام تلقائياً من لحظة الفتح
  @Post(':year/:month/open-voting')
  @Permission(PERMISSIONS.STAR_OF_MONTH.NOMINATE)
  openVoting(@Param('year', ParseIntPipe) year: number, @Param('month', ParseIntPipe) month: number) {
    return this.votes.openVoting(year, month);
  }

  @Post(':year/:month/vote')
  @Permission(PERMISSIONS.STAR_OF_MONTH.VOTE)
  vote(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Body() dto: CastVoteDto,
    @User() user: any,
  ) {
    return this.votes.votePeer(year, month, dto, user.userId);
  }

  @Post(':year/:month/manager-vote')
  @Permission(PERMISSIONS.STAR_OF_MONTH.MANAGER_VOTE)
  managerVote(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Body() dto: CastVoteDto,
    @User() user: any,
  ) {
    return this.votes.voteManager(year, month, dto, user.userId);
  }

  @Post(':year/:month/ceo-vote')
  @Permission(PERMISSIONS.STAR_OF_MONTH.CEO_VOTE)
  ceoVote(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Body() dto: CastVoteDto,
    @User() user: any,
  ) {
    return this.votes.voteCeo(year, month, dto, user.userId);
  }

  @Get(':year/:month/my-vote')
  @Permission(PERMISSIONS.STAR_OF_MONTH.VOTE)
  myVote(@Param('year', ParseIntPipe) year: number, @Param('month', ParseIntPipe) month: number, @User() user: any) {
    return this.votes.getMyVotes(year, month, user.userId);
  }

  // إغلاق يدوي — عادةً تلقائي من cron بعد انتهاء مهلة الـ3 أيام
  @Post(':year/:month/close')
  @Permission(PERMISSIONS.STAR_OF_MONTH.NOMINATE)
  close(@Param('year', ParseIntPipe) year: number, @Param('month', ParseIntPipe) month: number) {
    return this.votes.closeVoting(year, month);
  }

  @Post(':year/:month/tie-break')
  @Permission(PERMISSIONS.STAR_OF_MONTH.CEO_VOTE)
  tieBreak(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Body() dto: TieBreakDto,
  ) {
    return this.votes.tieBreak(year, month, dto);
  }

  // اختيار نوع مكافأة الفائز — 50$ (افتراضي) أو إجازة مدفوعة بعدد أيام محدَّد
  @Post(':year/:month/reward')
  @Permission(PERMISSIONS.STAR_OF_MONTH.REWARD)
  setReward(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Body() dto: SetRewardDto,
    @User() user: any,
  ) {
    return this.rewards.setReward(year, month, dto, user.userId);
  }

  @Post(':year/:month/winner-image')
  @Permission(PERMISSIONS.STAR_OF_MONTH.REWARD)
  setWinnerImage(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Body() dto: SetWinnerImageDto,
  ) {
    return this.rewards.setWinnerImage(year, month, dto);
  }
}
