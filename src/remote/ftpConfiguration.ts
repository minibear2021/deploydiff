import * as vscode from 'vscode';
import { AccessOptions } from 'basic-ftp';
import { DeployDiffError } from '../errors/DeployDiffError';

const LEGACY_DEPLOYDIFF_FTP_PASSWORD_SECRET_KEY = 'deploydiff.ftp.password';

export function getFtpPasswordSecretKey(workspaceFolder: vscode.WorkspaceFolder): string {
  return `deploydiff.ftp.password:${workspaceFolder.uri.toString()}`;
}

export async function getFtpPassword(
  secrets: vscode.SecretStorage,
  workspaceFolder: vscode.WorkspaceFolder
): Promise<string | undefined> {
  const key = getFtpPasswordSecretKey(workspaceFolder);
  let password = await secrets.get(key);
  if (password !== undefined) {
    return password;
  }
  const legacyPassword = await secrets.get(LEGACY_DEPLOYDIFF_FTP_PASSWORD_SECRET_KEY);
  if (legacyPassword !== undefined) {
    await secrets.store(key, legacyPassword);
    await secrets.delete(LEGACY_DEPLOYDIFF_FTP_PASSWORD_SECRET_KEY);
    return legacyPassword;
  }
  return undefined;
}

export type FtpSecurityMode = 'off' | 'explicit' | 'implicit';
export type FtpPassiveModeStrategy = 'default' | 'ignorePasvAddress';

export type FtpConnectionOptions = AccessOptions & {
  securityMode: FtpSecurityMode;
  passiveModeStrategy: FtpPassiveModeStrategy;
  timeoutMs: number;
};

export async function getFtpConnectionOptions(
  workspaceFolder: vscode.WorkspaceFolder,
  secrets: vscode.SecretStorage
): Promise<FtpConnectionOptions> {
  const configuration = vscode.workspace.getConfiguration('deploydiff', workspaceFolder.uri);
  const host = configuration.get<string>('ftp.host', '').trim();
  const port = configuration.get<number>('ftp.port', 21);
  const user = configuration.get<string>('ftp.username', '').trim();
  const configuredSecurityMode = configuration.get<string>('ftp.securityMode', '').trim();
  const secure = configuration.get<boolean>('ftp.secure', false);
  const passiveModeStrategy = configuration.get<FtpPassiveModeStrategy>('ftp.passiveModeStrategy', 'default');
  const timeoutMs = configuration.get<number>('ftp.timeoutMs', 10000);
  const password = await getFtpPassword(secrets, workspaceFolder);

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

  if (!Number.isInteger(timeoutMs) || timeoutMs < 0) {
    throw new Error('DeployDiff FTP timeout must be a non-negative integer in milliseconds.');
  }

  const securityMode = resolveSecurityMode(configuredSecurityMode, secure);

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
    secure: mapSecurityModeToSecureOption(securityMode),
    securityMode,
    passiveModeStrategy,
    timeoutMs
  };
}

function resolveSecurityMode(configuredSecurityMode: string, secure: boolean): FtpSecurityMode {
  if (configuredSecurityMode === 'off' || configuredSecurityMode === 'explicit' || configuredSecurityMode === 'implicit') {
    return configuredSecurityMode;
  }

  return secure ? 'explicit' : 'off';
}

function mapSecurityModeToSecureOption(securityMode: FtpSecurityMode): AccessOptions['secure'] {
  switch (securityMode) {
    case 'explicit':
      return true;
    case 'implicit':
      return 'implicit';
    case 'off':
    default:
      return false;
  }
}