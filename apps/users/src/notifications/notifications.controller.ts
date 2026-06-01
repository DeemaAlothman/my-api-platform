import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, Request, ParseIntPipe, DefaultValuePipe,
  Headers, UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get()
  @ApiOperation({ summary: 'Get my notifications' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  findAll(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.service.findAll(req.user.userId, page, limit, unreadOnly === 'true');
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notifications count' })
  getUnreadCount(@Request() req) {
    return this.service.getUnreadCount(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markAsRead(@Param('id') id: string, @Request() req) {
    return this.service.markAsRead(id, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllAsRead(@Request() req) {
    return this.service.markAllAsRead(req.user.userId);
  }

  // Internal endpoint — called by mail-service (no JWT, service-to-service token)
  @Post('internal')
  createInternal(
    @Headers('x-internal-token') token: string,
    @Body() dto: any,
  ) {
    if (!token || token !== process.env.INTERNAL_SERVICE_TOKEN) {
      throw new UnauthorizedException('Invalid internal token');
    }
    return this.service.create(dto);
  }
}
