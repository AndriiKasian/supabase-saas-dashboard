<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Token Efficiency & Execution Rules

- Work only within the explicitly requested scope.
- Inspect relevant files and their direct dependencies before making changes.
- Do not repeatedly read unchanged files.
- Use targeted searches instead of dumping entire directories or large files.
- Consult external documentation only when the current API or behavior is uncertain.
- Prefer existing project patterns over new abstractions.
- Avoid speculative refactoring, unnecessary dependencies, and unrelated cleanup.
- Use targeted checks during development. Run the full typecheck, lint, and build suite once after the final changes.
- If a check fails, fix the issue and rerun the relevant checks.
- Do not repeat successful checks without a reason.
- Keep tool output concise and avoid printing large logs unless debugging requires them.
- Keep progress updates minimal.
- Final report: changed files, verification results, commit hash, and blockers — maximum 8 lines.
- Stop after the requested block. Never automatically start the next task.
- Never sacrifice correctness, security, or necessary verification to reduce token usage.