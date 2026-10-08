PROJECT: QLTaichinh / Sổ tiền
PHASE: V2 — Authentication + Multi-device Cloud Sync
MODEL RECOMMENDED: GPT-6 Astra, High reasoning

==================================================

1. OBJECTIVE
   \==================================================

Upgrade the existing V1 local-first finance PWA into a secure
multi-device local-first application.

Target devices:

- iPhone / iOS PWA
- Android PWA
- Windows/macOS browser/PWA

The same authenticated user must be able to use the same financial
dataset across multiple devices.

V2 MUST preserve offline-first behavior.

The application must continue working when Supabase or the Internet
is unavailable.

Architecture:

Device A
IndexedDB
│
├── Sync Engine
│
▼
Supabase
▲
│
├── Sync Engine
│
IndexedDB
Device B

Cloud is the synchronization layer.

IndexedDB remains the runtime/local source used by the UI.

DO NOT convert the application to cloud-first.

================================================== 2. READ EXISTING PROJECT FIRST
==================================================

Before modifying code, read:

README.md
AGENTS.md
docs/V1-SPEC.md
docs/HANDOFF.md
docs/VALIDATION.md

Inspect the existing implementation, especially:

src/types/models.ts
src/db/database.ts
src/db/repositories/
src/services/finance.ts
src/services/backup/
src/hooks/
tests/

Do not rewrite working V1 architecture unnecessarily.

Existing V1 invariants must remain valid.

================================================== 3. PRESERVE V1 FINANCIAL INVARIANTS
==================================================

Keep:

- React + TypeScript strict + Vite
- Dexie / IndexedDB
- repository/service architecture
- UUID entity IDs
- createdAt
- updatedAt
- deletedAt
- soft delete
- VND only
- integer money
- transaction calendar dates YYYY-MM-DD
- metadata timestamps ISO UTC
- account balances derived from transactions
- transfers neutral to income/expense totals
- existing budget/report semantics

Never use floating point for stored money.

Never modify Dexie schema version 1.

Any IndexedDB change must introduce a new version/migration.

================================================== 4. V2 TECHNOLOGY
==================================================

Frontend hosting:

Cloudflare Pages

Cloud/Auth layer:

Supabase

Use:

- Supabase Auth
- PostgreSQL
- Row Level Security
- database constraints
- server-controlled sync revision/version

Environment variables:

VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY

Never expose:

service_role key
database password
private secrets

Never hard-code credentials.

================================================== 5. AUTHENTICATION
==================================================

Implement:

- Sign up with email/password
- Sign in
- Sign out
- Password reset
- Session restoration

Google OAuth is NOT required in V2.

Local-only use must remain possible.

Authentication must not become mandatory for opening the application.

Two modes:

LOCAL ONLY

and

CLOUD SYNC ENABLED

================================================== 6. LOCAL DATA ISOLATION
==================================================

Financial data belonging to different authenticated users must never
share the same local database context.

Conceptually:

Guest/local-only:
sotien-local

User A:
user-scoped local database

User B:
separate user-scoped local database

Exact naming is implementation-defined.

When signing out:

- stop sync engine
- clear in-memory financial state
- close current user's database
- clear session-dependent state

Do NOT automatically erase the user's IndexedDB database.

A later explicit "Remove data from this device" action may delete it.

================================================== 7. MIGRATION FROM V1
==================================================

Do not lose existing V1 data.

When an existing V1 user enables sync for the first time:

Login
↓
Detect existing local V1 data
↓
Detect remote cloud state
↓
Ask user what to do

If:

local has data
cloud is empty

offer:

"Upload current device data to cloud"

If:

cloud has data
local legacy V1 also has data

DO NOT automatically merge.

Display safe options such as:

- Backup local data
- Replace local data with cloud
- Cancel

Do NOT deduplicate accounts/categories merely by matching their names.

V1 uses device-generated UUIDs, therefore identical names on two
independent devices do not imply identical entities.

Automatic merging of two unrelated V1 datasets is outside V2 scope.

================================================== 8. REMOTE DOMAIN TABLES
==================================================

Synchronize:

accounts
categories
transactions
budgets
savings_goals

Do NOT synchronize the current settings table wholesale.

Device-specific state such as:

schema version
sync cursor
device id
storage state

must remain local.

Each remote domain record must contain ownership:

user_id

and sync metadata conceptually equivalent to:

id
user_id
domain fields
created_at
updated_at
deleted_at
sync_version

Keep the local UUID as the remote entity ID.

Do not generate a second domain ID during upload.

================================================== 9. ROW LEVEL SECURITY
==================================================

RLS is mandatory.

Every cloud domain table must enforce ownership using auth.uid().

A user must only be able to:

SELECT own rows
INSERT own rows
UPDATE own rows

Do not rely only on frontend filtering.

User A must never be able to read or mutate User B's financial records.

================================================== 10. REFERENCE OWNERSHIP
==================================================

Foreign references must belong to the same authenticated user.

Examples:

transaction.accountId
transaction.toAccountId
transaction.categoryId
budget.categoryId

must never point to an entity owned by another user.

Use database-level ownership constraints, composite keys, functions,
or equivalent server-side validation.

Frontend checks alone are insufficient.

================================================== 11. SERVER VALIDATION
==================================================

Keep Zod frontend validation.

Also enforce important invariants on the database/server side.

Examples:

money is integer
money is within permitted range
currency is VND
transfer source != transfer destination
amount > 0 when required
budget constraints
ownership constraints

Do not trust arbitrary client payloads.

================================================== 12. DO NOT USE CLIENT CLOCK FOR CONFLICTS
==================================================

Do NOT implement:

latest updatedAt wins

Client clocks cannot be trusted to establish modification order.

updatedAt remains useful domain metadata.

Conflict detection must use a server-controlled revision/version.

================================================== 13. SERVER SYNC VERSION
==================================================

Implement a server-controlled monotonically increasing sync revision.

Concept:

sync_version BIGINT

It changes whenever a synchronized domain record is:

inserted
updated
soft-deleted

Client must not choose sync_version.

It should be assigned by PostgreSQL using a sequence/trigger/function
or an equivalent safe server mechanism.

Purpose:

client cursor = 152

pull records where:

sync_version > 152

ordered by:

sync_version ASC

================================================== 14. DEXIE V2 SYNC INFRASTRUCTURE
==================================================

Preserve version(1).

Add a Dexie migration/version containing local synchronization tables
conceptually equivalent to:

syncQueue
syncRemoteMeta
syncState
syncConflicts

Do not place all synchronization state directly inside financial
domain records unless genuinely necessary.

================================================== 15. OUTBOX / SYNC QUEUE
==================================================

Local financial writes must succeed immediately without Internet.

When a user creates/edits/deletes an entity:

FinanceService
↓
Dexie transaction
├── update domain record
└── create/update sync mutation

These operations must be atomic.

It must never be possible for:

domain write succeeds
but
sync queue write fails

Use an outbox pattern.

A queued mutation should contain at least:

mutationId
entityType
entityId
operation
baseVersion
createdAt
attempt count
last error

Supported operations:

upsert
delete

================================================== 16. COALESCE MUTATIONS
==================================================

Do not send:

edit A
edit A
edit A
edit A

as four unnecessary remote updates.

Pending changes for the same entity should be coalesced when safe.

Preserve the original remote baseVersion required for optimistic
concurrency.

================================================== 17. IDEMPOTENCY
==================================================

Every outbound mutation must have a stable UUID:

mutationId

Scenario:

client sends mutation
server applies mutation
network disconnects before response reaches client
client retries

The retry must NOT apply the mutation twice.

Implement server-side idempotency.

For example:

applied_mutations

or an equivalent design.

Do not implement synchronization as blind repeated upserts.

================================================== 18. OPTIMISTIC CONCURRENCY
==================================================

Store the latest known remote version for every synchronized entity.

Example:

transaction A
serverVersion = 10

User edits A offline.

Later client sends:

entity A
baseVersion = 10

Server should apply only if the current record version still matches
the expected version.

If server is already version 12:

return conflict

DO NOT silently overwrite version 12.

================================================== 19. INSERT CONCURRENCY
==================================================

New records use conceptually:

baseVersion = null

Insert succeeds only if that ID does not already exist for the same
user.

If the entity ID already exists:

return conflict/error

Do not silently overwrite.

================================================== 20. SOFT DELETE SYNC
==================================================

Continue using deletedAt.

Normal synchronization must not physically delete domain records.

Example:

iPhone deletes transaction
↓
local tombstone
↓
outbox
↓
remote tombstone
↓
PC pulls tombstone
↓
PC hides transaction

Do not purge tombstones in V2 core.

================================================== 21. PULL PROTOCOL
==================================================

Implement incremental synchronization.

Concept:

pullChanges(afterVersion, limit)

Return:

entityType
payload
syncVersion

ordered by syncVersion ascending.

Pagination is mandatory.

Do not download the entire database on every sync.

Initial bootstrap may perform a complete download but must still be
paginated.

================================================== 22. SYNC ENGINE
==================================================

Implement an isolated SyncCoordinator / SyncEngine.

Conceptual flow:

Acquire sync lock
↓
Validate authenticated user
↓
Push queued mutations
↓
Process successes/conflicts
↓
Pull remote changes after cursor
↓
Apply remote changes atomically
↓
Advance cursor
↓
Release lock

Exact push/pull ordering may differ if correctness requires it.

Correctness is more important than following this exact sequence.

================================================== 23. REMOTE APPLY MUST NOT LOOP
==================================================

When data received from Supabase is written into IndexedDB:

DO NOT create another outgoing mutation.

The application must distinguish:

local user mutation

from:

remote synchronization apply

Avoid sync loops.

================================================== 24. CONFLICT STORAGE
==================================================

Persist unresolved conflicts locally.

Concept:

SyncConflict {
id
entityType
entityId
localData
remoteData
baseVersion
remoteVersion
detectedAt
status
}

Do not discard either side of a conflict.

================================================== 25. CONFLICT UX
==================================================

Provide UI showing:

"Changes need your attention"

For each conflict show:

Local/device version
Cloud version

Allow:

Keep local version
Keep cloud version

Field-level merge is not required in V2.

Never silently choose based on updatedAt.

================================================== 26. CONFLICT RESOLUTION
==================================================

KEEP CLOUD:

replace local record with remote version
remove conflicting pending mutation
update stored server version
resolve conflict

KEEP LOCAL:

retain local desired state
use latest remoteVersion as new baseVersion
create a new outbound mutation
retry through normal optimistic concurrency

Do not bypass server concurrency checks.

================================================== 27. AUTOMATIC SYNC TRIGGERS
==================================================

When cloud sync is enabled, attempt synchronization on:

app startup
restored authenticated session
browser becomes online
application becomes visible/foreground
saved local mutation
manual "Sync now"

Debounce automatic mutation-triggered synchronization.

Do not sync on every keyboard input.

================================================== 28. IOS REQUIREMENT
==================================================

Do NOT depend on:

setInterval running forever
Background Sync API
continuous background JavaScript

iOS may suspend the PWA.

Correct synchronization must occur when the application next:

opens
returns to foreground
regains connectivity
or user presses Sync now

If the application remains closed for several days, it must still
synchronize correctly when reopened.

================================================== 29. RETRIES
==================================================

Network failure must not remove queued mutations.

Use bounded exponential backoff.

Manual Sync Now should allow immediate retry.

Do not retry aggressively forever.

================================================== 30. AUTH EXPIRATION
==================================================

If authentication expires:

local data remains usable
pending mutations remain preserved

Sync status becomes:

"Sign in again to synchronize"

After the same user signs in again:

resume synchronization

Never delete unsynchronized work due to expired auth.

================================================== 31. SYNC STATUS UI
==================================================

Add synchronization information to Settings.

Show:

signed-in account
online/offline status
last successful sync
pending mutation count
conflict count
sync errors

Possible states:

Synced
Syncing
Offline
Pending changes
Conflict
Sync error
Authentication required

Provide:

Sync now

A small global status indicator is acceptable.

Do not use disruptive popups for routine sync activity.

================================================== 32. BACKUP
==================================================

Keep the existing JSON export functionality.

Sync is NOT backup.

Do not include in user backup:

auth session
syncQueue
syncState
remote versions
sync conflicts
Supabase credentials

If domain backup schema remains unchanged, backup format does not
need to change solely because the app becomes V2.

================================================== 33. RESTORE WHILE SYNC ENABLED
==================================================

The existing full IndexedDB replacement workflow is unsafe while
cloud synchronization is active.

For V2 core:

disable full restore while sync is enabled

or require the user to disable sync first.

Explain clearly why.

Do not silently replace IndexedDB while a cloud sync session remains
active.

Cloud-aware restore can be implemented later.

================================================== 34. SECURITY
==================================================

Mandatory:

HTTPS
Supabase Auth
RLS
database constraints
no service_role in client
no credentials in repository
no financial record payloads in production logs

Do not log:

transaction notes
account names
financial amounts
full records

Technical sync diagnostics may use:

mutationId
entityType
status
error code

================================================== 35. CONTENT SECURITY POLICY
==================================================

Review Cloudflare headers / CSP.

Allow network connections only to required Supabase endpoints.

Do not use:

connect-src *

as a shortcut.

================================================== 36. PWA CACHE SAFETY
==================================================

Service Worker may cache application shell/static resources.

Do NOT stale-cache:

Supabase auth responses
Supabase REST responses
sync mutation responses

Financial offline data must come from IndexedDB, not HTTP caches.

================================================== 37. ENCRYPTION SCOPE
==================================================

Do not invent a custom encryption protocol.

TLS + Supabase Auth + RLS + proper server security are the V2
baseline.

Client-side end-to-end encryption is NOT part of V2 core.

Do not claim the application uses E2E encryption unless it actually
does.

================================================== 38. SOURCE ARCHITECTURE
==================================================

Keep UI independent of Supabase.

Suggested structure:

src/
├── auth/
│ ├── authService.ts
│ ├── AuthProvider.tsx
│ └── session.ts
│
├── sync/
│ ├── SyncCoordinator.ts
│ ├── SyncEngine.ts
│ ├── syncTypes.ts
│ ├── conflictService.ts
│ └── remote/
│ ├── RemoteSyncRepository.ts
│ └── SupabaseRemoteSyncRepository.ts
│
├── db/
│ ├── database.ts
│ ├── migrations/
│ └── repositories/
│
├── services/
└── ...

Exact filenames may differ.

Architecture boundaries must remain clear.

================================================== 39. SUPABASE CLIENT
==================================================

Create the Supabase client in one infrastructure module.

Do not initialize or directly query Supabase inside:

Dashboard
Transactions
Accounts
Reports
Budgets
Savings

UI continues consuming FinanceService/local state.

================================================== 40. REMOTE ABSTRACTION
==================================================

Create an abstraction equivalent to:

interface RemoteSyncRepository {
pushMutation(...): Promise<...>;
pullChanges(...): Promise<...>;
}

Production implementation:

SupabaseRemoteSyncRepository

Tests:

FakeRemoteSyncRepository

SyncEngine must not depend directly on React components.

================================================== 41. MULTI-TAB SAFETY
==================================================

Prevent unnecessary concurrent sync runs on the same browser where
possible.

Web Locks API may be used when available.

However correctness must rely on:

server idempotency
optimistic concurrency
RLS

not solely on a client-side lock.

================================================== 42. ERROR TYPES
==================================================

Distinguish at minimum:

network errors
authentication errors
validation errors
conflicts
server errors

Do not collapse all failures into:

"Something went wrong."

The user must know when financial data has not yet synchronized.

================================================== 43. NON-GOALS
==================================================

Do NOT implement during V2 core:

bank API integrations
automatic bank transaction import
OCR receipts
AI financial adviser
multi-currency
shared/family accounts
Google OAuth
investment portfolio tracking
advanced debt management
automatic merge of unrelated V1 databases
real-time collaboration
client-side E2E encryption
major UI redesign

These are future V3+ features.

================================================== 44. MILESTONES
==================================================

MILESTONE 0
Audit V1 and establish regression baseline.

Map:

all write paths
all IndexedDB access
repository boundaries
backup behavior
PWA behavior
existing tests

Before changing architecture run:

npm run typecheck
npm test
npm run build

If applicable:

npm run test:e2e

Do not claim iPhone/production behavior is verified unless actually
tested.

---

MILESTONE 1
Authentication foundation.

Implement:

Supabase client infrastructure
AuthService
AuthProvider
register
login
logout
password reset
session restoration

Do not implement domain sync yet.

---

MILESTONE 2
Supabase domain schema and security.

Implement:

domain tables
user ownership
RLS
FK / ownership constraints
sync revision
server-side validation
idempotency infrastructure

Test User A cannot access User B data.

---

MILESTONE 3
IndexedDB V2 migration.

Preserve database version 1.

Add synchronization tables and user-scoped database infrastructure.

Test upgrade from a real V1-shaped database.

---

MILESTONE 4
Atomic local outbox.

Every local domain mutation must update the domain record and outbox
within one Dexie transaction.

Application must remain fully usable offline.

---

MILESTONE 5
Remote sync adapter.

Implement:

push mutations
idempotency
optimistic concurrency
incremental pull
pagination

Use fake remote adapter for unit testing.

---

MILESTONE 6
Initial synchronization / V1 migration.

Implement:

legacy data detection
first-device upload
new-device download
safe user confirmations
no automatic destructive merge

---

MILESTONE 7
Continuous synchronization.

Implement:

startup sync
foreground sync
online sync
mutation-triggered sync
manual sync
backoff/retry
status UI

---

MILESTONE 8
Conflict handling.

Implement:

detect
persist
display
keep local
keep cloud

No silent last-write-wins.

---

MILESTONE 9
Security and PWA hardening.

Review:

RLS
ownership constraints
CSP
environment variables
logs
auth lifecycle
service worker caching
logout isolation

---

MILESTONE 10
Regression and multi-device validation.

================================================== 45. REQUIRED TEST SCENARIOS
==================================================

TEST A

PC online
create expense
sync
iPhone pulls
same transaction appears

TEST B

iPhone offline
create expense
close app
reopen
expense remains
Internet reconnects
sync occurs
PC receives transaction

TEST C

PC deletes transaction
sync
iPhone pulls tombstone
transaction disappears

TEST D

PC edits Transaction A
iPhone edits the same A while offline
PC syncs
iPhone reconnects

Expected:

conflict detected
no silent overwrite
both versions recoverable

TEST E

Server applies mutation
response is lost
client retries same mutation

Expected:

no duplicate
no false second update

TEST F

User A logs out
User B logs in

Expected:

User B never sees User A local financial data.

TEST G

User A attempts to query/update User B remote data.

Expected:

database/RLS denies access.

================================================== 46. REGRESSION REQUIREMENTS
==================================================

All existing V1 financial calculations must produce the same result
for the same dataset after V2.

Existing tests must remain.

Required checks:

npm run typecheck
npm test
npm run build

For PWA/UI changes:

npm run test:e2e

Do not delete or weaken existing tests merely to make V2 pass.

================================================== 47. DEFINITION OF DONE
==================================================

V2 is complete only when:

1. Existing V1 data survives upgrade.
2. Local-only mode still works.
3. Authentication works.
4. iPhone and PC can use the same account.
5. Initial dataset synchronizes to another device.
6. App works offline.
7. Offline writes survive reload.
8. Reconnection pushes pending changes.
9. Retry does not duplicate operations.
10. Soft delete synchronizes.
11. Existing financial calculations do not regress.
12. Same-record multi-device edits create a conflict.
13. No silent data loss occurs.
14. User A cannot access User B data.
15. Logout does not expose previous user's local data.
16. No privileged Supabase key exists in frontend.
17. PWA remains installable.
18. JSON backup remains functional.
19. Existing tests and new V2 tests pass.
20. Production build succeeds.
21. Sync status accurately communicates unsynchronized data.
22. iOS PWA foreground/reconnect behavior is manually validated.

================================================== 48. IMPLEMENTATION RULES
==================================================

Priorities:

1. financial data correctness
2. no data loss
3. authorization/security
4. offline reliability
5. synchronization correctness
6. testability
7. UX
8. visual polish

Do not rewrite working V1 components unnecessarily.

Do not implement all V2 work as one giant change.

Implement one milestone at a time.

After each milestone:

run typecheck
run relevant tests
run build

Run E2E when UI/PWA behavior changes.

Stop if core checks fail.

Do not hide bugs by changing tests.

Do not perform Git, branch, PR, merge, push, force-push, or other
repository operations unless explicitly requested by the user.

================================================== 49. FIRST RESPONSE REQUIRED FROM CODEX
==================================================

DO NOT MODIFY SOURCE CODE YET.

First inspect the repository and return:

1. Current V1 architecture summary
2. V1 write paths and data flow
3. Risks found in the current V1 implementation
4. Proposed V2 architecture
5. Exact Dexie v2 migration design
6. Per-user local database strategy
7. Supabase PostgreSQL schema
8. RLS/ownership design
9. Server sync-version mechanism
10. Outbox design
11. Idempotency mechanism
12. Optimistic-concurrency algorithm
13. Initial V1-to-cloud migration flow
14. Conflict resolution design
15. Backup/restore impact
16. PWA/iOS sync strategy
17. Files/modules expected to change
18. Test strategy
19. Security risks
20. Any contradictions or unsafe assumptions in this specification

Do not start implementation until this analysis is complete.

If any specification decision risks losing existing V1 user data,
explicitly flag it before implementation.
