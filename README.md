# DeployDiff

DeployDiff is a Visual Studio Code extension for comparing local files against deployed remote versions and syncing changes in either direction.

It targets the same core workflow people expect from IntelliJ IDEA, PyCharm, and WebStorm deployment tooling:

- Map a local directory to a deployed remote directory.
- Right-click a file and choose Compare with Deployed Version.
- Review a line-level diff in VS Code's built-in diff editor.
- Upload or download explicitly from the file context or diff workflow.

## Features

- Workspace-folder scoped deployment mappings.
- Built-in compare, upload, download, and refresh commands.
- Remote diff documents backed by a custom VS Code content provider.
- SFTP transport with password storage in VS Code Secret Storage.
- Conflict prompts when local and remote timestamps suggest an overwrite risk.
- Status bar display for the active deployment target and resolved remote path.

## Commands

- `DeployDiff: Compare with Deployed Version`
- `DeployDiff: Upload to Remote`
- `DeployDiff: Download from Remote`
- `DeployDiff: Refresh Deployed Version`
- `DeployDiff: Set SFTP Password`
- `DeployDiff: Clear SFTP Password`

## Configuration

DeployDiff stores mappings and transport settings at the workspace-folder resource scope.

Example settings:

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
  "deploydiff.sftp.username": "deploy",
  "deploydiff.sftp.privateKeyPath": ""
}
```

For password-based SFTP authentication, run `DeployDiff: Set SFTP Password` from the command palette.

## Usage

1. Configure at least one `deploydiff.mappings` entry.
2. Choose a transport. Use `mock` for local testing or `sftp` for a real deployed target.
3. If using SFTP password authentication, store the password with `DeployDiff: Set SFTP Password`.
4. In the explorer, right-click a file and run `Compare with Deployed Version`.
5. Use `Upload to Remote`, `Download from Remote`, or `Refresh Deployed Version` as needed.

## Security

- DeployDiff does not store SFTP passwords in workspace settings.
- Passwords are written to VS Code Secret Storage.
- Private key authentication can be configured with `deploydiff.sftp.privateKeyPath`.

## Current Limitations

- SFTP is the only real remote transport currently implemented.
- Marketplace branding assets such as an icon and screenshots are not included yet.
- Sync conflict handling is timestamp-based and does not yet include a full conflict resolution UI.

## Development

```bash
npm install
npm run build
npm run lint
npm test
npm run package
```