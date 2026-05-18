import { Controller, Post, UseGuards } from '@nestjs/common';
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
    await this.probationNotifier.run();
    return { success: true, message: 'Probation end notifier triggered' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('birthday-mailer')
  async triggerBirthday() {
    await this.birthdayMailer.run();
    return { success: true, message: 'Birthday mailer triggered' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('contract-notifier')
  async triggerContract() {
    await this.contractNotifier.run();
    return { success: true, message: 'Contract end notifier triggered' };
  }
}
