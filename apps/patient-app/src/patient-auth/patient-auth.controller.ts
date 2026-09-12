import { Body, Controller, Post } from '@nestjs/common';
import { PatientAuthService } from './patient-auth.service';
import { RegisterPatientDto } from './dto/register.dto';
import { LoginPatientDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh.dto';

@Controller('patient-app/auth')
export class PatientAuthController {
  constructor(private readonly service: PatientAuthService) {}

  @Post('register')
  register(@Body() dto: RegisterPatientDto) {
    return this.service.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginPatientDto) {
    return this.service.login(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.service.refresh(dto.refreshToken);
  }

  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.service.logout(dto.refreshToken);
  }
}
