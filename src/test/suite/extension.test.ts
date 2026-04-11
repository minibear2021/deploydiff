import * as assert from 'node:assert';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { parseDeploymentMapping } from '../../config/deploymentConfiguration';
import { DeploymentMapping, resolveMappingForFile, toRemoteFilePath } from '../../deployment/mapping';
import {
  createRemoteDocumentUri,
  DEPLOYDIFF_REMOTE_DOCUMENT_SCHEME,
  getLocalFileUriFromRemoteDocumentUri,
  isRemoteDocumentUri
} from '../../diff/remoteDiffDocumentProvider';
import { getRemoteParentDirectory } from '../../remote/SftpRemoteFileProvider';
import { DEPLOYDIFF_SFTP_PASSWORD_SECRET_KEY, getSftpConnectionOptions } from '../../remote/sftpConfiguration';
import { detectSyncConflict } from '../../sync/conflictDetection';
import { DeployDiffExtensionApi } from '../../extension';
import { MockRemoteFileProvider } from '../../remote/MockRemoteFileProvider';

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

suite('Remote diff document URI', () => {
  test('round-trips the local file URI', () => {
    const localUri = vscode.Uri.file('/workspace/app/src/example.ts');
    const remoteUri = createRemoteDocumentUri(localUri);

    assert.equal(remoteUri.scheme, DEPLOYDIFF_REMOTE_DOCUMENT_SCHEME);
    assert.equal(isRemoteDocumentUri(remoteUri), true);
    assert.equal(getLocalFileUriFromRemoteDocumentUri(remoteUri).toString(), localUri.toString());
  });
});

suite('SFTP path helpers', () => {
  test('derives the remote parent directory', () => {
    assert.equal(getRemoteParentDirectory('/var/www/app/src/example.ts'), '/var/www/app/src');
    assert.equal(getRemoteParentDirectory('/example.ts'), '/');
  });
});

suite('Sync conflict detection', () => {
  test('flags upload when the remote file is newer', () => {
    const result = detectSyncConflict(
      'upload',
      new Date('2026-04-11T10:00:00.000Z'),
      { size: 10, modifiedAt: new Date('2026-04-11T11:00:00.000Z') }
    );

    assert.match(result ?? '', /deployed file was modified after the local file/i);
  });

  test('flags download when the local file is newer', () => {
    const result = detectSyncConflict(
      'download',
      new Date('2026-04-11T12:00:00.000Z'),
      { size: 10, modifiedAt: new Date('2026-04-11T11:00:00.000Z') }
    );

    assert.match(result ?? '', /local file was modified after the deployed file/i);
  });

  test('ignores conflicts when remote modified time is unavailable', () => {
    const result = detectSyncConflict('upload', new Date('2026-04-11T12:00:00.000Z'), { size: 10 });

    assert.equal(result, undefined);
  });
});

suite('Mock remote provider', () => {
  test('reports file existence from workspace configuration', async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(workspaceFolder);

    const configuration = vscode.workspace.getConfiguration('deploydiff', workspaceFolder.uri);
    await configuration.update(
      'mockRemoteFiles',
      {
        '/var/www/app/src/example.ts': 'remote-content'
      },
      vscode.ConfigurationTarget.WorkspaceFolder
    );

    const provider = new MockRemoteFileProvider(workspaceFolder);

    assert.equal(await provider.exists('/var/www/app/src/example.ts'), true);
    assert.equal(await provider.exists('/var/www/app/src/missing.ts'), false);
  });

  test('returns byte-size metadata for configured files', async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(workspaceFolder);

    const provider = new MockRemoteFileProvider(workspaceFolder);
    const metadata = await provider.stat('/var/www/app/src/example.ts');

    assert.equal(metadata.size, Buffer.byteLength('remote-content', 'utf8'));
    assert.equal(metadata.modifiedAt, undefined);
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
    assert.ok(commands.includes('deploydiff.setSftpPassword'));
    assert.ok(commands.includes('deploydiff.clearSftpPassword'));
    assert.ok(commands.includes('deploydiff.refreshDeployedVersion'));
  });
});

suite('SFTP configuration', () => {
  test('builds password-based options from workspace config and secrets', async () => {
    const extension = vscode.extensions.getExtension('chen.deploydiff');
    assert.ok(extension);

    const api = (await extension.activate()) as DeployDiffExtensionApi;

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(workspaceFolder);

    const configuration = vscode.workspace.getConfiguration('deploydiff', workspaceFolder.uri);
    await configuration.update('sftp.host', 'example.com', vscode.ConfigurationTarget.WorkspaceFolder);
    await configuration.update('sftp.port', 2222, vscode.ConfigurationTarget.WorkspaceFolder);
    await configuration.update('sftp.username', 'deploy', vscode.ConfigurationTarget.WorkspaceFolder);
    await configuration.update('sftp.privateKeyPath', '', vscode.ConfigurationTarget.WorkspaceFolder);
    await api.secrets.store(DEPLOYDIFF_SFTP_PASSWORD_SECRET_KEY, 'secret');

    const options = await getSftpConnectionOptions(workspaceFolder, api.secrets);

    assert.equal(options.host, 'example.com');
    assert.equal(options.port, 2222);
    assert.equal(options.username, 'deploy');
    assert.equal(options.password, 'secret');

    await api.secrets.delete(DEPLOYDIFF_SFTP_PASSWORD_SECRET_KEY);
  });
});