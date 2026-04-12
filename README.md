# DeployDiff

![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/minibear2021.deploydiff)
![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/minibear2021.deploydiff)
![License](https://img.shields.io/github/license/minibear2021/deploydiff)

Compare local files against deployed remote versions and sync changes in either direction — the IntelliJ-style deployment diff experience, inside VS Code.

## Features

- **Compare with Deployed Version** — Open VS Code's built-in diff editor to see line-level differences between any local file and its deployed counterpart.
- **Bidirectional sync** — Swap the diff sides and use VS Code's native Revert Block to push changes in either direction. A status bar indicator always shows which side is local and which is remote.
- **Writable remote pane** — Edit the remote side directly in the diff editor; saving writes back to the server.
- **Upload / Download** — Explicit one-click commands from the explorer or editor context menu with conflict detection.
- **SFTP transport** — Password or private-key authentication. Passwords are stored in VS Code Secret Storage, never in settings files.
- **Multiple mappings** — Map several local directories to different remote roots within the same workspace.
- **Actionable errors** — Missing configuration? Error toasts include quick-fix buttons like "Open Settings" or "Set Password".

## Quick Start

1. Install the extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=minibear2021.deploydiff).
2. Open your workspace settings and add a deployment mapping:

```json
{
  "deploydiff.transport": "sftp",
  "deploydiff.mappings": [
    {
      "name": "app",
      "localPath": "src",
      "remotePath": "/var/www/app/src"
    }
  ],
  "deploydiff.sftp.host": "example.com",
  "deploydiff.sftp.port": 22,
  "deploydiff.sftp.username": "deploy"
}
```

3. For password auth, run **DeployDiff: Set SFTP Password** from the Command Palette.
4. Right-click a file in the Explorer → **Compare with Deployed Version**.
5. In the diff editor, use the swap button (↔) to flip sides, then **Revert Block** to push changes left or right. The status bar shows the current direction.

## Commands

| Command | Description |
|---|---|
| `DeployDiff: Compare with Deployed Version` | Open a diff between the local file and its deployed remote copy |
| `DeployDiff: Upload to Remote` | Push the local file to the remote server |
| `DeployDiff: Download from Remote` | Pull the remote file to the local workspace |
| `DeployDiff: Refresh Deployed Version` | Re-fetch the remote content in an open diff |
| `DeployDiff: Set SFTP Password` | Store the SFTP password in VS Code Secret Storage |
| `DeployDiff: Clear SFTP Password` | Remove the stored SFTP password |

## Configuration

| Setting | Default | Description |
|---|---|---|
| `deploydiff.transport` | `mock` | Transport type: `mock` (local testing) or `sftp` |
| `deploydiff.mappings` | `[]` | Array of `{ name, localPath, remotePath }` mapping objects |
| `deploydiff.confirmSync` | `true` | Prompt before overwriting during upload/download |
| `deploydiff.sftp.host` | `""` | SFTP hostname or IP |
| `deploydiff.sftp.port` | `22` | SFTP port |
| `deploydiff.sftp.username` | `""` | SFTP username |
| `deploydiff.sftp.privateKeyPath` | `""` | Path to a private key file (optional) |

## Security

- SFTP passwords are stored in VS Code Secret Storage, never written to settings files.
- Private key authentication is supported via `deploydiff.sftp.privateKeyPath`.
- All remote writes require explicit user action — compare is always read-only.

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