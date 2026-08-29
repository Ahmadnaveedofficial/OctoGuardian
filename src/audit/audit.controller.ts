import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user?: {
    userId?: string;
    sub?: string;
    id?: string;
  };
}

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('my-logs')
  @ApiOperation({ summary: 'Get current user audit logs with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  async getMyLogs(
    @Req() req: AuthenticatedRequest,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const userId = String(
      req.user?.userId || req.user?.sub || req.user?.id || '',
    );
    return await this.auditService.getLogsByUser(
      userId,
      Number(page),
      Number(limit),
    );
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get audit activity statistics for current user' })
  async getMyStats(@Req() req: AuthenticatedRequest) {
    const userId = String(
      req.user?.userId || req.user?.sub || req.user?.id || '',
    );
    return await this.auditService.getAuditStats(userId);
  }
}
