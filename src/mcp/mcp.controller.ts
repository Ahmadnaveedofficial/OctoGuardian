import {
  Controller,
  Post,
  Body,
  UseGuards,
  Ip,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GeminiService } from '../gemini/gemini.service';
import { PromptDto } from './dto/prompt.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';

@ApiTags('GitHubOps AI Engine')
@Controller('mcp')
export class McpController {
  constructor(private readonly geminiService: GeminiService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Send natural language instruction to Gemini for GitHub operations',
  })
  async handleChat(
    @CurrentUser() user: UserDocument,
    @Body() dto: PromptDto,
    @Ip() ipAddress: string,
  ) {
    return this.geminiService.processUserPrompt(
      dto.prompt,
      user._id.toString(),
      ipAddress,
    );
  }
}
