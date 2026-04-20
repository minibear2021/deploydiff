# Changelog

## 1.0.1

- Store FTP and SFTP passwords per workspace instead of globally. Each open workspace now has its own isolated password entry, preventing cross-project password overwrites. Existing passwords are automatically migrated on first use.

## 1.0.0

- Support dropping a directory recursively compares all files inside it.

## 0.1.9

- Move the **Diff Sessions** view from the Activity Bar into the **File Explorer** sidebar for tighter workspace integration.
- Support dragging files from the Explorer onto the **Diff Sessions** list to open a compare directly.
- Test runner now uses the locally installed VS Code version instead of pinning an older release.

## 0.1.8

- Update version number.

## 0.1.6

- Add a **Diff Sessions** sidebar in the Activity Bar that tracks all active "Compare with Deployed Version" sessions.
- Add **Save All** action to the sidebar to batch-save unsaved changes across both local and remote diff panes.
- Support multi-select in the Explorer for **Compare with Deployed Version**, **Upload to Remote**, and **Download from Remote**.
- Sidebar items show a dirty indicator when local or remote documents have unsaved changes.
- Clicking a sidebar item reveals or re-opens the corresponding diff editor.
- Diff sessions are automatically removed from the sidebar when their diff tabs are closed.

## 0.1.5

- Remove the mock transport implementation and all related configuration, tests, and generated artifacts.
- Keep DeployDiff focused on the supported FTP and SFTP transport workflows.

## 0.1.4

- Add a dedicated `DeployDiff` output channel with detailed command and remote operation logging.
- Add `DeployDiff: Show Output Logs` plus a `Show Logs` error action so users can jump straight to diagnostic output.
- Stop defaulting `deploydiff.transport` to `mock`; the transport must now be set explicitly to avoid accidental mock lookups.
- Improve missing-transport errors with an `Open Settings` action that jumps to `deploydiff.transport`.

## 0.1.3

- Add recursive directory upload support for `Upload to Remote` from the Explorer.
- Add recursive directory download support for `Download from Remote` from the Explorer.
- Extend remote transport providers to distinguish files from directories and list remote directory contents.
- Document file and directory sync behavior in the README.

## 0.1.2

- Add advanced FTP options including explicit or implicit FTPS selection.
- Add passive mode strategy control for FTP servers with broken PASV address responses.
- Add configurable FTP timeout settings.

## 0.1.1

- Remove the `Refresh Deployed Version` command entirely from menus, command palette registration, implementation, and docs.
- Add automated GitHub Actions release flow: build, lint, test, package `.vsix`, publish to VS Code Marketplace when `package.json` version changes, and create or update the matching GitHub Release.
- Validate in CI that `CHANGELOG.md` contains a non-empty section for the current package version before publishing.
- Use changelog content as the GitHub Release body and keep uploaded `.vsix` assets updated on repeated release runs.
- Run extension tests in CI with `xvfb-run` so VS Code integration tests work on headless Linux runners.

## 0.1.0

- Add extension icon.
- Diff title simplified to `file ↔ file` without role labels.
- New status bar direction indicator shows which side is local/remote; auto-updates on swap.
- Users can now swap sides in the diff editor and use the built-in Revert Block for bidirectional sync.
- Remote diff pane is fully writable via a custom FileSystemProvider — standard Save applies changes to the remote server.
- Actionable error messages with quick-fix buttons (e.g. open settings, set password).
- Removed per-hunk Apply Hunk commands in favor of the swap + Revert Block workflow.
- Cleaned up editor title bar — no extension buttons clutter the toolbar.
- Bundled with esbuild for smaller package size.

## 0.0.1

- Initial public preview of DeployDiff.
- Compare local files against deployed remote content with VS Code's built-in diff editor.
- Support mock and SFTP transports.
- Support explicit upload, download, and deployed-version refresh actions.
- Add deployment mapping resolution, remote metadata loading, and basic sync conflict checks.
