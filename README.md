# DeployDiff

DeployDiff is a Visual Studio Code extension scaffold for comparing local files with deployed remote versions and syncing changes in either direction.

## Current bootstrap scope

- Deployment mappings stored in workspace settings.
- A mock transport that simulates remote files with configuration-backed content.
- Commands for compare, upload, and download.
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
  "deploydiff.mappings": [
    {
      "name": "app",
      "localPath": "src",
      "remotePath": "/var/www/app/src"
    }
  ],
  "deploydiff.mockRemoteFiles": {
    "/var/www/app/src/example.ts": "console.log('remote');\n"
  }
}
```