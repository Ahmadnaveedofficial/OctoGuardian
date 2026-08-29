import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AuditLog,
  AuditLogDocument,
  AuditStatus,
} from './schemas/audit-log.schema';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  async logAction(params: {
    userId: string;
    toolName: string;
    action: string;
    repository?: string;
    parameters: Record<string, unknown>;
    status: AuditStatus;
    failureReason?: string;
    executionTimeMs?: number;
    ipAddress: string;
  }): Promise<AuditLogDocument> {
    const log = await this.auditLogModel.create({
      ...params,
      userId: new Types.ObjectId(params.userId),
    });

    this.logger.log(
      `[Audit] Tool: ${params.toolName} | Status: ${params.status} | User: ${params.userId}`,
    );
    return log;
  }

  async getLogsByUser(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const userObjectId = new Types.ObjectId(userId);

    const [logs, total] = await Promise.all([
      this.auditLogModel
        .find({ userId: userObjectId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.auditLogModel.countDocuments({ userId: userObjectId }),
    ]);

    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAuditStats(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const logs = await this.auditLogModel.find({ userId: userObjectId }).exec();

    const total = logs.length;
    const successful = logs.filter(
      (l) => l.status === AuditStatus.SUCCESS,
    ).length;
    const failed = logs.filter((l) => l.status === AuditStatus.FAILED).length;
    const pending = logs.filter(
      (l) => l.status === AuditStatus.PENDING_CONFIRMATION,
    ).length;

    const totalTime = logs.reduce(
      (acc, l) => acc + (l.executionTimeMs || 0),
      0,
    );
    const avgExecutionTimeMs = total > 0 ? Math.round(totalTime / total) : 0;

    return {
      totalActions: total,
      successful,
      failed,
      pendingConfirmation: pending,
      avgExecutionTimeMs,
    };
  }
}
