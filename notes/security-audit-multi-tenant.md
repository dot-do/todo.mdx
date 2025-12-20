# Multi-Tenant Isolation Security Audit

**Date**: 2025-12-20
**Issue**: todo-k34
**Auditor**: Claude (Automated Security Review)

## Executive Summary

This audit reviews all data access paths in the todo.mdx worker to ensure proper multi-tenant isolation. Users should only be able to access repos and issues associated with their GitHub App installations.

**Overall Assessment**: **MOSTLY SECURE** with some concerns

- ✅ MCP tools have proper user authentication and authorization
- ✅ Most API routes enforce user-to-installation-to-repo access control
- ⚠️ Search API has potential cross-tenant data leakage
- ⚠️ Some admin endpoints lack proper authorization checks
- ⚠️ Durable Objects have no inherent access control
- ⚠️ Sandbox/Terminal APIs lack user authorization checks

## Authentication Mechanisms

### 1. WorkOS AuthKit OAuth 2.1
- **Location**: `worker/src/auth/authkit.ts`, `worker/src/mcp/authkit-handler.ts`
- **Flow**: OAuth 2.1 with PKCE via WorkOS
- **User Identification**: `workosUserId` from WorkOS authentication
- **Status**: ✅ SECURE - Proper OAuth implementation

### 2. WorkOS API Keys
- **Location**: `worker/src/auth/workos.ts`, `worker/src/auth/middleware.ts`
- **Flow**: Bearer tokens starting with `sk_live_` or `sk_test_`
- **User Identification**: API key validated via WorkOS, mapped to `userId`
- **Status**: ✅ SECURE - Proper validation against WorkOS API

### 3. Authentication Middleware
- **Location**: `worker/src/auth/middleware.ts`
- **Implementation**: `authMiddleware` function validates tokens and sets `auth` context
- **Status**: ✅ SECURE - Required on all protected routes

## Data Access Patterns

### Pattern 1: User → Installations → Repos → Issues

This is the primary access control pattern:

```
User (workosUserId)
  └─> Installations (via users array)
      └─> Repos (via installation relationship)
          └─> Issues (via repo relationship)
```

**Implementation**: Used in MCP tools and most API routes

## MCP Server (Model Context Protocol)

**Location**: `worker/src/mcp/index.ts`

### Authentication
- ✅ All MCP tools check `this.props?.user?.id` (WorkOS user ID)
- ✅ Returns error if not authenticated

### Tool: `search`
- **Lines**: 66-178
- **Authentication**: ✅ Checks `workosUserId`
- **Authorization**: ✅ Uses `getUserRepos()` helper to get user's accessible repos
- **Data Access**: ✅ Only searches issues within user's repos
- **Verdict**: ✅ SECURE

### Tool: `fetch`
- **Lines**: 181-240
- **Authentication**: ✅ Checks `workosUserId`
- **Authorization**: ✅ Verifies user has access to repo via `getUserRepos()`
- **Access Denial**: Returns "Access denied" if user doesn't have access
- **Verdict**: ✅ SECURE

### Tool: `roadmap`
- **Lines**: 243-332
- **Authentication**: ✅ Checks `workosUserId`
- **Authorization**: ✅ Uses `getUserRepos()` to filter accessible repos
- **Verdict**: ✅ SECURE

### Tool: `do` (Sandboxed Code Execution)
- **Lines**: 335-455
- **Authentication**: ✅ Checks `workosUserId`
- **Authorization**: ✅ Verifies repo access via `getUserRepos()`
- **Sandbox Isolation**: ✅ Scoped to single repo with `installationId`
- **Verdict**: ✅ SECURE

### Helper: `getUserRepos()`
- **Lines**: 27-62
- **Implementation**:
  1. Find Payload user by `workosUserId`
  2. Find installations where user is in `users` array
  3. Find repos for those installations
- **Verdict**: ✅ SECURE - Proper three-step authorization chain

## REST API Routes

**Location**: `worker/src/api/`

### Global API Auth
- **File**: `worker/src/api/index.ts`
- **Line 17**: `api.use('/*', authMiddleware)`
- **Status**: ✅ All API routes require authentication

### `/api/repos` - Repository Listing

**File**: `worker/src/api/repos.ts`

#### GET `/api/repos`
- **Lines**: 13-32
- **Query**: Joins `repos` and `user_installations` tables on `installation_id`
- **Filter**: `WHERE ui.user_id = ?` with `auth.userId`
- **Verdict**: ✅ SECURE - Properly filtered by user

#### GET `/api/repos/:owner/:repo`
- **Lines**: 35-67
- **Query**: Joins repos with user_installations
- **Filter**: `WHERE ui.user_id = ? AND r.full_name = ?`
- **Verdict**: ✅ SECURE - User and repo both validated

#### POST `/api/repos/:owner/:repo/sync`
- **Lines**: 70-100
- **Authorization**: ✅ Same verification as GET
- **Verdict**: ✅ SECURE

#### GET `/api/repos/:owner/:repo/sync/status`
- **Lines**: 103-128
- **Authorization**: ✅ Same verification as GET
- **Verdict**: ✅ SECURE

### `/api/repos/:owner/:repo/issues` - Issue Management

**File**: `worker/src/api/issues.ts`

#### Helper: `getRepoStub()`
- **Lines**: 16-34
- **Authorization**: Joins repos with user_installations
- **Filter**: `WHERE ui.user_id = ? AND r.full_name = ?`
- **Returns**: null if no access
- **Verdict**: ✅ SECURE - Proper access check

#### All Issue Endpoints
- **GET** `/` (list), **POST** `/` (create), **GET** `/:id`, **PATCH** `/:id`, **DELETE** `/:id`
- **Authorization**: All use `getRepoStub()` helper
- **Access Denial**: Returns 404 if `getRepoStub()` returns null
- **Verdict**: ✅ SECURE

### `/api/repos/:owner/:repo/milestones` - Milestone Management

**File**: `worker/src/api/milestones.ts`

- **Pattern**: Identical to issues API
- **Helper**: `getRepoStub()` with same implementation
- **Verdict**: ✅ SECURE

### `/api/search` - Hybrid Search

**File**: `worker/src/api/search.ts`

#### GET/POST `/api/search`
- **Lines**: 153-202
- **Authentication**: ⚠️ Uses `authMiddleware` from `api/index.ts`
- **Authorization**: ❌ **MISSING**
  - Calls `hybridSearch()` which queries ALL issues and milestones
  - No filtering by user's accessible repos
  - Line 38: `env.PAYLOAD.find({ collection: 'issues', ... })` - no user filter
  - Line 63: `env.PAYLOAD.find({ collection: 'milestones', ... })` - no user filter
- **Verdict**: 🚨 **VULNERABLE** - Cross-tenant data leakage

**Impact**: Any authenticated user can search and view titles/metadata of issues and milestones from ALL repositories, not just their own.

#### GET `/api/search/similar/:id`
- **Lines**: 208-249
- **Authorization**: ❌ **MISSING**
  - Uses Vectorize to find similar items
  - No check that user has access to the source or result items
- **Verdict**: 🚨 **VULNERABLE** - Can discover related issues from other tenants

### `/api/linear/*` - Linear Integration

**File**: `worker/src/api/linear.ts`

#### GET `/api/linear/connect`
- **Lines**: 29-60
- **Authentication**: ✅ Uses `authMiddleware`
- **Authorization**: ✅ Stores state with `auth.userId`
- **Verdict**: ✅ SECURE

#### POST `/api/linear/sync`
- **Lines**: 231-272
- **Authentication**: ✅ Uses `authMiddleware`
- **Authorization**: ✅ Verifies user in installation users array (lines 252-258)
- **Verdict**: ✅ SECURE

#### GET `/api/linear/sync/:repoId`
- **Lines**: 278-313
- **Authorization**: ✅ Filters by `user: { equals: auth.userId }`
- **Verdict**: ✅ SECURE

#### DELETE `/api/linear/integrations/:id`
- **Lines**: 395-424
- **Authorization**: ✅ Verifies `integration.user === auth.userId` (line 410)
- **Verdict**: ✅ SECURE

### `/api/sandbox/*` - Sandbox Execution

**File**: `worker/src/api/sandbox.ts`

#### POST `/api/sandbox/execute`
- **Lines**: 27-66
- **Authentication**: ❌ **MISSING** - No `authMiddleware` applied
- **Authorization**: ❌ **MISSING** - No user verification
- **Verdict**: 🚨 **VULNERABLE** - Any request can execute sandboxed code

**Impact**: Without authentication, anyone could trigger code execution. However, requires `installationId` which may limit abuse.

#### POST `/api/sandbox/sessions` (and other session endpoints)
- **Lines**: 76-228
- **Authentication**: ❌ **MISSING**
- **Verdict**: 🚨 **VULNERABLE**

### `/terminal/*` - Terminal WebSocket

**File**: `worker/src/api/terminal.ts`

#### GET `/terminal/:sessionId` (WebSocket)
- **Lines**: 31-75
- **Authentication**: ❌ **MISSING**
- **Authorization**: Checks session exists in KV but doesn't verify ownership
- **Verdict**: ⚠️ **WEAK** - Session ID is only protection

**Note**: Session IDs are UUIDs which provides some security through obscurity, but not ideal.

#### POST `/terminal/start`
- **Lines**: 86-124
- **Authentication**: ❌ **MISSING**
- **Verdict**: 🚨 **VULNERABLE** - Anyone can create terminal sessions

## Main Worker Routes

**File**: `worker/src/index.ts`

### Protected Routes (✅ SECURE)

#### GET `/api/me`
- **Line**: 130
- **Auth**: ✅ Uses `authMiddleware`
- **Verdict**: ✅ SECURE

#### GET `/api/user/installations`
- **Lines**: 544-557
- **Auth**: ✅ Uses `authMiddleware`
- **Filter**: ✅ `WHERE users.workosUserId = auth.userId`
- **Verdict**: ✅ SECURE

#### GET `/api/user/repos`
- **Lines**: 560-573
- **Auth**: ✅ Uses `authMiddleware`
- **Filter**: ✅ `WHERE installation.users.workosUserId = auth.userId`
- **Verdict**: ✅ SECURE

### Admin/Public Routes (⚠️ CONCERNS)

#### GET `/api/installations`
- **Lines**: 576-582
- **Auth**: ❌ **MISSING** - No `authMiddleware`
- **Data**: Returns ALL installations (limit 100)
- **Verdict**: 🚨 **VULNERABLE** - Public admin endpoint

#### GET `/api/installations/:id/repos`
- **Lines**: 585-594
- **Auth**: ❌ **MISSING**
- **Data**: Returns all repos for an installation
- **Verdict**: 🚨 **VULNERABLE** - No ownership verification

#### GET `/api/repos/:owner/:name/status`
- **Lines**: 597-607
- **Auth**: ❌ **MISSING**
- **Verdict**: ⚠️ **WEAK** - Read-only but exposes sync status

#### POST `/api/repos/:owner/:name/sync`
- **Lines**: 610-617
- **Auth**: ✅ Uses `authMiddleware`
- **Authorization**: ❌ **MISSING** - No verification user has access to repo
- **Verdict**: 🚨 **VULNERABLE** - Any authenticated user can trigger sync for any repo

### Project API Routes (⚠️ CONCERNS)

#### GET `/api/projects/:nodeId`
- **Lines**: 624-632
- **Auth**: ✅ Uses `authMiddleware`
- **Authorization**: ❌ **MISSING** - No verification user owns project
- **Verdict**: 🚨 **VULNERABLE**

#### GET `/api/projects/:nodeId/items`
- **Lines**: 635-643
- **Auth**: ✅ Uses `authMiddleware`
- **Authorization**: ❌ **MISSING**
- **Verdict**: 🚨 **VULNERABLE**

#### POST `/api/projects/:nodeId/sync`
- **Lines**: 657-667
- **Auth**: ✅ Uses `authMiddleware`
- **Authorization**: ❌ **MISSING**
- **Verdict**: 🚨 **VULNERABLE**

## Durable Objects

### RepoDO (Repository Durable Object)

**File**: `worker/src/do/repo.ts`

#### Access Control
- **Pattern**: Accessed via `env.REPO.idFromName(repoFullName)`
- **Security Model**: ❌ **NO INHERENT ACCESS CONTROL**
  - DOs are keyed by repo name, not user ID
  - Any code with DO namespace can access any repo's DO
  - Relies on calling code to enforce access control

#### fetch() Handler
- **Lines**: 652-709
- **Endpoints**: `/issues`, `/milestones`, `/sync`, etc.
- **Authorization**: ❌ None - assumes caller has already verified access
- **Verdict**: ⚠️ **DEPENDS ON CALLER** - DOs themselves don't check user permissions

**Analysis**: This is acceptable IF all routes that call the DO properly check user access first. The API routes do this correctly, but direct DO access would bypass security.

### ProjectDO

**File**: `worker/src/do/project.ts`

- **Pattern**: Similar to RepoDO
- **Verdict**: ⚠️ **DEPENDS ON CALLER**

## Sandbox Server (CapnWeb RPC)

**File**: `worker/src/sandbox/server.ts`

### SandboxedWorkflowAPI Class
- **Lines**: 17-27
- **Context**: Constructed with `repoFullName` and `installationId`
- **Scoping**: ✅ All operations scoped to the provided repo

#### getIssue(), listIssues()
- **Lines**: 33-56
- **Filter**: `where: { 'repo.fullName': { equals: this.repoFullName } }`
- **Verdict**: ✅ SECURE - Properly scoped to repo

**Analysis**: Sandbox is properly isolated to a single repo context. Security depends on caller providing correct repo and verifying user access.

## Webhook Handlers

**File**: `worker/src/index.ts`

### POST `/github/webhook`
- **Lines**: 203-232
- **Authentication**: ❌ None (public endpoint)
- **Verification**: ⚠️ Signature verification commented out (line 208-210)
- **Verdict**: ⚠️ **WEAK** - Should verify webhook signatures

**Note**: This is acceptable for webhooks as they're from GitHub, but signature verification is recommended.

### POST `/linear/webhook`
- **Lines**: 95-123, 323-361
- **Verification**: ⚠️ Commented out (line 329-332)
- **Verdict**: ⚠️ **WEAK** - Should verify webhook signatures

## Summary of Findings

### Critical Vulnerabilities (Fix Immediately)

1. **Search API - Cross-Tenant Data Leakage**
   - **Files**: `worker/src/api/search.ts`
   - **Issue**: No filtering by user's accessible repos
   - **Impact**: Users can search ALL issues/milestones across ALL tenants
   - **Fix**: Filter Payload queries by user's installations/repos

2. **Sandbox API - No Authentication**
   - **Files**: `worker/src/api/sandbox.ts`
   - **Issue**: No `authMiddleware` applied
   - **Impact**: Unauthenticated code execution
   - **Fix**: Add `authMiddleware` and verify repo access

3. **Terminal API - No Authentication**
   - **Files**: `worker/src/api/terminal.ts`
   - **Issue**: No `authMiddleware` applied
   - **Impact**: Unauthenticated terminal sessions
   - **Fix**: Add `authMiddleware` and verify user owns session

4. **Admin Endpoints - No Authorization**
   - **File**: `worker/src/index.ts`
   - **Endpoints**: `/api/installations`, `/api/installations/:id/repos`
   - **Issue**: No authentication required
   - **Impact**: Public access to all installation/repo data
   - **Fix**: Add `authMiddleware` or remove if debugging only

### High Priority Issues

5. **Project API - Missing Authorization**
   - **File**: `worker/src/index.ts`
   - **Endpoints**: `/api/projects/:nodeId/*`
   - **Issue**: No verification user owns project
   - **Fix**: Verify project belongs to user's installations

6. **Repo Sync - Missing Authorization**
   - **File**: `worker/src/index.ts`
   - **Endpoint**: `POST /api/repos/:owner/:name/sync`
   - **Issue**: Any authenticated user can sync any repo
   - **Fix**: Verify user has access to repo via installations

### Medium Priority Issues

7. **Webhook Signature Verification**
   - **Files**: `worker/src/index.ts`
   - **Issue**: GitHub/Linear webhook signatures not verified
   - **Fix**: Uncomment and implement signature verification

8. **Vectorize Search Authorization**
   - **File**: `worker/src/api/search.ts`
   - **Endpoint**: `/api/search/similar/:id`
   - **Issue**: No check user has access to source/result items
   - **Fix**: Filter vector results by user's repos

### Secure Components ✅

- MCP Server (all tools)
- `/api/repos/*` (repository listing)
- `/api/repos/:owner/:repo/issues/*`
- `/api/repos/:owner/:repo/milestones/*`
- `/api/linear/*` (Linear integration)
- `/api/me`, `/api/user/*` (user endpoints)
- Authentication middleware

## Recommendations

### Immediate Actions

1. **Fix Search API**
   ```typescript
   // In hybridSearch(), add user repos filter:
   const userRepos = await getUserReposForUser(env, auth.userId)
   const repoIds = userRepos.map(r => r.id)

   // In keyword search:
   where: {
     and: [
       { repo: { in: repoIds } },
       { or: [
         { title: { contains: query } },
         { body: { contains: query } },
       ]},
     ],
   }
   ```

2. **Add Auth to Sandbox/Terminal**
   ```typescript
   // In worker/src/index.ts:
   app.use('/api/sandbox/*', authMiddleware)
   app.use('/terminal/*', authMiddleware)
   ```

3. **Add Authorization to Project APIs**
   ```typescript
   // Verify project belongs to user's installations before accessing
   ```

4. **Remove or Secure Admin Endpoints**
   - Either add authentication or remove from production

### Architectural Improvements

1. **Centralized Authorization Helper**
   - Create shared `verifyRepoAccess(userId, repoFullName)` function
   - Use across all endpoints that access repo data

2. **Durable Object Access Control**
   - Consider adding user context to DO requests
   - DOs could validate access using Payload RPC

3. **Audit Logging**
   - Log all data access with user ID for compliance
   - Especially for cross-tenant operations

4. **Rate Limiting**
   - Implement per-user rate limits
   - Prevent enumeration attacks

### Testing Recommendations

1. **Create Test Users**
   - UserA with RepoA access
   - UserB with RepoB access
   - Verify UserA cannot access RepoB data

2. **Test All Endpoints**
   - Attempt cross-tenant access
   - Verify proper 403/404 responses

3. **Penetration Testing**
   - Test with expired/invalid tokens
   - Test parameter manipulation (different user IDs, repo names)

## Conclusion

The todo.mdx worker has a **solid foundation** for multi-tenant security with proper authentication and authorization in the MCP server and most API routes. However, there are **critical gaps** in the Search API, Sandbox/Terminal APIs, and some admin endpoints that allow cross-tenant data access.

**Priority**: Fix the Search API immediately as it allows direct data leakage. Add authentication to Sandbox/Terminal APIs to prevent unauthorized code execution.

The overall security model (User → Installations → Repos → Data) is sound and well-implemented in most places. The issues found are primarily **missing authorization checks** rather than fundamental architectural problems.

---

**Next Steps**:
1. Review this audit with the team
2. Create issues for each vulnerability
3. Implement fixes in priority order
4. Add integration tests for multi-tenant isolation
5. Consider security code review process for new endpoints
