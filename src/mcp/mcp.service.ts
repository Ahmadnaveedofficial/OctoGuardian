import { Injectable, BadRequestException } from '@nestjs/common';
import { GitHubService } from '../github/github.service';
import { RiskEvaluatorService } from './risk-evaluator.service';
import { AuditService } from '../audit/audit.service';
import { AuditStatus } from '../audit/schemas/audit-log.schema';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

@Injectable()
export class McpService {
  constructor(
    private readonly gitHubService: GitHubService,
    private readonly riskEvaluator: RiskEvaluatorService,
    private readonly auditService: AuditService,
  ) {}

  private toSafeString(val: unknown, fallback = ''): string {
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    return fallback;
  }

  private async resolveOwnerAndRepo(
    args: Record<string, unknown>,
    installationId?: number,
  ): Promise<{ owner: string; repo: string }> {
    const rawRepo = this.toSafeString(
      args['repo'] || args['repository'] || args['name'],
    );
    let owner = this.toSafeString(args['owner']);
    let repo = rawRepo;

    if (rawRepo.includes('/')) {
      const parts = rawRepo.split('/');
      owner = parts[0];
      repo = parts[1];
    } else {
      owner = await this.gitHubService.getOwnerForRepo(repo, installationId);
    }

    return { owner, repo };
  }

  getAvailableTools(): ToolDefinition[] {
    return [
      {
        name: 'list_repositories',
        description:
          'List all GitHub repositories accessible to the installation.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'get_repository',
        description: 'Get detailed metadata of a specific GitHub repository.',
        parameters: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner or organization',
            },
            repo: { type: 'string', description: 'Repository name' },
          },
          required: ['owner', 'repo'],
        },
      },
      {
        name: 'create_repository',
        description: 'Create a new GitHub repository.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Repository name' },
            isPrivate: {
              type: 'boolean',
              description: 'Is repository private',
            },
            description: {
              type: 'string',
              description: 'Repository description',
            },
            org: {
              type: 'string',
              description: 'Organization name if applicable',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'delete_repository',
        description: 'Permanently delete a GitHub repository (Dangerous).',
        parameters: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
          },
          required: ['owner', 'repo'],
        },
      },
      {
        name: 'list_branches',
        description: 'List all branches in a repository.',
        parameters: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
          },
          required: ['owner', 'repo'],
        },
      },
      {
        name: 'create_branch',
        description:
          'Create a new branch from a source branch (defaults to main).',
        parameters: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            branchName: {
              type: 'string',
              description: 'Name of the new branch',
            },
            fromBranch: { type: 'string', description: 'Source branch name' },
          },
          required: ['owner', 'repo', 'branchName'],
        },
      },
      {
        name: 'delete_branch',
        description: 'Delete a branch from a repository (Dangerous).',
        parameters: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            branchName: { type: 'string', description: 'Branch to delete' },
          },
          required: ['owner', 'repo', 'branchName'],
        },
      },
      {
        name: 'get_file_content',
        description: 'Get raw text content of a file in a repository branch.',
        parameters: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            path: {
              type: 'string',
              description: 'File path relative to repo root',
            },
            branch: {
              type: 'string',
              description: 'Branch name (default main)',
            },
          },
          required: ['owner', 'repo', 'path'],
        },
      },
      {
        name: 'create_or_update_file',
        description:
          'Create a new file or update existing file content with commit message.',
        parameters: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            path: { type: 'string', description: 'File path' },
            content: { type: 'string', description: 'Raw string content' },
            commitMessage: {
              type: 'string',
              description: 'Git commit message',
            },
            branch: {
              type: 'string',
              description: 'Branch name (default main)',
            },
          },
          required: ['owner', 'repo', 'path', 'content', 'commitMessage'],
        },
      },
      {
        name: 'delete_file',
        description: 'Delete a file from a repository (Dangerous).',
        parameters: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            path: { type: 'string', description: 'File path' },
            commitMessage: { type: 'string', description: 'Commit message' },
            branch: {
              type: 'string',
              description: 'Branch name (default main)',
            },
          },
          required: ['owner', 'repo', 'path', 'commitMessage'],
        },
      },
      {
        name: 'list_pull_requests',
        description: 'List pull requests for a repository.',
        parameters: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            state: { type: 'string', enum: ['open', 'closed', 'all'] },
          },
          required: ['owner', 'repo'],
        },
      },
      {
        name: 'create_pull_request',
        description: 'Create a new Pull Request.',
        parameters: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            title: { type: 'string', description: 'PR title' },
            head: { type: 'string', description: 'Branch where changes exist' },
            base: { type: 'string', description: 'Branch to merge into' },
            body: { type: 'string', description: 'PR description/markdown' },
          },
          required: ['owner', 'repo', 'title', 'head'],
        },
      },
      {
        name: 'merge_pull_request',
        description: 'Merge an open Pull Request.',
        parameters: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            pullNumber: { type: 'number', description: 'PR number' },
            mergeMethod: {
              type: 'string',
              enum: ['merge', 'squash', 'rebase'],
            },
          },
          required: ['owner', 'repo', 'pullNumber'],
        },
      },
      {
        name: 'list_issues',
        description: 'List issues in a repository.',
        parameters: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            state: { type: 'string', enum: ['open', 'closed', 'all'] },
          },
          required: ['owner', 'repo'],
        },
      },
      {
        name: 'create_issue',
        description: 'Create a new issue in a repository.',
        parameters: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            title: { type: 'string', description: 'Issue title' },
            body: { type: 'string', description: 'Issue description' },
            labels: { type: 'array', items: { type: 'string' } },
          },
          required: ['owner', 'repo', 'title'],
        },
      },
      {
        name: 'close_issue',
        description: 'Close an existing issue in a repository.',
        parameters: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            issueNumber: { type: 'number', description: 'Issue number' },
          },
          required: ['owner', 'repo', 'issueNumber'],
        },
      },
      {
        name: 'confirm_dangerous_action',
        description:
          'Confirm and execute a dangerous pending action using confirmationToken.',
        parameters: {
          type: 'object',
          properties: {
            confirmationToken: {
              type: 'string',
              description: 'The token provided during confirmation request',
            },
          },
          required: ['confirmationToken'],
        },
      },
    ];
  }

  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    userId: string,
    ipAddress: string,
    installationId?: number,
  ): Promise<unknown> {
    const startTime = Date.now();
    const targetRepo =
      typeof args['repo'] === 'string' ? args['repo'] : undefined;

    // 1. Handle confirmation execution
    if (toolName === 'confirm_dangerous_action') {
      const token = this.toSafeString(args['confirmationToken']);
      const pending = await this.riskEvaluator.verifyAndConsumeToken(
        token,
        userId,
      );
      return this.runToolLogic(
        String(pending.toolName),
        pending.payload as Record<string, unknown>,
        userId,
        ipAddress,
        startTime,
        installationId,
      );
    }

    // 2. Intercept dangerous operations
    if (this.riskEvaluator.isDangerous(toolName)) {
      const pendingResult = await this.riskEvaluator.createPendingAction(
        userId,
        toolName,
        args,
      );

      await this.auditService.logAction({
        userId,
        toolName,
        action: toolName.toUpperCase(),
        repository: targetRepo,
        parameters: args,
        status: AuditStatus.PENDING_CONFIRMATION,
        ipAddress,
      });

      return pendingResult;
    }

    // 3. Normal Tool Execution
    return this.runToolLogic(
      toolName,
      args,
      userId,
      ipAddress,
      startTime,
      installationId,
    );
  }

  private async runToolLogic(
    toolName: string,
    args: Record<string, unknown>,
    userId: string,
    ipAddress: string,
    startTime: number,
    installationId?: number,
  ): Promise<unknown> {
    const { owner, repo } = await this.resolveOwnerAndRepo(
      args,
      installationId,
    );
    const targetRepo = repo || undefined;

    try {
      let result: unknown;

      switch (toolName) {
        case 'list_repositories':
          result = await this.gitHubService.listRepositories(installationId);
          break;

        case 'get_repository':
          result = await this.gitHubService.getRepository(
            owner,
            repo,
            installationId,
          );
          break;

        case 'create_repository':
          result = await this.gitHubService.createRepository(
            this.toSafeString(args['name']),
            typeof args['description'] === 'string'
              ? args['description']
              : undefined,
            Boolean(args['isPrivate'] ?? false),
            typeof args['org'] === 'string' ? args['org'] : undefined,
            installationId,
          );
          break;

        case 'delete_repository':
          result = await this.gitHubService.deleteRepository(
            owner,
            repo,
            installationId,
          );
          break;

        case 'list_branches':
          result = await this.gitHubService.listBranches(
            owner,
            repo,
            installationId,
          );
          break;

        case 'create_branch':
          result = await this.gitHubService.createBranch(
            owner,
            repo,
            this.toSafeString(args['branchName']),
            typeof args['fromBranch'] === 'string'
              ? args['fromBranch']
              : 'main',
            installationId,
          );
          break;

        case 'delete_branch': {
          const branchName = this.toSafeString(
            args['branchName'] || args['branch'] || args['ref'],
          )
            .replace(/^refs\/heads\//, '')
            .replace(/^heads\//, '');

          result = await this.gitHubService.deleteBranch(
            owner,
            repo,
            branchName,
            installationId,
          );
          break;
        }

        case 'get_file_content':
          result = await this.gitHubService.getFileContent(
            owner,
            repo,
            this.toSafeString(args['path']),
            typeof args['branch'] === 'string' ? args['branch'] : 'main',
            installationId,
          );
          break;

        case 'create_or_update_file':
          result = await this.gitHubService.createOrUpdateFile(
            owner,
            repo,
            this.toSafeString(args['path']),
            this.toSafeString(args['content']),
            this.toSafeString(args['commitMessage']),
            typeof args['branch'] === 'string' ? args['branch'] : 'main',
            installationId,
          );
          break;

        case 'delete_file':
          result = await this.gitHubService.deleteFile(
            owner,
            repo,
            this.toSafeString(args['path']),
            this.toSafeString(args['commitMessage']),
            typeof args['branch'] === 'string' ? args['branch'] : 'main',
            installationId,
          );
          break;

        case 'list_pull_requests':
          result = await this.gitHubService.listPullRequests(
            owner,
            repo,
            (args['state'] as 'open' | 'closed' | 'all') ?? 'open',
            installationId,
          );
          break;

        case 'create_pull_request':
          result = await this.gitHubService.createPullRequest(
            owner,
            repo,
            this.toSafeString(args['title']),
            this.toSafeString(args['head']),
            typeof args['base'] === 'string' ? args['base'] : 'main',
            typeof args['body'] === 'string' ? args['body'] : undefined,
            installationId,
          );
          break;

        case 'merge_pull_request':
          result = await this.gitHubService.mergePullRequest(
            owner,
            repo,
            Number(args['pullNumber']),
            (args['mergeMethod'] as 'merge' | 'squash' | 'rebase') ?? 'merge',
            installationId,
          );
          break;

        case 'list_issues':
          result = await this.gitHubService.listIssues(
            owner,
            repo,
            (args['state'] as 'open' | 'closed' | 'all') ?? 'open',
            installationId,
          );
          break;

        case 'create_issue':
          result = await this.gitHubService.createIssue(
            owner,
            repo,
            this.toSafeString(args['title']),
            typeof args['body'] === 'string' ? args['body'] : undefined,
            Array.isArray(args['labels'])
              ? (args['labels'] as string[])
              : undefined,
            installationId,
          );
          break;

        case 'close_issue':
          result = await this.gitHubService.closeIssue(
            owner,
            repo,
            Number(args['issueNumber']),
            installationId,
          );
          break;

        default:
          throw new BadRequestException(`Unknown MCP tool: ${toolName}`);
      }

      const executionTimeMs = Date.now() - startTime;
      await this.auditService.logAction({
        userId,
        toolName,
        action: toolName.toUpperCase(),
        repository: targetRepo,
        parameters: args,
        status: AuditStatus.SUCCESS,
        executionTimeMs,
        ipAddress,
      });

      return result;
    } catch (error: unknown) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown execution error';

      await this.auditService.logAction({
        userId,
        toolName,
        action: toolName.toUpperCase(),
        repository: targetRepo,
        parameters: args,
        status: AuditStatus.FAILED,
        failureReason: errorMessage,
        executionTimeMs,
        ipAddress,
      });
      throw error;
    }
  }
}
