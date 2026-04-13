import * as vscode from 'vscode';
import { DeployDiffLogger } from '../logging/outputLogger';
import { createRemoteDocumentUri, RemoteDiffDocumentProvider } from './remoteDiffDocumentProvider';

export async function openDeployedDiff(
  localFileUri: vscode.Uri,
  remoteDiffDocumentProvider: RemoteDiffDocumentProvider,
  logger: DeployDiffLogger
): Promise<void> {
  logger.info('Opening deployed diff', {
    localFile: localFileUri.fsPath
  });
  await remoteDiffDocumentProvider.preload(localFileUri);
  const localDocument = await vscode.workspace.openTextDocument(localFileUri);
  const remoteDocument = await vscode.workspace.openTextDocument(createRemoteDocumentUri(localFileUri));
  const fileName = localFileUri.path.split('/').pop() ?? localFileUri.toString();
  const title = `${fileName} ↔ ${fileName}`;

  if (remoteDocument.languageId !== localDocument.languageId) {
    await vscode.languages.setTextDocumentLanguage(remoteDocument, localDocument.languageId);
  }

  await vscode.commands.executeCommand('vscode.diff', localFileUri, remoteDocument.uri, title, {
    preview: false
  });
  logger.info('Deployed diff opened', {
    localFile: localFileUri.fsPath,
    title
  });
}
