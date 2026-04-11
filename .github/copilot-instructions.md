# Project Guidelines

## Product Goal
Build a Visual Studio Code extension that provides IntelliJ-style deployed file comparison.
The core user flow is: map a remote deployment directory, right-click a local file, run Compare with Deployed Version, view a line-level diff, then sync in either direction from the diff workflow.

## Architecture
Keep the extension split into clear layers:
- VS Code integration: commands, menus, configuration, diff editor wiring, status and error messages.
- Deployment domain: path mapping, local-to-remote resolution, sync direction, conflict handling, and change metadata.
- Remote transport: a provider abstraction for remote file operations so SFTP, FTP, SSH, or mock transports can be added without rewriting command logic.
- Diff data flow: fetch remote content into a virtual or temporary document and use VS Code's built-in diff editor instead of implementing a custom line diff UI.

Prefer a structure like `src/extension.ts`, `src/commands/`, `src/deployment/`, `src/remote/`, `src/diff/`, and `src/test/` unless the codebase evolves differently for a clear reason.

## Conventions
Use TypeScript for extension code unless the repository is explicitly initialized another way.
Keep remote operations behind interfaces and inject them into commands and services so the diff and sync flows are testable without a live server.
Treat local and remote sync as explicit user actions. Do not overwrite either side implicitly after a compare.
Normalize paths at the deployment boundary and handle platform separators carefully because local paths may be macOS or Windows while remote paths are POSIX-style.
Store credentials and connection secrets in VS Code secret storage or an equivalent secure mechanism. Do not commit secrets or hardcode endpoints.
Prefer optimistic reads and explicit writes: compare should be safe and read-only, while upload and download operations should validate the target path and surface clear confirmation or conflict information.
When adding commands or settings, register them in the extension manifest and keep command ids and setting keys stable and namespaced.

## Build And Test
When initializing the project, add standard npm scripts for `build`, `watch`, `lint`, `test`, and `package` so agents can run them directly.
Favor unit tests for path mapping, remote path resolution, diff preparation, and sync decision logic.
Add integration tests for command registration and compare flow wiring with mocked remote providers before depending on live remote environments.
If a real remote test path is needed later, keep it opt-in and separate from default CI.

## Implementation Priorities
Prioritize the first end-to-end slice in this order:
1. Workspace configuration for deployment mappings.
2. Command to resolve the deployed counterpart of the active or selected file.
3. Read remote content through a transport abstraction.
4. Open VS Code diff view between local content and deployed content.
5. Add explicit upload and download actions with guardrails.

## Pitfalls
Do not couple remote fetching logic to tree views or UI code.
Do not build a custom diff engine unless a concrete VS Code limitation requires it.
Do not assume one deployment mapping per workspace; design for multiple mappings and clear matching rules.