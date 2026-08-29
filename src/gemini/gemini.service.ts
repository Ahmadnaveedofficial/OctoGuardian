import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GoogleGenAI, type FunctionDeclaration } from '@google/genai';
import { McpService } from '../mcp/mcp.service';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class GeminiService {
  private readonly ai: GoogleGenAI;
  private readonly logger = new Logger(GeminiService.name);
  private readonly modelName = 'gemini-3.1-flash-lite';

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => McpService))
    private readonly mcpService: McpService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.ai = new GoogleGenAI({ apiKey: apiKey || '' });
  }

  async processUserPrompt(
    prompt: string,
    userId: string,
    ipAddress: string,
  ): Promise<{ response: string; executedTool?: string; rawData?: unknown }> {
    const user = await this.userModel.findById(userId).exec();
    const installationId = user?.githubInstallationId;

    const availableTools = this.mcpService.getAvailableTools();
    const functionDeclarations =
      availableTools as unknown as FunctionDeclaration[];

    const contents: any[] = [{ role: 'user', parts: [{ text: prompt }] }];
    let lastExecutedTool: string | undefined;
    let lastToolResult: unknown;
    const maxTurns = 5;

    try {
      for (let turn = 0; turn < maxTurns; turn++) {
        const chatResponse = await this.ai.models.generateContent({
          model: this.modelName,
          contents,
          config: {
            systemInstruction: `You are an expert GitHubOps DevOps AI assistant.
Always perform requested operations using the provided tools.

CRITICAL INSTRUCTIONS:
1. Tool Parameters: Never invent or hallucinate repository owners, organization names, or dummy accounts (e.g., do not assume "google-devrel-test", "google-gemini-demo", etc.). If the user does not provide "owner/repo" format, pass the exact repo name and leave the owner empty or omit it so the backend resolves it dynamically from the user's installed repositories.
2. Security & Human-in-the-loop: If a tool response requires confirmation (e.g., requiresConfirmation: true, pendingAction, or returns a confirmationToken), DO NOT attempt to call 'confirm_dangerous_action' automatically. Immediately halt execution, present the warning, action details, and confirmationToken to the user, and ask for explicit human approval.`,
            tools: [{ functionDeclarations }],
          },
        });

        const candidateContent = chatResponse.candidates?.[0]?.content;
        if (candidateContent) {
          contents.push(candidateContent);
        }

        const functionCalls = chatResponse.functionCalls;

        if (!functionCalls || functionCalls.length === 0) {
          return {
            response:
              chatResponse.text ??
              (typeof candidateContent?.parts?.[0]?.text === 'string'
                ? candidateContent.parts[0].text
                : 'Action completed.'),
            executedTool: lastExecutedTool,
            rawData: lastToolResult,
          };
        }

        for (const call of functionCalls) {
          const toolName = call.name ?? '';
          const toolArgs = (call.args as Record<string, unknown>) || {};

          if (!toolName) continue;

          this.logger.log(
            `Executing tool [Turn ${turn + 1}]: ${toolName} for User: ${userId}`,
          );

          const toolExecutionResult = await this.mcpService.executeTool(
            toolName,
            toolArgs,
            userId,
            ipAddress,
            installationId,
          );

          lastExecutedTool = toolName;
          lastToolResult = toolExecutionResult;

          contents.push({
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: toolName,
                  response: { result: toolExecutionResult },
                },
              },
            ],
          });
        }
      }

      return {
        response: 'Completed operations successfully.',
        executedTool: lastExecutedTool,
        rawData: lastToolResult,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error executing AI workflow';
      this.logger.error(`Gemini Workflow Failed: ${errorMessage}`);
      throw error;
    }
  }
}
