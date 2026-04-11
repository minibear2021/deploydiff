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
  public constructor(private readonly secrets: vscode.SecretStorage) {}

  public async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const localFileUri = getLocalFileUriFromRemoteDocumentUri(uri);
    const target = resolveDeploymentTarget(localFileUri);
    const provider = await createRemoteFileProvider(target.workspaceFolder, this.secrets);
    return provider.readFile(target.remoteFilePath);
  }
}