import * as vscode from 'vscode';
import { RemoteFileMetadata, RemoteFileProvider } from './RemoteFileProvider';

type RemoteFileMap = Record<string, string>;

export class MockRemoteFileProvider implements RemoteFileProvider {
  public constructor(private readonly workspaceFolder: vscode.WorkspaceFolder) {}

  public createDirectory(): Promise<void> {
    return Promise.resolve();
  }

  public exists(remotePath: string): Promise<boolean> {
    return Promise.resolve(this.getRemoteFiles()[remotePath] !== undefined);
  }

  public stat(remotePath: string): Promise<RemoteFileMetadata> {
    const content = this.getRemoteFiles()[remotePath];
    if (content === undefined) {
      return Promise.reject(
        new Error(`Mock remote file not found for ${remotePath}. Add deploydiff.mockRemoteFiles in workspace settings.`)
      );
    }

    return Promise.resolve({
      size: Buffer.byteLength(content, 'utf8')
    });
  }

  public readFile(remotePath: string): Promise<string> {
    const files = this.getRemoteFiles();
    const content = files[remotePath];
    if (content === undefined) {
      return Promise.reject(new Error(
        `Mock remote file not found for ${remotePath}. Add deploydiff.mockRemoteFiles in workspace settings.`
      ));
    }

    return Promise.resolve(content);
  }

  public async writeFile(remotePath: string, content: string): Promise<void> {
    const files = this.getRemoteFiles();
    files[remotePath] = content;
    const configuration = vscode.workspace.getConfiguration('deploydiff', this.workspaceFolder.uri);
    await configuration.update('mockRemoteFiles', files, vscode.ConfigurationTarget.WorkspaceFolder);
  }

  private getRemoteFiles(): RemoteFileMap {
    const configuration = vscode.workspace.getConfiguration('deploydiff', this.workspaceFolder.uri);
    return {
      ...configuration.get<RemoteFileMap>('mockRemoteFiles', {})
    };
  }
}