import { Controller, Post, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '@shared/auth';
import { ProbationEndNotifierService } from './probation-end-notifier.service';
import { BirthdayMailerService } from './birthday-mailer.service';
import { ContractEndNotifierService } from './contract-end-notifier.service';

@Controller('internal/trigger')
export class HrNotifiersTriggerController {
  constructor(
    private readonly probationNotifier: ProbationEndNotifierService,
    private readonly birthdayMailer: BirthdayMailerService,
    private readonly contractNotifier: ContractEndNotifierService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('probation-notifier')
  async triggerProbation() {
    try {
      await this.probationNotifier.run();
      return { success: true, message: 'Probation end notifier triggered' };
    } catch (err: any) {
      throw new HttpException({ message: err?.message, stack: err?.stack?.split('\n').slice(0, 5) }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('birthday-mailer')
  async triggerBirthday() {
    try {
      await this.birthdayMailer.run();
      return { success: true, message: 'Birthday mailer triggered' };
    } catch (err: any) {
      throw new HttpException({ message: err?.message, stack: err?.stack?.split('\n').slice(0, 5) }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('contract-notifier')
  async triggerContract() {
    try {
      await this.contractNotifier.run();
      return { success: true, message: 'Contract end notifier triggered' };
    } catch (err: any) {
      throw new HttpException({ message: err?.message, stack: err?.stack?.split('\n').slice(0, 5) }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
