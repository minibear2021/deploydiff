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
- **FTP and SFTP transports** — FTP supports password auth, and SFTP supports password or private-key auth. Passwords are stored in VS Code Secret Storage, never in settings files.
- **Multiple mappings** — Map several local directories to different remote roots within the same workspace.
- **Actionable errors** — Missing configuration? Error toasts include quick-fix buttons like "Open Settings" or "Set Password".

## Quick Start

1. Install the extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=minibear2021.deploydiff).
2. Open your workspace settings and add a deployment mapping:

```json
{
  "deploydiff.transport": "ftp",
  "deploydiff.mappings": [
    {
      "name": "app",
      "localPath": "src",
      "remotePath": "/var/www/app/src"
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

3. For FTP password auth, run **DeployDiff: Set FTP Password**. For SFTP password auth, run **DeployDiff: Set SFTP Password**.
4. Right-click a file in the Explorer → **Compare with Deployed Version**.
5. In the diff editor, use the swap button (↔) to flip sides, then **Revert Block** to push changes left or right. The status bar shows the current direction.

## Commands

| Command | Description |
|---|---|
| `DeployDiff: Compare with Deployed Version` | Open a diff between the local file and its deployed remote copy |
| `DeployDiff: Upload to Remote` | Push the local file to the remote server |
| `DeployDiff: Download from Remote` | Pull the remote file to the local workspace |
| `DeployDiff: Set FTP Password` | Store the FTP password in VS Code Secret Storage |
| `DeployDiff: Clear FTP Password` | Remove the stored FTP password |
| `DeployDiff: Set SFTP Password` | Store the SFTP password in VS Code Secret Storage |
| `DeployDiff: Clear SFTP Password` | Remove the stored SFTP password |

## Configuration

| Setting | Default | Description |
|---|---|---|
| `deploydiff.transport` | `mock` | Transport type: `mock`, `ftp`, or `sftp` |
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

FTP notes:

- `deploydiff.ftp.securityMode = implicit` enables legacy implicit FTPS for servers that do not support explicit TLS negotiation.
- DeployDiff uses passive FTP transfers. `deploydiff.ftp.passiveModeStrategy = ignorePasvAddress` forces the data connection to reuse the control host IP, which helps with some NAT or misconfigured server setups.

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