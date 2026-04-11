import * as vscode from 'vscode';
import { resolveDeploymentTarget } from '../config/deploymentConfiguration';
import { createRemoteFileProvider } from '../remote/RemoteFileProvider';

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

export class RemoteDiffDocumentProvider implements vscode.TextDocumentContentProvider {
  private readonly didChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  private readonly cache = new Map<string, string>();

  public constructor(private readonly secrets: vscode.SecretStorage) {}

  public readonly onDidChange = this.didChangeEmitter.event;

  public async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const cached = this.cache.get(uri.toString());
    if (cached !== undefined) {
      return cached;
    }

    return this.loadRemoteContent(uri);
  }

  public async preload(localFileUri: vscode.Uri): Promise<void> {
    const remoteUri = createRemoteDocumentUri(localFileUri);
    const content = await this.loadRemoteContent(remoteUri);
    this.cache.set(remoteUri.toString(), content);
  }

  public refresh(localFileUri: vscode.Uri): void {
    const remoteUri = createRemoteDocumentUri(localFileUri);
    this.cache.delete(remoteUri.toString());
    this.didChangeEmitter.fire(remoteUri);
  }

  public dispose(): void {
    this.cache.clear();
    this.didChangeEmitter.dispose();
  }

  private async loadRemoteContent(uri: vscode.Uri): Promise<string> {
    const localFileUri = getLocalFileUriFromRemoteDocumentUri(uri);
    const target = resolveDeploymentTarget(localFileUri);
    const provider = await createRemoteFileProvider(target.workspaceFolder, this.secrets);

    if (!(await provider.exists(target.remoteFilePath))) {
      throw new Error(`No deployed file exists at ${target.remoteFilePath}.`);
    }

    const content = await provider.readFile(target.remoteFilePath);
    this.cache.set(uri.toString(), content);
    return content;
  }
}