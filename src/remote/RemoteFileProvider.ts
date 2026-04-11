import * as vscode from 'vscode';
import { MockRemoteFileProvider } from './MockRemoteFileProvider';
import { SftpRemoteFileProvider } from './SftpRemoteFileProvider';
import { getSftpConnectionOptions } from './sftpConfiguration';

export type RemoteFileMetadata = {
  size: number;
  modifiedAt?: Date;
};

export interface RemoteFileProvider {
  exists(remotePath: string): Promise<boolean>;
  stat(remotePath: string): Promise<RemoteFileMetadata>;
  readFile(remotePath: string): Promise<string>;
  writeFile(remotePath: string, content: string): Promise<void>;
}

export async function createRemoteFileProvider(
  workspaceFolder: vscode.WorkspaceFolder,
  secrets: vscode.SecretStorage
): Promise<RemoteFileProvider> {
  const configuration = vscode.workspace.getConfiguration('deploydiff', workspaceFolder.uri);
  const transport = configuration.get<string>('transport', 'mock');

  switch (transport) {
    case 'mock':
      return new MockRemoteFileProvider(workspaceFolder);
    case 'sftp':
      return new SftpRemoteFileProvider(await getSftpConnectionOptions(workspaceFolder, secrets));
    default:
      throw new Error(`Unsupported DeployDiff transport: ${transport}`);
  }
}