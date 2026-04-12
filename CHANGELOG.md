# Changelog

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