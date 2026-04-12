import * as vscode from 'vscode';
import { RemoteDirectoryEntry, RemoteFileMetadata, RemoteFileProvider } from './RemoteFileProvider';

type RemoteFileMap = Record<string, string>;

export class MockRemoteFileProvider implements RemoteFileProvider {
  public constructor(private readonly workspaceFolder: vscode.WorkspaceFolder) {}

  public createDirectory(): Promise<void> {
    return Promise.resolve();
  }

  public exists(remotePath: string): Promise<boolean> {
    const files = this.getRemoteFiles();
    const normalizedPath = normalizeRemotePath(remotePath);
    return Promise.resolve(
      files[normalizedPath] !== undefined || Object.keys(files).some((key) => key.startsWith(`${normalizedPath}/`))
    );
  }

  public listDirectory(remotePath: string): Promise<RemoteDirectoryEntry[]> {
    const files = this.getRemoteFiles();
    const normalizedPath = normalizeRemotePath(remotePath);
    const prefix = normalizedPath === '/' ? '/' : `${normalizedPath}/`;
    const entries = new Map<string, RemoteDirectoryEntry>();

    for (const [filePath, content] of Object.entries(files)) {
      if (!filePath.startsWith(prefix) || filePath === normalizedPath) {
        continue;
      }

      const remainder = filePath.slice(prefix.length);
      const [firstSegment, ...rest] = remainder.split('/');
      if (!firstSegment) {
        continue;
      }

      if (rest.length === 0) {
        entries.set(firstSegment, {
          name: firstSegment,
          type: 'file',
          size: Buffer.byteLength(content, 'utf8')
        });
        continue;
      }

      if (!entries.has(firstSegment)) {
        entries.set(firstSegment, {
          name: firstSegment,
          type: 'directory',
          size: 0
        });
      }
    }

    return Promise.resolve([...entries.values()].sort((left, right) => left.name.localeCompare(right.name)));
  }

  public stat(remotePath: string): Promise<RemoteFileMetadata> {
    const files = this.getRemoteFiles();
    const normalizedPath = normalizeRemotePath(remotePath);
    const content = files[normalizedPath];
    if (content !== undefined) {
      return Promise.resolve({
        type: 'file',
        size: Buffer.byteLength(content, 'utf8')
      });
    }

    if (Object.keys(files).some((key) => key.startsWith(`${normalizedPath}/`))) {
      return Promise.resolve({
        type: 'directory',
        size: 0
      });
    }

    if (normalizedPath === '/' && Object.keys(files).length > 0) {
      return Promise.resolve({
        type: 'directory',
        size: 0
      });
    }

    return Promise.reject(
      new Error(`Mock remote file not found for ${remotePath}. Add deploydiff.mockRemoteFiles in workspace settings.`)
    );
  }

  public readFile(remotePath: string): Promise<string> {
    const files = this.getRemoteFiles();
    const normalizedPath = normalizeRemotePath(remotePath);
    const content = files[normalizedPath];
    if (content === undefined) {
      return Promise.reject(
        new Error(`Mock remote file not found for ${remotePath}. Add deploydiff.mockRemoteFiles in workspace settings.`)
      );
    }

    return Promise.resolve(content);
  }

  public async writeFile(remotePath: string, content: string): Promise<void> {
    const files = this.getRemoteFiles();
    files[normalizeRemotePath(remotePath)] = content;
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

function normalizeRemotePath(remotePath: string): string {
  const normalizedPath = remotePath.replace(/\/+/g, '/');
  if (normalizedPath === '/') {
    return '/';
  }

  return normalizedPath.replace(/\/+$/, '');
}