# DeployDiff

![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/minibear2021.deploydiff)
![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/minibear2021.deploydiff)
![License](https://img.shields.io/github/license/minibear2021/deploydiff)

Compare local files against deployed remote versions and sync changes in either direction — the IntelliJ-style deployment diff experience, inside VS Code.

## Features

- **Compare with Deployed Version** — Open VS Code's built-in diff editor to see line-level differences between any local file and its deployed counterpart.
- **Diff Sessions sidebar** — View all active compares in one place, switch between diffs with a click, and remove sessions when you're done.
- **Save All** — Batch-save unsaved changes across every open diff session in one action, for both local and remote documents.
- **Bidirectional sync** — Swap the diff sides and use VS Code's native Revert Block to push changes in either direction. A status bar indicator always shows which side is local and which is remote.
- **Writable remote pane** — Edit the remote side directly in the diff editor; saving writes back to the server.
- **Upload / Download for files and directories** — Explicit one-click sync commands from the explorer or editor context menu with conflict detection. Directory sync works recursively. Supports multi-select in the Explorer.
- **FTP and SFTP transports** — FTP supports password auth plus explicit or implicit FTPS options, and SFTP supports password or private-key auth. Passwords are stored in VS Code Secret Storage, never in settings files.
- **Multiple mappings** — Map several local directories to different remote roots within the same workspace.
- **Output logging for troubleshooting** — Remote compare/sync operations write detailed diagnostics to the `DeployDiff` output channel, with quick access from error toasts.
- **Actionable errors** — Missing configuration? Error toasts include quick-fix buttons like "Open Settings", "Set Password", or "Show Logs".

## Quick Start

1. Install the extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=minibear2021.deploydiff).
2. Open your workspace settings and configure `deploydiff.transport` explicitly as `ftp` or `sftp`, plus one or more deployment mappings.

FTP example:

```json
{
  "deploydiff.transport": "ftp",
  "deploydiff.mappings": [
    {
      "name": "app-src",
      "localPath": "src",
      "remotePath": "/var/www/app/src"
    },
    {
      "name": "app-assets",
      "localPath": "public",
      "remotePath": "/var/www/app/public"
    }
  ],
  "deploydiff.ftp.host": "example.com",
  "deploydiff.ftp.port": 21,
  "deploydiff.ftp.username": "deploy",
  "deploydiff.ftp.securityMode": "implicit",
  "deploydiff.ftp.passiveModeStrategy": "ignorePasvAddress",
  "deploydiff.ftp.timeoutMs": 10000
}
```

SFTP example:

```json
{
  "deploydiff.transport": "sftp",
  "deploydiff.mappings": [
    {
      "name": "backend-src",
      "localPath": "packages/backend/src",
      "remotePath": "/srv/backend/src"
    },
    {
      "name": "frontend-dist",
      "localPath": "packages/frontend/dist",
      "remotePath": "/srv/frontend/dist"
    }
  ],
  "deploydiff.sftp.host": "example.com",
  "deploydiff.sftp.port": 22,
  "deploydiff.sftp.username": "deploy",
  "deploydiff.sftp.privateKeyPath": "~/.ssh/id_ed25519"
}
```

3. For FTP password auth, run **DeployDiff: Set FTP Password**. For SFTP password auth, run **DeployDiff: Set SFTP Password** if you are not using `deploydiff.sftp.privateKeyPath`.
4. Right-click a file in the Explorer → **Compare with Deployed Version**. You can also select multiple files and compare them all at once.
5. To sync directly, right-click a file or directory and use **Upload to Remote** or **Download from Remote**. Multi-select is supported for both actions.
6. Open the **DeployDiff** sidebar to see all active diff sessions, switch between them, or click **Save All** to persist every unsaved change in one go.
7. If a compare or sync fails, use **DeployDiff: Show Output Logs** or the toast action to inspect the detailed log output.
8. In the diff editor, use the swap button (↔) to flip sides, then **Revert Block** to push changes left or right. The status bar shows the current direction.

## Commands

| Command | Description |
|---|---|
| `DeployDiff: Compare with Deployed Version` | Open a diff between the local file(s) and their deployed remote copies |
| `DeployDiff: Upload to Remote` | Push the selected local file(s) or directory to the remote server |
| `DeployDiff: Download from Remote` | Pull the remote file(s) or directory to the local workspace |
| `DeployDiff: Set FTP Password` | Store the FTP password in VS Code Secret Storage |
| `DeployDiff: Clear FTP Password` | Remove the stored FTP password |
| `DeployDiff: Show Output Logs` | Open the DeployDiff output channel |
| `DeployDiff: Set SFTP Password` | Store the SFTP password in VS Code Secret Storage |
| `DeployDiff: Clear SFTP Password` | Remove the stored SFTP password |
| `DeployDiff: Open Diff Session` | Reveal a tracked diff session from the sidebar |
| `DeployDiff: Save All` | Save all unsaved local and remote changes across tracked diff sessions |
| `DeployDiff: Remove` | Manually remove a session from the Diff Sessions sidebar |

## Configuration

| Setting | Default | Description |
|---|---|---|
| `deploydiff.transport` | Required | Transport type: `ftp` or `sftp`. Must be set explicitly |
| `deploydiff.mappings` | `[]` | Array of `{ name, localPath, remotePath }` mapping objects |
| `deploydiff.confirmSync` | `true` | Prompt before overwriting during upload/download |
| `deploydiff.ftp.host` | `""` | FTP hostname or IP |
| `deploydiff.ftp.port` | `21` | FTP port |
| `deploydiff.ftp.username` | `""` | FTP username |
| `deploydiff.ftp.securityMode` | `off` | FTP security mode: `off`, `explicit`, or `implicit` |
| `deploydiff.ftp.passiveModeStrategy` | `default` | Passive mode strategy. `ignorePasvAddress` helps with NAT-broken PASV responses |
| `deploydiff.ftp.timeoutMs` | `10000` | FTP timeout in milliseconds |
| `deploydiff.sftp.host` | `""` | SFTP hostname or IP |
| `deploydiff.sftp.port` | `22` | SFTP port |
| `deploydiff.sftp.username` | `""` | SFTP username |
| `deploydiff.sftp.privateKeyPath` | `""` | Path to a private key file (optional) |

## Security

- FTP and SFTP passwords are stored in VS Code Secret Storage, never written to settings files.
- Private key authentication is supported via `deploydiff.sftp.privateKeyPath`.
- All remote writes require explicit user action — compare is always read-only.
- When an operation fails, open **DeployDiff: Show Output Logs** to inspect the recorded remote path, command flow, and error details.

FTP notes:

- `deploydiff.ftp.securityMode = implicit` enables legacy implicit FTPS for servers that do not support explicit TLS negotiation.
- DeployDiff uses passive FTP transfers. `deploydiff.ftp.passiveModeStrategy = ignorePasvAddress` forces the data connection to reuse the control host IP, which helps with some NAT or misconfigured server setups.

Directory sync notes:

- `Upload to Remote` supports directories and uploads them recursively, creating remote directories as needed.
- `Download from Remote` supports directories and downloads them recursively, creating local directories as needed.
- Directory download is additive: it pulls remote files and folders into the local directory tree, but does not delete extra local files.

## Development

```bash
npm install
npm run build
npm run lint
npm test
npm run package
```

## License

[MIT](LICENSE)
