import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import SftpClient from 'ssh2-sftp-client';
import { DeployDiffError } from '../errors/DeployDiffError';

export const DEPLOYDIFF_SFTP_PASSWORD_SECRET_KEY = 'deploydiff.sftp.password';

export type SftpConnectionOptions = SftpClient.ConnectOptions;

export async function getSftpConnectionOptions(
  workspaceFolder: vscode.WorkspaceFolder,
  secrets: vscode.SecretStorage
): Promise<SftpConnectionOptions> {
  const configuration = vscode.workspace.getConfiguration('deploydiff', workspaceFolder.uri);
  const host = configuration.get<string>('sftp.host', '').trim();
  const port = configuration.get<number>('sftp.port', 22);
  const username = configuration.get<string>('sftp.username', '').trim();
  const privateKeyPath = configuration.get<string>('sftp.privateKeyPath', '').trim();
  const password = await secrets.get(DEPLOYDIFF_SFTP_PASSWORD_SECRET_KEY);

  if (!host) {
    throw new DeployDiffError('DeployDiff SFTP host is not configured. Add deploydiff.sftp.host in workspace settings.', [
      {
        label: 'Open Workspace Settings',
        commandId: 'workbench.action.openWorkspaceSettingsFile'
      }
    ]);
  }

  if (!username) {
    throw new DeployDiffError(
      'DeployDiff SFTP username is not configured. Add deploydiff.sftp.username in workspace settings.',
      [
        {
          label: 'Open Workspace Settings',
          commandId: 'workbench.action.openWorkspaceSettingsFile'
        }
      ]
    );
  }

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('DeployDiff SFTP port must be a positive integer.');
  }

  const baseOptions: SftpConnectionOptions = {
    host,
    port,
    username,
    readyTimeout: 10000
  };

  if (privateKeyPath) {
    const resolvedPrivateKeyPath = path.isAbsolute(privateKeyPath)
      ? privateKeyPath
      : path.resolve(workspaceFolder.uri.fsPath, privateKeyPath);

    return {
      ...baseOptions,
      privateKey: await readFile(resolvedPrivateKeyPath, 'utf8')
    };
  }

  if (password) {
    return {
      ...baseOptions,
      password
    };
  }

  throw new DeployDiffError(
    'DeployDiff SFTP authentication is not configured. Set a password with DeployDiff or configure deploydiff.sftp.privateKeyPath.',
    [
      {
        label: 'Set SFTP Password',
        commandId: 'deploydiff.setSftpPassword'
      },
      {
        label: 'Open Workspace Settings',
        commandId: 'workbench.action.openWorkspaceSettingsFile'
      }
    ]
  );
}