import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import {
  PendingAction,
  PendingActionDocument,
} from './schemas/pending-action.schema';

@Injectable()
export class RiskEvaluatorService {
  private readonly dangerousTools = new Set([
    'delete_repository',
    'delete_branch',
    'delete_file',
  ]);

  constructor(
    @InjectModel(PendingAction.name)
    private readonly pendingActionModel: Model<PendingActionDocument>,
  ) {}

  isDangerous(toolName: string): boolean {
    return this.dangerousTools.has(toolName);
  }

  async createPendingAction(
    userId: string,
    toolName: string,
    payload: Record<string, any>,
  ) {
    const confirmationToken = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    await this.pendingActionModel.create({
      confirmationToken,
      userId: new Types.ObjectId(userId),
      toolName,
      payload,
      expiresAt,
    });

    return {
      status: 'CONFIRMATION_REQUIRED',
      message: `⚠️ DANGEROUS ACTION: You requested '${toolName}'. This cannot be easily undone.`,
      confirmationToken,
      expiresIn: '5 minutes',
      actionDetails: payload,
    };
  }

  async verifyAndConsumeToken(
    confirmationToken: string,
    userId: string,
  ): Promise<PendingActionDocument> {
    const action = await this.pendingActionModel.findOne({
      confirmationToken,
      userId: new Types.ObjectId(userId),
    });

    if (!action) {
      throw new BadRequestException('Invalid or expired confirmation token.');
    }

    await this.pendingActionModel.findByIdAndDelete(action._id);
    return action;
  }
}
