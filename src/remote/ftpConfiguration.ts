import * as vscode from 'vscode';
import { DeployDiffError } from '../errors/DeployDiffError';

export const DEPLOYDIFF_FTP_PASSWORD_SECRET_KEY = 'deploydiff.ftp.password';

export type FtpConnectionOptions = {
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean;
};

export async function getFtpConnectionOptions(
  workspaceFolder: vscode.WorkspaceFolder,
  secrets: vscode.SecretStorage
): Promise<FtpConnectionOptions> {
  const configuration = vscode.workspace.getConfiguration('deploydiff', workspaceFolder.uri);
  const host = configuration.get<string>('ftp.host', '').trim();
  const port = configuration.get<number>('ftp.port', 21);
  const user = configuration.get<string>('ftp.username', '').trim();
  const secure = configuration.get<boolean>('ftp.secure', false);
  const password = await secrets.get(DEPLOYDIFF_FTP_PASSWORD_SECRET_KEY);

  if (!host) {
    throw new DeployDiffError('DeployDiff FTP host is not configured. Add deploydiff.ftp.host in workspace settings.', [
      {
        label: 'Open Workspace Settings',
        commandId: 'workbench.action.openWorkspaceSettingsFile'
      }
    ]);
  }

  if (!user) {
    throw new DeployDiffError('DeployDiff FTP username is not configured. Add deploydiff.ftp.username in workspace settings.', [
      {
        label: 'Open Workspace Settings',
        commandId: 'workbench.action.openWorkspaceSettingsFile'
      }
    ]);
  }

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('DeployDiff FTP port must be a positive integer.');
  }

  if (!password) {
    throw new DeployDiffError('DeployDiff FTP authentication is not configured. Set a password with DeployDiff.', [
      {
        label: 'Set FTP Password',
        commandId: 'deploydiff.setFtpPassword'
      },
      {
        label: 'Open Workspace Settings',
        commandId: 'workbench.action.openWorkspaceSettingsFile'
      }
    ]);
  }

  return {
    host,
    port,
    user,
    password,
    secure
  };
}