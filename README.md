# DeployDiff

DeployDiff is a Visual Studio Code extension scaffold for comparing local files with deployed remote versions and syncing changes in either direction.

## Current bootstrap scope

- Deployment mappings stored in workspace settings.
- A mock transport that simulates remote files with configuration-backed content.
- An SFTP transport that reads connection settings from configuration and the password from VS Code Secret Storage.
- Commands for compare, upload, and download.
- Commands for storing and clearing the SFTP password.
- VS Code built-in diff editor integration for line-level comparison.

## Development

```bash
npm install
npm run build
npm test
```

## Example settings

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
  "deploydiff.sftp.privateKeyPath": "",
  "deploydiff.mockRemoteFiles": {
    "/var/www/app/src/example.ts": "console.log('remote');\n"
  }
}
```

For password-based SFTP authentication, run the command palette action `DeployDiff: Set SFTP Password`.