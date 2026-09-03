// src/github/github.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Octokit } from 'octokit';
import { createAppAuth } from '@octokit/auth-app';
import { throttling } from '@octokit/plugin-throttling';
import { retry } from '@octokit/plugin-retry';

const CustomOctokit = Octokit.plugin(throttling, retry);

interface RequestOptions {
  method: string;
  url: string;
  [key: string]: unknown;
}

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);
  private defaultOctokit?: Octokit;
  private readonly appId: string;
  private readonly privateKey: string;
  private readonly defaultInstallationId?: number;

  constructor(private readonly configService: ConfigService) {
    this.appId =
      this.configService.get<string>('GITHUB_APP_ID') ||
      process.env.GITHUB_APP_ID ||
      '';

    let rawKey =
      this.configService.get<string>('GITHUB_APP_PRIVATE_KEY') ||
      this.configService.get<string>('GITHUB_PRIVATE_KEY') ||
      process.env.GITHUB_APP_PRIVATE_KEY ||
      process.env.GITHUB_PRIVATE_KEY ||
      '';

    if (
      (rawKey.startsWith('"') && rawKey.endsWith('"')) ||
      (rawKey.startsWith("'") && rawKey.endsWith("'"))
    ) {
      rawKey = rawKey.slice(1, -1);
    }

    this.privateKey = rawKey.replace(/\\n/g, '\n').trim();

    const rawInstId =
      this.configService.get<string>('GITHUB_APP_INSTALLATION_ID') ||
      this.configService.get<string>('GITHUB_INSTALLATION_ID') ||
      process.env.GITHUB_APP_INSTALLATION_ID ||
      process.env.GITHUB_INSTALLATION_ID;

    if (rawInstId) {
      this.defaultInstallationId = parseInt(rawInstId, 10);
    }

    this.initDefaultOctokit();
  }

  private initDefaultOctokit() {
    if (!this.appId || !this.privateKey) {
      this.logger.error(
        'GitHub App ID or Private Key is missing or invalid in environment config.',
      );
      return;
    }

    this.defaultOctokit = new CustomOctokit({
      authStrategy: createAppAuth,
      auth: {
        appId: this.appId,
        privateKey: this.privateKey,
        installationId: this.defaultInstallationId,
      },
      throttle: {
        onRateLimit: (
          retryAfter: number,
          options: RequestOptions,
          _octokit: unknown,
          retryCount: number,
        ) => {
          this.logger.warn(
            `Rate limit hit for ${options.method} ${options.url}. Retrying after ${retryAfter}s. Retry count: ${retryCount}`,
          );
          return retryCount < 3;
        },
        onSecondaryRateLimit: (
          retryAfter: number,
          options: RequestOptions,
          _octokit: unknown,
          retryCount: number,
        ) => {
          this.logger.warn(
            `Secondary rate limit hit for ${options.method} ${options.url}. Retrying after ${retryAfter}s. Retry count: ${retryCount}`,
          );
          return retryCount < 2;
        },
      },
      retry: {
        doNotRetry: [400, 401, 403, 404, 422],
      },
    });
  }

  public getOctokit(installationId?: number): Octokit {
    if (!this.appId || !this.privateKey) {
      throw new BadRequestException(
        'GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY is missing or invalid.',
      );
    }

    const targetInstallationId = installationId || this.defaultInstallationId;

    if (!installationId || installationId === this.defaultInstallationId) {
      if (this.defaultOctokit) {
        return this.defaultOctokit;
      }
    }

    return new CustomOctokit({
      authStrategy: createAppAuth,
      auth: {
        appId: this.appId,
        privateKey: this.privateKey,
        installationId: targetInstallationId,
      },
      throttle: {
        onRateLimit: (
          retryAfter: number,
          options: RequestOptions,
          _octokit: unknown,
          retryCount: number,
        ) => {
          this.logger.warn(
            `Rate limit hit for ${options.method} ${options.url}. Retrying after ${retryAfter}s.`,
          );
          return retryCount < 3;
        },
        onSecondaryRateLimit: (
          retryAfter: number,
          options: RequestOptions,
          _octokit: unknown,
          retryCount: number,
        ) => {
          this.logger.warn(
            `Secondary rate limit for ${options.method} ${options.url}. Retrying after ${retryAfter}s.`,
          );
          return retryCount < 2;
        },
      },
      retry: {
        doNotRetry: [400, 401, 403, 404, 422],
      },
    });
  }

  async getOwnerForRepo(
    repoName: string,
    installationId?: number,
  ): Promise<string> {
    const octokit = this.getOctokit(installationId);
    try {
      const response =
        await octokit.rest.apps.listReposAccessibleToInstallation({
          per_page: 100,
        });

      const matched = response.data.repositories.find(
        (r) => r.name.toLowerCase() === repoName.toLowerCase(),
      );

      if (matched) {
        return matched.owner.login;
      }

      if (response.data.repositories.length > 0) {
        return response.data.repositories[0].owner.login;
      }

      throw new BadRequestException(
        `Repository "${repoName}" is not accessible to this GitHub App installation.`,
      );
    } catch (err: unknown) {
      this.logger.error(
        `Failed to resolve owner for repository: ${repoName}`,
        err,
      );
      throw new BadRequestException(
        `Could not resolve GitHub owner for repository "${repoName}".`,
      );
    }
  }

  async listRepositories(installationId?: number) {
    const octokit = this.getOctokit(installationId);
    const response = await octokit.rest.apps.listReposAccessibleToInstallation({
      per_page: 100,
    });
    return response.data.repositories.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      owner: repo.owner.login,
      defaultBranch: repo.default_branch,
      htmlUrl: repo.html_url,
      description: repo.description,
    }));
  }

  async getRepository(owner: string, repo: string, installationId?: number) {
    const octokit = this.getOctokit(installationId);
    try {
      const { data } = await octokit.rest.repos.get({ owner, repo });
      return {
        id: data.id,
        name: data.name,
        fullName: data.full_name,
        private: data.private,
        owner: data.owner.login,
        defaultBranch: data.default_branch,
        htmlUrl: data.html_url,
        description: data.description,
        openIssuesCount: data.open_issues_count,
        forksCount: data.forks_count,
        stargazersCount: data.stargazers_count,
      };
    } catch {
      throw new NotFoundException(`Repository ${owner}/${repo} not found.`);
    }
  }

  async createRepository(
    name: string,
    description?: string,
    isPrivate = false,
    org?: string,
    installationId?: number,
  ) {
    const octokit = this.getOctokit(installationId);
    if (org) {
      const { data } = await octokit.rest.repos.createInOrg({
        org,
        name,
        description,
        private: isPrivate,
        auto_init: true,
      });
      return { id: data.id, fullName: data.full_name, htmlUrl: data.html_url };
    }

    const { data } = await octokit.rest.repos.createForAuthenticatedUser({
      name,
      description,
      private: isPrivate,
      auto_init: true,
    });
    return { id: data.id, fullName: data.full_name, htmlUrl: data.html_url };
  }

  async deleteRepository(owner: string, repo: string, installationId?: number) {
    const octokit = this.getOctokit(installationId);
    await octokit.rest.repos.delete({ owner, repo });
    return { deleted: true, repo: `${owner}/${repo}` };
  }

  async listBranches(owner: string, repo: string, installationId?: number) {
    const octokit = this.getOctokit(installationId);
    const { data } = await octokit.rest.repos.listBranches({
      owner,
      repo,
      per_page: 100,
    });
    return data.map((b) => ({
      name: b.name,
      commitSha: b.commit.sha,
      protected: b.protected,
    }));
  }

  async createBranch(
    owner: string,
    repo: string,
    branchName: string,
    fromBranch = 'main',
    installationId?: number,
  ) {
    const octokit = this.getOctokit(installationId);
    try {
      const { data: refData } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${fromBranch}`,
      });

      const sha = refData.object.sha;
      const { data: newBranch } = await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha,
      });

      return {
        branch: branchName,
        ref: newBranch.ref,
        sha: newBranch.object.sha,
      };
    } catch (error: any) {
      if (error.status === 409 || error.message?.includes('empty')) {
        await this.createOrUpdateFile(
          owner,
          repo,
          'README.md',
          `# ${repo}\n\nInitialized automatically via OctoGuardian AI Engine.`,
          'Initial commit',
          fromBranch,
          installationId,
        );
        return this.createBranch(owner, repo, branchName, fromBranch, installationId);
      }
      throw error;
    }
  }

  async deleteBranch(
    owner: string,
    repo: string,
    branchName: string,
    installationId?: number,
  ) {
    const octokit = this.getOctokit(installationId);
    const cleanBranch = branchName
      .replace(/^refs\/heads\//, '')
      .replace(/^heads\//, '');
    const response = await octokit.rest.git.deleteRef({
      owner,
      repo,
      ref: `heads/${cleanBranch}`,
    });
    return {
      deleted: true,
      repo: `${owner}/${repo}`,
      branch: cleanBranch,
      status: response.status,
    };
  }

  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    branch = 'main',
    installationId?: number,
  ) {
    const octokit = this.getOctokit(installationId);
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });

    if (Array.isArray(data) || !('content' in data)) {
      throw new BadRequestException('Target path is a directory, not a file.');
    }

    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return {
      path: data.path,
      sha: data.sha,
      size: data.size,
      branch,
      content,
    };
  }

  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    commitMessage: string,
    branch = 'main',
    installationId?: number,
  ) {
    const octokit = this.getOctokit(installationId);
    let existingSha: string | undefined;

    try {
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });
      if (!Array.isArray(data) && 'sha' in data) {
        existingSha = data.sha;
      }
    } catch {
      // File does not exist, creating new
    }

    const { data } = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: commitMessage,
      content: Buffer.from(content).toString('base64'),
      branch,
      sha: existingSha,
    });

    return {
      path: data.content?.path,
      commitSha: data.commit.sha,
      branch,
      action: existingSha ? 'updated' : 'created',
    };
  }

  async deleteFile(
    owner: string,
    repo: string,
    path: string,
    commitMessage: string,
    branch = 'main',
    installationId?: number,
  ) {
    const octokit = this.getOctokit(installationId);
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });

    if (Array.isArray(fileData) || !('sha' in fileData)) {
      throw new BadRequestException('Target path is not a valid file.');
    }

    await octokit.rest.repos.deleteFile({
      owner,
      repo,
      path,
      message: commitMessage,
      sha: fileData.sha,
      branch,
    });

    return { deleted: true, path, branch };
  }

  async listPullRequests(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open',
    installationId?: number,
  ) {
    const octokit = this.getOctokit(installationId);
    const { data } = await octokit.rest.pulls.list({
      owner,
      repo,
      state,
      per_page: 50,
    });

    return data.map((pr) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      user: pr.user?.login,
      head: pr.head.ref,
      base: pr.base.ref,
      htmlUrl: pr.html_url,
      createdAt: pr.created_at,
    }));
  }

  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    head: string,
    base = 'main',
    body?: string,
    installationId?: number,
  ) {
    const octokit = this.getOctokit(installationId);
    const { data } = await octokit.rest.pulls.create({
      owner,
      repo,
      title,
      head,
      base,
      body,
    });

    return {
      number: data.number,
      title: data.title,
      htmlUrl: data.html_url,
      state: data.state,
    };
  }

  async mergePullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
    mergeMethod: 'merge' | 'squash' | 'rebase' = 'merge',
    installationId?: number,
  ) {
    const octokit = this.getOctokit(installationId);
    const { data } = await octokit.rest.pulls.merge({
      owner,
      repo,
      pull_number: pullNumber,
      merge_method: mergeMethod,
    });

    return {
      merged: data.merged,
      message: data.message,
      sha: data.sha,
    };
  }

  async listIssues(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open',
    installationId?: number,
  ) {
    const octokit = this.getOctokit(installationId);
    const { data } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state,
      per_page: 50,
    });

    return data
      .filter((i) => !i.pull_request)
      .map((issue) => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        user: issue.user?.login,
        labels: issue.labels.map((l) => (typeof l === 'string' ? l : l.name)),
        htmlUrl: issue.html_url,
        createdAt: issue.created_at,
      }));
  }

  async createIssue(
    owner: string,
    repo: string,
    title: string,
    body?: string,
    labels?: string[],
    installationId?: number,
  ) {
    const octokit = this.getOctokit(installationId);
    const { data } = await octokit.rest.issues.create({
      owner,
      repo,
      title,
      body,
      labels,
    });

    return {
      number: data.number,
      title: data.title,
      state: data.state,
      htmlUrl: data.html_url,
    };
  }

  async closeIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    installationId?: number,
  ) {
    const octokit = this.getOctokit(installationId);
    const { data } = await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: issueNumber,
      state: 'closed',
    });

    return {
      number: data.number,
      state: data.state,
      closedAt: data.closed_at,
    };
  }

  // --- ENTERPRISE OPERATIONS ADDED ---
  async listCommits(owner: string, repo: string, branch = 'main', installationId?: number) {
    const octokit = this.getOctokit(installationId);
    const { data } = await octokit.rest.repos.listCommits({ owner, repo, sha: branch, per_page: 20 });
    return data.map((c) => ({ sha: c.sha, message: c.commit.message, author: c.commit.author?.name }));
  }

  async createRelease(owner: string, repo: string, tagName: string, name: string, body?: string, installationId?: number) {
    const octokit = this.getOctokit(installationId);
    const { data } = await octokit.rest.repos.createRelease({ owner, repo, tag_name: tagName, name, body });
    return { id: data.id, tagName: data.tag_name, name: data.name, htmlUrl: data.html_url };
  }

  async listReleases(owner: string, repo: string, installationId?: number) {
    const octokit = this.getOctokit(installationId);
    const { data } = await octokit.rest.repos.listReleases({ owner, repo, per_page: 20 });
    return data.map((r) => ({ id: r.id, tagName: r.tag_name, name: r.name, htmlUrl: r.html_url }));
  }

  async listLabels(owner: string, repo: string, installationId?: number) {
    const octokit = this.getOctokit(installationId);
    const { data } = await octokit.rest.issues.listLabelsForRepo({ owner, repo });
    return data.map((l) => ({ name: l.name, color: l.color }));
  }

  async createLabel(owner: string, repo: string, name: string, color: string, description?: string, installationId?: number) {
    const octokit = this.getOctokit(installationId);
    const { data } = await octokit.rest.issues.createLabel({ owner, repo, name, color, description });
    return { name: data.name, color: data.color };
  }

  async listMilestones(owner: string, repo: string, installationId?: number) {
    const octokit = this.getOctokit(installationId);
    const { data } = await octokit.rest.issues.listMilestones({ owner, repo });
    return data.map((m) => ({ number: m.number, title: m.title, state: m.state }));
  }

  async createMilestone(owner: string, repo: string, title: string, description?: string, installationId?: number) {
    const octokit = this.getOctokit(installationId);
    const { data } = await octokit.rest.issues.createMilestone({ owner, repo, title, description });
    return { number: data.number, title: data.title };
  }

  async addCollaborator(owner: string, repo: string, username: string, permission: 'pull' | 'push' | 'admin' = 'push', installationId?: number) {
    const octokit = this.getOctokit(installationId);
    const { data } = await octokit.rest.repos.addCollaborator({ owner, repo, username, permission });
    return { added: true, username, permission, profileUrl: data.html_url };
  }

  async listCollaborators(owner: string, repo: string, installationId?: number) {
    const octokit = this.getOctokit(installationId);
    const { data } = await octokit.rest.repos.listCollaborators({ owner, repo });
    return data.map((c) => ({ username: c.login }));
  }

  async searchCode(query: string, installationId?: number) {
    const octokit = this.getOctokit(installationId);
    const { data } = await octokit.rest.search.code({ q: query, per_page: 10 });
    return data.items.map((item) => ({ name: item.name, path: item.path, repository: item.repository.full_name }));
  }
}