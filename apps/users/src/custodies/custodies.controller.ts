import {
  Controller, Get, Post, Put, Delete, Patch,
  Body, Param, Query, UseGuards, Req,
} from '@nestjs/common';
import { CustodiesService } from './custodies.service';
import { CreateCustodyDto } from './dto/create-custody.dto';
import { UpdateCustodyDto } from './dto/update-custody.dto';
import { ReturnCustodyDto } from './dto/return-custody.dto';
import { TransferCustodyDto } from './dto/transfer-custody.dto';
import { ListCustodiesQueryDto } from './dto/list-custodies.query.dto';
import { JwtAuthGuard } from '@shared/auth';
import { PermissionsGuard } from '@shared';
import { Permission } from '@shared';

@Controller('custodies')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CustodiesController {
  constructor(private readonly custodiesService: CustodiesService) {}

  @Post()
  @Permission('custodies:create')
  create(@Body() dto: CreateCustodyDto, @Req() req: any) {
    return this.custodiesService.create(dto, req.user.sub);
  }

  @Get()
  @Permission('custodies:read')
  findAll(@Query() query: ListCustodiesQueryDto) {
    return this.custodiesService.findAll(query);
  }

  // مهم: routes الثابتة قبل :id
  @Get('my')
  @Permission('custodies:read_own')
  getMyCustodies(@Req() req: any) {
    return this.custodiesService.findMyCustodies(req.user.username);
  }

  @Get('employee/:employeeId/summary')
  @Permission('custodies:read')
  getSummary(@Param('employeeId') employeeId: string) {
    return this.custodiesService.getEmployeeCustodySummary(employeeId);
  }

  @Get('employee/:employeeId/check')
  @Permission('custodies:read')
  checkUnreturned(@Param('employeeId') employeeId: string) {
    return this.custodiesService.hasUnreturnedCustodies(employeeId).then(
      (hasUnreturned) => ({ hasUnreturned }),
    );
  }

  @Get('employee/:employeeId')
  @Permission('custodies:read')
  findByEmployee(@Param('employeeId') employeeId: string) {
    return this.custodiesService.findByEmployee(employeeId);
  }

  @Get(':id')
  @Permission('custodies:read')
  findOne(@Param('id') id: string) {
    return this.custodiesService.findOne(id);
  }

  @Put(':id')
  @Permission('custodies:update')
  update(@Param('id') id: string, @Body() dto: UpdateCustodyDto) {
    return this.custodiesService.update(id, dto);
  }

  @Patch(':id/return')
  @Permission('custodies:update')
  returnCustody(@Param('id') id: string, @Body() dto: ReturnCustodyDto) {
    return this.custodiesService.returnCustody(id, dto);
  }

  // نقل العهدة لموظف جديد — يحفظ تاريخ الاستلام من القديم وتاريخ التسليم للجديد بسجل تاريخي
  @Patch(':id/transfer')
  @Permission('custodies:update')
  transferCustody(@Param('id') id: string, @Body() dto: TransferCustodyDto, @Req() req: any) {
    return this.custodiesService.transferCustody(id, dto, req.user.sub);
  }

  @Get(':id/transfers')
  @Permission('custodies:read')
  getTransferHistory(@Param('id') id: string) {
    return this.custodiesService.getTransferHistory(id);
  }

  @Delete(':id')
  @Permission('custodies:delete')
  remove(@Param('id') id: string) {
    return this.custodiesService.remove(id);
  }
}
