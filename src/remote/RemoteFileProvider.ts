import * as vscode from 'vscode';
import { DeployDiffError } from '../errors/DeployDiffError';
import { DeployDiffLogger } from '../logging/outputLogger';
import { FtpRemoteFileProvider } from './FtpRemoteFileProvider';
import { getFtpConnectionOptions } from './ftpConfiguration';
import { MockRemoteFileProvider } from './MockRemoteFileProvider';
import { SftpRemoteFileProvider } from './SftpRemoteFileProvider';
import { getSftpConnectionOptions } from './sftpConfiguration';

export type RemoteFileMetadata = {
  type: 'file' | 'directory';
  size: number;
  modifiedAt?: Date;
};

export type RemoteDirectoryEntry = {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modifiedAt?: Date;
};

export interface RemoteFileProvider {
  createDirectory(remotePath: string): Promise<void>;
  exists(remotePath: string): Promise<boolean>;
  listDirectory(remotePath: string): Promise<RemoteDirectoryEntry[]>;
  stat(remotePath: string): Promise<RemoteFileMetadata>;
  readFile(remotePath: string): Promise<string>;
  writeFile(remotePath: string, content: string): Promise<void>;
}

export async function createRemoteFileProvider(
  workspaceFolder: vscode.WorkspaceFolder,
  secrets: vscode.SecretStorage,
  logger: DeployDiffLogger
): Promise<RemoteFileProvider> {
  const configuration = vscode.workspace.getConfiguration('deploydiff', workspaceFolder.uri);
  const transport = configuration.get<string>('transport');

  logger.info('Creating remote file provider', {
    workspaceFolder: workspaceFolder.name,
    transport
  });

  if (!transport) {
    throw new DeployDiffError(
      'DeployDiff requires "deploydiff.transport" to be set explicitly. Choose "ftp", "sftp", or "mock" in workspace settings.',
      [
        {
          label: 'Open Settings',
          commandId: 'workbench.action.openSettings',
          arguments: ['deploydiff.transport']
        }
      ]
    );
  }

  switch (transport) {
    case 'mock':
      return new MockRemoteFileProvider(workspaceFolder, logger);
    case 'ftp':
      return new FtpRemoteFileProvider(await getFtpConnectionOptions(workspaceFolder, secrets), logger);
    case 'sftp':
      return new SftpRemoteFileProvider(await getSftpConnectionOptions(workspaceFolder, secrets), logger);
    default:
      throw new Error(`Unsupported DeployDiff transport: ${transport}`);
  }
}
