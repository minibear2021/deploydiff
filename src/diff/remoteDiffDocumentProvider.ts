import * as vscode from 'vscode';
import { resolveDeploymentTarget } from '../config/deploymentConfiguration';
import { DeployDiffError } from '../errors/DeployDiffError';
import { createRemoteFileProvider, RemoteFileMetadata } from '../remote/RemoteFileProvider';

export const DEPLOYDIFF_REMOTE_DOCUMENT_SCHEME = 'deploydiff-remote';

export function isRemoteDocumentUri(uri: vscode.Uri): boolean {
  return uri.scheme === DEPLOYDIFF_REMOTE_DOCUMENT_SCHEME;
}

export function createRemoteDocumentUri(localFileUri: vscode.Uri): vscode.Uri {
  return vscode.Uri.from({
    scheme: DEPLOYDIFF_REMOTE_DOCUMENT_SCHEME,
    path: localFileUri.path,
    query: encodeURIComponent(localFileUri.toString())
  });
}

export function getLocalFileUriFromRemoteDocumentUri(remoteUri: vscode.Uri): vscode.Uri {
  if (!isRemoteDocumentUri(remoteUri)) {
    throw new Error('The provided URI is not a DeployDiff remote document.');
  }

  const localUri = decodeURIComponent(remoteUri.query);
  return vscode.Uri.parse(localUri);
}

export class RemoteDiffDocumentProvider implements vscode.FileSystemProvider {
  private readonly didChangeFileEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  private readonly cache = new Map<string, string>();
  private readonly metadataCache = new Map<string, RemoteFileMetadata>();

  public constructor(private readonly secrets: vscode.SecretStorage) {}

  public readonly onDidChangeFile = this.didChangeFileEmitter.event;

  public watch(): vscode.Disposable {
    return new vscode.Disposable(() => undefined);
  }

  public async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    const metadata = await this.loadRemoteState(uri);

    return {
      type: vscode.FileType.File,
      ctime: 0,
      mtime: metadata.modifiedAt?.getTime() ?? Date.now(),
      size: metadata.size
    };
  }

  public async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const cached = this.cache.get(uri.toString());
    if (cached !== undefined) {
      return Buffer.from(cached, 'utf8');
    }

    await this.loadRemoteState(uri);
    return Buffer.from(this.cache.get(uri.toString()) ?? '', 'utf8');
  }

  public async writeFile(uri: vscode.Uri, content: Uint8Array): Promise<void> {
    const localFileUri = getLocalFileUriFromRemoteDocumentUri(uri);
    const target = resolveDeploymentTarget(localFileUri);
    const provider = await createRemoteFileProvider(target.workspaceFolder, this.secrets);
    const nextContent = Buffer.from(content).toString('utf8');

    await provider.writeFile(target.remoteFilePath, nextContent);

    const metadata = await provider.stat(target.remoteFilePath);
    this.cache.set(uri.toString(), nextContent);
    this.metadataCache.set(uri.toString(), metadata);
    this.didChangeFileEmitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
  }

  public readDirectory(): [string, vscode.FileType][] {
    return [];
  }

  public createDirectory(): void {
    throw vscode.FileSystemError.NoPermissions('DeployDiff remote documents do not support directory creation here.');
  }

  public delete(): void {
    throw vscode.FileSystemError.NoPermissions('DeployDiff remote documents do not support delete from the editor.');
  }

  public rename(): void {
    throw vscode.FileSystemError.NoPermissions('DeployDiff remote documents do not support rename from the editor.');
  }

  public async preload(localFileUri: vscode.Uri): Promise<RemoteFileMetadata> {
    const remoteUri = createRemoteDocumentUri(localFileUri);
    return this.loadRemoteState(remoteUri);
  }

  public refresh(localFileUri: vscode.Uri): void {
    const remoteUri = createRemoteDocumentUri(localFileUri);
    this.cache.delete(remoteUri.toString());
    this.metadataCache.delete(remoteUri.toString());
    this.didChangeFileEmitter.fire([{ type: vscode.FileChangeType.Changed, uri: remoteUri }]);
  }

  public dispose(): void {
    this.cache.clear();
    this.metadataCache.clear();
    this.didChangeFileEmitter.dispose();
  }

  public getCachedMetadata(localFileUri: vscode.Uri): RemoteFileMetadata | undefined {
    return this.metadataCache.get(createRemoteDocumentUri(localFileUri).toString());
  }

  public getCachedContent(localFileUri: vscode.Uri): string | undefined {
    return this.cache.get(createRemoteDocumentUri(localFileUri).toString());
  }

  private async loadRemoteState(uri: vscode.Uri): Promise<RemoteFileMetadata> {
    const localFileUri = getLocalFileUriFromRemoteDocumentUri(uri);
    const target = resolveDeploymentTarget(localFileUri);
    const provider = await createRemoteFileProvider(target.workspaceFolder, this.secrets);

    if (!(await provider.exists(target.remoteFilePath))) {
      throw new DeployDiffError(
        `No deployed file exists at ${target.remoteFilePath}. Upload the local file first to create it.`,
        [
          {
            label: 'Upload to Remote',
            commandId: 'deploydiff.uploadToRemote',
            arguments: [localFileUri]
          }
        ]
      );
    }

    const metadata = await provider.stat(target.remoteFilePath);
    const content = await provider.readFile(target.remoteFilePath);
    this.cache.set(uri.toString(), content);
    this.metadataCache.set(uri.toString(), metadata);
    return metadata;
  }
}