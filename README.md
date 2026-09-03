<p align="center">
  <img src="docs/images/logo.png" alt="OctoGuardian Logo" width="180" />
</p>

# OctoGuardian: Enterprise Autonomous MCP GitHub Operations Engine

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.x-green.svg)
![TypeScript](https://img.shields.io/badge/built%20with-TypeScript-3178c6.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)

> **A Model Context Protocol (MCP) orchestrator bridging Large Language Models with GitHub REST APIs, equipped with Human-in-the-Loop (HITL) execution interceptors, cryptographic state validation, and non-repudiation audit logging.**

---

## 📑 Table of Contents

1. [System Overview](#-system-overview)
2. [Architectural Deep Dive](#-architectural-deep-dive)
3. [Component Hierarchy & Execution Lifecycle](#-component-hierarchy--execution-lifecycle)
4. [Human-in-the-Loop (HITL) Security Model](#-human-in-the-loop-hitl-security-model)
5. [Model Context Protocol (MCP) Tool Inventory](#-model-context-protocol-mcp-tool-inventory)
6. [Chat & Conversation Memory](#-chat--conversation-memory)
7. [Audit Logging & Observability Engine](#-audit-logging--observability-engine)
8. [Setup & Deployment Guide](#-setup--deployment-guide)
9. [Comprehensive API Reference](#-comprehensive-api-reference)
10. [Troubleshooting & Diagnostics](#-troubleshooting--diagnostics)
11. [Creator](#-creator)

---

## 🌐 System Overview

**OctoGuardian** resolves the impedance mismatch between non-deterministic AI generation and deterministic software version-control systems. Standard agentic tools often execute high-impact mutations on repositories without deterministic authorization boundaries, leading to potential data loss or unauthorized commits.

OctoGuardian implements a protocol layer that guarantees:
* **Zero Implicit Trust Execution:** Destructive actions are classified statically and intercepted prior to GitHub API invocation.
* **Deterministic Parameter Transformation:** Converts conversational intentions into strictly validated JSON schemas compliant with GitHub REST endpoints.
* **Dynamic Installation Context:** Dynamically handles GitHub App authentications, installation access tokens (IAT), and multi-tenant organization boundaries without hardcoded permissions.
* **Granular Traceability:** Every tool invocation, whether executed, rejected, or intercepted, is recorded with microsecond timing and parameter snapshots.

---

## 🏗️ Architectural Deep Dive

```
                             [ USER CLIENT ]
                                    │
                                    │ HTTP POST /api/v1/mcp/chat
                                    ▼
               ┌──────────────────────────────────────────┐
               │        API Gateway & Auth Guard          │
               │   - JWT Verification / API Key Auth      │
               │   - Rate Limiting & Input Sanitization   │
               └────────────────────┬─────────────────────┘
                                    │
                                    ▼
               ┌──────────────────────────────────────────┐
               │    Gemini LLM + MCP Tool Orchestrator    │
               │   - Intent Classification                │
               │   - Function Schema Matching             │
               │   - Dynamic Argument Extraction          │
               └────────────────────┬─────────────────────┘
                                    │
                     Tool Call Request Payload
                                    │
                                    ▼
               ┌──────────────────────────────────────────┐
               │         Risk Classification Engine       │
               └────────────┬─────────────────────────────┘
                            │
      ┌─────────────────────┴─────────────────────┐
      │                                           │
[ SAFE OPERATION ]                        [ DANGEROUS OPERATION ]
      │                                           │
      │                                 Is Confirmed Token Valid?
      │                                   ├── NO ──► [ Generate Token & HALT ]
      │                                   │          └── Status: PENDING_CONFIRMATION
      │                                   └── YES ─┐
      │                                            │
      ▼                                            ▼
┌─────────────────────────────────────────────────────────────┐
│               Octokit App Integration Layer                 │
│  - GitHub App JWT Authentication (RS256 Private Key)        │
│  - Installation Access Token (IAT) Cache & Dynamic Minting  │
│  - Secondary Rate-Limit & Backoff Handlers                  │
└──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    GitHub REST API v3 / v4                  │
│       (Repositories, Refs, Trees, Commits, Pulls, Issues)   │
└──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│               Enterprise Audit Log Engine                   │
│  - Writes to MongoDB Collection                             │
│  - Metrics: Latency (ms), Target Repo, Action, IP, Status   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Component Hierarchy & Execution Lifecycle

### 1. Ingestion & Prompt Normalization
The client submits a free-text prompt via the REST API. The payload is validated via class-validator pipes and passed to the Orchestrator service.

### 2. LLM Function Calling Resolution
The orchestrator initializes Google Gemini (`gemini-3.1-flash-lite`, via the `@google/genai` SDK) with an MCP-compliant tool catalog. The model runs inside a bounded agentic loop (maximum 5 turns): each turn, Gemini may return a structured `FunctionCall`, which is executed and fed back into the conversation as a function response, until the model produces a final natural-language answer or the turn budget is exhausted. The system instruction explicitly forbids the model from inventing repository owners/organizations and forbids it from auto-confirming a dangerous action on the user's behalf.

### 3. Dynamic Installation Context Resolver
The system matches the authenticated user against GitHub App installation mappings. It retrieves the repository metadata to confirm write access and ensure execution is routed to the authorized repository owner.

### 4. Interception vs Execution
* If the tool is non-destructive (e.g., `list_branches`, `create_issue`, `get_file_content`), it immediately routes to the Octokit client.
* If the tool is flagged as destructive (e.g., `delete_branch`, `delete_repository`, `delete_file`), execution is diverted to the HITL Interceptor.

---

## 🛡️ Human-in-the-Loop (HITL) Security Model

Destructive operations cannot be bypassed through prompt injection or model hallucination. The security pipeline enforces a strict two-phase commit protocol:

```
User Prompt ──► [Delete branch 'main']
      │
      ▼
Risk Evaluator (Flagged: DANGEROUS)
      │
      ▼
Generates Cryptographic Token: `ctk_8f93...`
      │
      ▼
Database Persistence: Status = PENDING_CONFIRMATION, TTL = 300s
      │
      ▼
API Response: Requires User Confirmation with Token
      │
      ▼
User Prompt ──► [Confirm deletion with confirmationToken 'ctk_8f93...']
      │
      ▼
Token Validation & Expiry Check
      │
      ├── If Valid: Executes GitHub API Mutation ──► Status: SUCCESS
      └── If Expired/Invalid: Rejects Execution ──► Status: FAILED
```

### Safety Rules Matrix

| Action | Classification | Default Action | Re-confirmation Requirement |
| :--- | :--- | :--- | :--- |
| `list_repositories` | `SAFE` | Direct Execute | None |
| `get_file_content` | `SAFE` | Direct Execute | None |
| `create_issue` | `SAFE` | Direct Execute | None |
| `create_branch` | `SAFE` | Direct Execute | None |
| `create_or_update_file`| `MUTATION` | Direct Execute | None |
| `create_pull_request` | `MUTATION` | Direct Execute | None |
| `delete_branch` | `CRITICAL` | Blocked & Tokenized | Explicit Token Consumed |
| `delete_file` | `CRITICAL` | Blocked & Tokenized | Explicit Token Consumed |
| `delete_repository` | `FATAL` | Blocked & Tokenized | Explicit Token Consumed |

---

## 🛠️ Model Context Protocol (MCP) Tool Inventory

### 1. Repository Actions
* **`LIST_REPOSITORIES`** (`list_repositories`): Lists all repositories accessible by the account or installation.
* **`GET_REPOSITORY`** (`get_repository`): Fetches metadata, default branch, and stats for a specific repository.
* **`CREATE_REPOSITORY`** (`create_repository`): Creates a new repository.
* **`DELETE_REPOSITORY`** (`delete_repository`) *(Dangerous)*: Permanently deletes a repository. Requires confirmation.

### 2. Branch Actions
* **`LIST_BRANCHES`** (`list_branches`): Fetches all remote branches in a repository along with their latest commit SHAs.
* **`GET_BRANCH`** (`get_branch`): Retrieves details and protection rules for a specific branch.
* **`CREATE_BRANCH`** (`create_branch`): Provisions a new feature or custom branch from a base branch.
* **`DELETE_BRANCH`** (`delete_branch`) *(Dangerous)*: Permanently deletes a branch. Requires confirmation.

### 3. File & Commit Actions
* **`GET_FILE_CONTENT`** (`get_file_content`): Reads and decodes raw file content from any branch or commit ref.
* **`CREATE_OR_UPDATE_FILE`** (`create_or_update_file`): Adds or updates a file and pushes the commit.
* **`DELETE_FILE`** (`delete_file`) *(Dangerous)*: Removes a file from the repository and records the commit. Requires confirmation.

### 4. Pull Request Actions
* **`LIST_PULL_REQUESTS`** (`list_pull_requests`): Fetches the list of pull requests (`open`, `closed`, or `all`).
* **`CREATE_PULL_REQUEST`** (`create_pull_request`): Opens a new pull request between a source and target branch.
* **`MERGE_PULL_REQUEST`** (`merge_pull_request`): Merges a pull request using `merge`, `squash`, or `rebase`.

### 5. Issue Actions
* **`LIST_ISSUES`** (`list_issues`): Lists open and closed issues in a repository.
* **`CREATE_ISSUE`** (`create_issue`): Creates a new issue with title, markdown body, and labels.
* **`CLOSE_ISSUE`** (`close_issue`): Resolves and closes an existing issue.

### 6. Security & Confirmation Action
* **`CONFIRM_DANGEROUS_ACTION`** (`confirm_dangerous_action`): Validates an intercepted destructive token and executes the blocked dangerous action.

---

## 💬 Chat & Conversation Memory

Every prompt and response exchanged with the MCP orchestrator is persisted independently of the audit log, so a user's conversation survives page reloads and can be replayed as a chat thread.

* **Storage**: A dedicated `ChatMessage` MongoDB collection stores `userId`, `role` (`user` | `assistant`), `content`, and optionally the `executedTool` name and its `rawData` result, timestamped via Mongoose's automatic `createdAt`/`updatedAt` fields.
* **Scope**: History reads and deletes are always scoped to the authenticated user; there is no cross-user visibility into chat content.
* **Separation of concerns**: Chat history is a UI/UX convenience (what did we say to each other), while the audit log is the compliance/security record (what did the system actually do). The two are stored separately and neither substitutes for the other.
* **Lifecycle**: The frontend calls `GET /api/v1/chat/history` on load, `POST /api/v1/chat/message` after each turn (both the user's prompt and the assistant's reply), and `DELETE /api/v1/chat/history` when the user clears the conversation.

---

## 📊 Audit Logging & Observability Engine

Every operation executed across the engine is persisted in an audit log collection:

```json
{
  "_id": "6a9339325e7656067732d28a",
  "userId": "6a9320c9730411e54db1efd4",
  "toolName": "delete_branch",
  "action": "DELETE_BRANCH",
  "repository": "Airline-Reservation-System1.0",
  "parameters": {
    "branchName": "feature/seat-matrix",
    "owner": "Ahmadnaveedofficial",
    "repo": "Airline-Reservation-System1.0"
  },
  "status": "SUCCESS",
  "failureReason": null,
  "executionTimeMs": 3021,
  "ipAddress": "127.0.0.1",
  "createdAt": "2026-08-29T19:55:30.534Z"
}
```

### Analytics Endpoint Metrics

* **Total Operations**: Aggregated count of all invocations.
* **Success / Failure Distribution**: Ratio of execution states.
* **Pending Confirmations**: Intercepted destructive operation counter.
* **Average Latency**: Execution turnaround time measured in milliseconds (ms).

---

## 🚀 Setup & Deployment Guide

### Prerequisites

* **Node.js**: `v20.x` or higher
* **MongoDB**: `v6.x` or Atlas cluster
* **GitHub App**: Configured with Read & Write permissions for Repository Contents, Pull Requests, Issues, and Administration.
* **Google Gemini API Key**: Acquired via Google AI Studio.

### 1. Environment Configuration

Copy `.env.example` to `.env` and configure credentials. Every variable below is validated at boot time by a Joi schema (`src/config/env.validation.ts`); the process refuses to start if a required variable is missing.

```env
# Server
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
# Set to "none" only when the frontend and backend are on different domains in production
COOKIE_SAME_SITE=lax

# Database
MONGODB_URI=mongodb://localhost:27017/octoguardian

# JWT
JWT_ACCESS_SECRET=your-super-secret-access-key
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_REFRESH_EXPIRES_IN=7d

# SMTP (OTP + account lifecycle emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Cloudinary (avatar uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Google AI
GEMINI_API_KEY=AIzaSy...

# GitHub App Configuration
GITHUB_APP_ID=4762896
GITHUB_APP_INSTALLATION_ID=54321987
GITHUB_APP_CLIENT_ID=Iv23li...
GITHUB_APP_CLIENT_SECRET=570b43dc...
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...\n-----END RSA PRIVATE KEY-----"
```

> **Note:** the API prefix (`api/v1`) and Swagger path (`api/docs`) are hardcoded in `src/main.ts`, not environment-driven. `PORT` is read directly from `process.env` in `main.ts` and falls back to `4000` if unset.

### 2. Installation & Bootstrap

```bash
# Clone repository
git clone https://github.com/Ahmadnaveedofficial/OctoGuardian.git
cd OctoGuardian

# Install dependencies
npm install

# Start development server (MongoDB uses Mongoose schemas directly; no migration step is required)
npm run start:dev
```

### 3. Production Build

```bash
# Build TypeScript distribution
npm run build

# Start production server
npm run start:prod
```

---

## 📡 Comprehensive API Reference

### 1. Execute MCP Natural Language Prompt

* **Endpoint:** `POST /api/v1/mcp/chat`
* **Headers:** `Content-Type: application/json`

#### Example Request:

```json
{
  "prompt": "Airline-Reservation-System1.0 repo mein ek issue create karo with title 'Bug: Auth Token Expiry' and labels ['bug', 'security']."
}
```

#### Example Response (Success):

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "response": "Issue #3 successfully created in 'Airline-Reservation-System1.0'.",
    "executedTool": "create_issue",
    "rawData": {
      "number": 3,
      "title": "Bug: Auth Token Expiry",
      "state": "open",
      "htmlUrl": "https://github.com/Ahmadnaveedofficial/Airline-Reservation-System1.0/issues/3"
    }
  }
}
```

---

### 2. Destructive Action Interception Flow

#### Step 1: Triggering Action

```json
{
  "prompt": "Delete branch 'feature/temp-work' from Airline-Reservation-System1.0 repository."
}
```

#### Step 1 Response (Intercepted):

```json
{
  "success": false,
  "statusCode": 403,
  "data": {
    "status": "PENDING_CONFIRMATION",
    "message": "Destructive operation detected: delete_branch on Ahmadnaveedofficial/Airline-Reservation-System1.0.",
    "confirmationToken": "ctk_9a2f6b88-12c4-4b5d-9103-7ef28d9c1234",
    "expiresInSeconds": 300
  }
}
```

#### Step 2: Confirming Action

```json
{
  "prompt": "I confirm the deletion with confirmationToken 'ctk_9a2f6b88-12c4-4b5d-9103-7ef28d9c1234'."
}
```

#### Step 2 Response (Executed):

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "response": "Branch 'feature/temp-work' permanently deleted from Ahmadnaveedofficial/Airline-Reservation-System1.0.",
    "executedTool": "confirm_dangerous_action",
    "rawData": {
      "deleted": true,
      "status": 204
    }
  }
}
```

---

### 3. Fetch Paginated Audit Logs

* **Endpoint:** `GET /api/v1/audit/my-logs?page=1&limit=10`

#### Example Response:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "logs": [
      {
        "_id": "6a9339325e7656067732d28a",
        "toolName": "delete_branch",
        "action": "DELETE_BRANCH",
        "repository": "Airline-Reservation-System1.0",
        "status": "SUCCESS",
        "executionTimeMs": 3021,
        "createdAt": "2026-08-29T19:55:30.534Z"
      }
    ],
    "pagination": {
      "total": 27,
      "page": 1,
      "limit": 10,
      "totalPages": 3
    }
  }
}
```

---

### 4. Fetch Execution Statistics

* **Endpoint:** `GET /api/v1/audit/stats`

#### Example Response:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "totalActions": 27,
    "successful": 17,
    "failed": 6,
    "pendingConfirmation": 4,
    "avgExecutionTimeMs": 2268
  }
}
```

---

### 5. Chat History Endpoints

* **`GET /api/v1/chat/history`** — Returns the authenticated user's saved messages in chronological order.
* **`POST /api/v1/chat/message`** — Persists a single message (`role`, `content`, optional `executedTool`/`rawData`). The frontend calls this once for the user's prompt and once for the assistant's reply.
* **`DELETE /api/v1/chat/history`** — Permanently deletes all saved messages for the authenticated user.

#### Example Response — `GET /api/v1/chat/history`

```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "_id": "6a9339325e7656067732d28a",
      "userId": "6a9320c9730411e54db1efd4",
      "role": "user",
      "content": "List my repositories",
      "createdAt": "2026-08-29T19:55:12.001Z"
    },
    {
      "_id": "6a9339325e7656067732d28b",
      "userId": "6a9320c9730411e54db1efd4",
      "role": "assistant",
      "content": "You have 4 repositories accessible via the current installation.",
      "executedTool": "list_repositories",
      "createdAt": "2026-08-29T19:55:13.442Z"
    }
  ]
}
```

---

## 🔧 Troubleshooting & Diagnostics

### 1. `HttpError: Resource not accessible by integration`

* **Cause**: The GitHub App does not have the required permission (e.g., Pull Requests, Issues, Administration).
* **Fix**: Navigate to `GitHub App Settings -> Permissions & events -> Repository permissions`, grant the necessary Read/Write access, and accept the updated permissions prompt under `Installed GitHub Apps`.

### 2. `Invalid Private Key format (ERR_OSSL_UNSUPPORTED)`

* **Cause**: RSA Private Key is missing newlines or newline characters (`\n`) are escaped improperly in `.env`.
* **Fix**: Ensure the key retains valid PEM format:

```bash
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----"
```

### 3. `Gemini FunctionCall Parameter Mismatch`

* **Cause**: LLM inferred parameters outside the registered JSON schema.
* **Fix**: The MCP adapter layer applies default parameter fallback pipelines and sanitizes dynamic inputs before dispatching to Octokit.

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

## 👤 Creator

**Muhammad Ahmad Naveed**

* GitHub: [@Ahmadnaveedofficial](https://github.com/Ahmadnaveedofficial)
* LinkedIn: [Ahmad Naveed](https://www.linkedin.com/in/ahmad-naveed-7b539521a/)
* Portfolio: [ahmadnaveed.vercel.app](https://ahmadnaveed.vercel.app/)
