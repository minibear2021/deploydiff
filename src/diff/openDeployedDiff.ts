import * as vscode from 'vscode';
import { resolveDeploymentTarget } from '../config/deploymentConfiguration';
import { createRemoteDocumentUri } from './remoteDiffDocumentProvider';

export async function openDeployedDiff(
  localFileUri: vscode.Uri
): Promise<void> {
  const target = resolveDeploymentTarget(localFileUri);
  const localDocument = await vscode.workspace.openTextDocument(localFileUri);
  const remoteDocument = await vscode.workspace.openTextDocument(createRemoteDocumentUri(localFileUri));

  if (remoteDocument.languageId !== localDocument.languageId) {
    await vscode.languages.setTextDocumentLanguage(remoteDocument, localDocument.languageId);
  }

  const title = `${target.relativePath} ↔ Deployed`;
  await vscode.commands.executeCommand('vscode.diff', localFileUri, remoteDocument.uri, title, {
    preview: false
  });
}