import * as vscode from 'vscode';
import { MockRemoteFileProvider } from './MockRemoteFileProvider';

export interface RemoteFileProvider {
  readFile(remotePath: string): Promise<string>;
  writeFile(remotePath: string, content: string): Promise<void>;
}

export function createRemoteFileProvider(workspaceFolder: vscode.WorkspaceFolder): RemoteFileProvider {
  const configuration = vscode.workspace.getConfiguration('deploydiff', workspaceFolder.uri);
  const transport = configuration.get<string>('transport', 'mock');

  switch (transport) {
    case 'mock':
      return new MockRemoteFileProvider(workspaceFolder);
    default:
      throw new Error(`Unsupported DeployDiff transport: ${transport}`);
  }
}