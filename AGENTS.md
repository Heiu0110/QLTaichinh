# QLTaichinh / Sổ tiền

React + TypeScript strict + Vite + Tailwind + Dexie local-first PWA. Read README.md and docs/V1-SPEC.md before changing architecture. V1 uses VND integer money; dates on transactions are local calendar YYYY-MM-DD, metadata uses ISO UTC. Use UUID and soft delete for entities. Keep balance derived from transactions, and transfers neutral in income/expense reports.

UI accesses FinanceService/repository abstractions, not direct database tables. New database changes require a new Dexie schema version/migration. Backups must validate schema, unique IDs, references and safe money before atomically replacing data after explicit confirmation. Never put credentials or personal backup files in Git.

Use the existing isolated cloud checkout; do not create Git worktrees unless the user explicitly requests one. Install with npm ci (use --cache /workspace/.cache/npm if the default cache is unwritable). Node 24 LTS. Required checks for changes to data flows: npm test and npm run build. For UI/PWA changes also run npm run test:e2e after building. In Codex use PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium for the system browser. PWA is enabled in production builds, not the Vite development server.

Cloudflare Pages build command: npm run build, output: dist, production branch: main. No backend or cloud sync in V1. GitHub shares source code across machines; IndexedDB does not sync devices. Update docs when behavior or deployment status changes. Do not claim iPhone installation or production deployment verified until tested there.
