import * as vscode from 'vscode';
import { resolveDeploymentTarget } from '../config/deploymentConfiguration';
import { createRemoteFileProvider } from '../remote/RemoteFileProvider';

export async function openDeployedDiff(
  localFileUri: vscode.Uri,
  secrets: vscode.SecretStorage
): Promise<void> {
  const target = resolveDeploymentTarget(localFileUri);
  const provider = await createRemoteFileProvider(target.workspaceFolder, secrets);
  const remoteContent = await provider.readFile(target.remoteFilePath);
  const localDocument = await vscode.workspace.openTextDocument(localFileUri);
  const remoteDocument = await vscode.workspace.openTextDocument({
    content: remoteContent,
    language: localDocument.languageId
  });

  const title = `${target.relativePath} ↔ Deployed`;
  await vscode.commands.executeCommand('vscode.diff', localFileUri, remoteDocument.uri, title, {
    preview: false
  });
}