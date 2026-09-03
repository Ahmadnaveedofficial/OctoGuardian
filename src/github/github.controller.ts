import { Controller, Get, Query, Res, UseGuards, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Response, Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User, UserDocument } from '../users/schemas/user.schema';
import { GitHubService } from './github.service';

@ApiTags('GitHub App Integration')
@Controller('github')
export class GitHubController {
  constructor(
    private readonly gitHubService: GitHubService,
    private readonly configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  @ApiOperation({
    summary: 'Get GitHub App connection installation URL for current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns installation URL with state',
  })
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Get('install-url')
  getInstallUrl(@Req() req: Request & { user?: Record<string, unknown> }) {
    const userPayload = req.user || {};
    const userId =
      userPayload.userId ||
      userPayload._id ||
      userPayload.id ||
      userPayload.sub;

    const appName =
      this.configService.get<string>('GITHUB_APP_NAME') || 'octoguardian';
    const installUrl = `https://github.com/apps/${appName}/installations/new?state=${String(userId)}`;

    return {
      success: true,
      statusCode: 200,
      data: {
        installUrl,
      },
    };
  }

  @ApiOperation({
    summary: 'OAuth/App installation callback invoked by GitHub',
  })
  @Get('callback')
  async handleCallback(
    @Query('installation_id') installationId: string,
    @Query('setup_action') setupAction: string,
    @Query('state') stateUserId: string,
    @Res() res: Response,
  ) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    if (!installationId || !stateUserId) {
      return res.redirect(
        `${frontendUrl}/dashboard?error=missing_installation_parameters`,
      );
    }

    try {
      await this.userModel.findByIdAndUpdate(stateUserId, {
        githubInstallationId: Number(installationId),
      });

      return res.redirect(`${frontendUrl}/dashboard?github_connected=true`);
    } catch {
      return res.redirect(
        `${frontendUrl}/dashboard?error=failed_to_save_installation`,
      );
    }
  }

  @ApiOperation({ summary: 'Get current user GitHub connection status' })
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getStatus(@Req() req: Request & { user?: Record<string, unknown> }) {
    const userPayload = req.user || {};
    const userId =
      userPayload.userId ||
      userPayload._id ||
      userPayload.id ||
      userPayload.sub;

    const user = await this.userModel.findById(userId).exec();

    return {
      success: true,
      statusCode: 200,
      data: {
        isConnected: Boolean(user?.githubInstallationId),
        installationId: user?.githubInstallationId || null,
      },
    };
  }
}
