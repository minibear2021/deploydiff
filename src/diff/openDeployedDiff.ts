import * as vscode from 'vscode';
import { DEPLOYDIFF_REMOTE_DOCUMENT_SCHEME, isRemoteDocumentUri } from './remoteDiffDocumentProvider';
import { createRemoteDocumentUri, RemoteDiffDocumentProvider } from './remoteDiffDocumentProvider';

export async function openDeployedDiff(
  localFileUri: vscode.Uri,
  remoteDiffDocumentProvider: RemoteDiffDocumentProvider
): Promise<void> {
  await remoteDiffDocumentProvider.preload(localFileUri);
  const localDocument = await vscode.workspace.openTextDocument(localFileUri);
  const remoteDocument = await vscode.workspace.openTextDocument(createRemoteDocumentUri(localFileUri));
  const title = createDeployedDiffTitle(localFileUri, remoteDocument.uri);

  if (remoteDocument.languageId !== localDocument.languageId) {
    await vscode.languages.setTextDocumentLanguage(remoteDocument, localDocument.languageId);
  }

  await vscode.commands.executeCommand('vscode.diff', localFileUri, remoteDocument.uri, title, {
    preview: false
  });
}

export function createDeployedDiffTitle(leftUri: vscode.Uri, rightUri: vscode.Uri): string {
  const localUri = isRemoteDocumentUri(leftUri) ? rightUri : leftUri;
  const remoteUri = isRemoteDocumentUri(leftUri) ? leftUri : rightUri;
  return `${createSideLabel(localUri)} ↔ ${createSideLabel(remoteUri)}`;
}

function createSideLabel(uri: vscode.Uri): string {
  const fileName = uri.path.split('/').pop() ?? uri.toString();
  const role = uri.scheme === DEPLOYDIFF_REMOTE_DOCUMENT_SCHEME || isRemoteDocumentUri(uri) ? 'remote' : 'local';
  return `${fileName}(${role})`;
}