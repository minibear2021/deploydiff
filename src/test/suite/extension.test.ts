import * as assert from 'node:assert';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { parseDeploymentMapping } from '../../config/deploymentConfiguration';
import { DeploymentMapping, resolveMappingForFile, toRemoteFilePath } from '../../deployment/mapping';

function createWorkspaceFolder(fsPath: string): vscode.WorkspaceFolder {
  return {
    uri: vscode.Uri.file(fsPath),
    name: path.basename(fsPath),
    index: 0
  };
}

suite('Deployment mapping', () => {
  test('prefers the most specific local root', () => {
    const workspaceFolder = createWorkspaceFolder('/workspace/app');
    const mappings: DeploymentMapping[] = [
      {
        name: 'broad',
        localRoot: '/workspace/app/src',
        remoteRoot: '/var/www/app/src'
      },
      {
        name: 'nested',
        localRoot: '/workspace/app/src/features',
        remoteRoot: '/var/www/app/features'
      }
    ];

    const target = resolveMappingForFile('/workspace/app/src/features/orders/index.ts', workspaceFolder, mappings);

    assert.equal(target.mapping.name, 'nested');
    assert.equal(target.relativePath, path.join('orders', 'index.ts'));
    assert.equal(target.remoteFilePath, '/var/www/app/features/orders/index.ts');
  });

  test('normalizes remote file path separators', () => {
    const mapping: DeploymentMapping = {
      name: 'app',
      localRoot: '/workspace/app/src',
      remoteRoot: '/srv/app/src/'
    };

    const remoteFilePath = toRemoteFilePath(mapping, '/workspace/app/src/lib/example.ts');

    assert.equal(remoteFilePath, '/srv/app/src/lib/example.ts');
  });

  test('rejects relative remote paths', () => {
    const workspaceFolder = createWorkspaceFolder('/workspace/app');

    assert.throws(
      () => parseDeploymentMapping(workspaceFolder, { name: 'bad', localPath: 'src', remotePath: 'srv/app' }, 0),
      /absolute POSIX path/
    );
  });
});

suite('Extension bootstrap', () => {
  test('commands are registered', async () => {
    const extension = vscode.extensions.getExtension('chen.deploydiff');
    assert.ok(extension);

    await extension.activate();

    const commands = await vscode.commands.getCommands(true);

    assert.ok(commands.includes('deploydiff.compareWithDeployedVersion'));
    assert.ok(commands.includes('deploydiff.uploadToRemote'));
    assert.ok(commands.includes('deploydiff.downloadFromRemote'));
  });
});