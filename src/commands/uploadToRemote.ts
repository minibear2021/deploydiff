import * as vscode from 'vscode';
import { readFile } from 'node:fs/promises';
import { getOrResolveResourceUri, resolveDeploymentTarget } from '../config/deploymentConfiguration';
import { createRemoteFileProvider } from '../remote/RemoteFileProvider';

export function registerUploadToRemoteCommand(
): vscode.Disposable {
  return vscode.commands.registerCommand('deploydiff.uploadToRemote', async (resource?: vscode.Uri) => {
    const localFileUri = getOrResolveResourceUri(resource);
    const target = resolveDeploymentTarget(localFileUri);
    const configuration = vscode.workspace.getConfiguration('deploydiff', target.workspaceFolder.uri);
    const confirmSync = configuration.get<boolean>('confirmSync', true);
    const provider = createRemoteFileProvider(target.workspaceFolder);

    if (confirmSync) {
      const answer = await vscode.window.showWarningMessage(
        `Upload ${target.relativePath} to ${target.mapping.remoteRoot}?`,
        { modal: true },
        'Upload'
      );
      if (answer !== 'Upload') {
        return;
      }
    }

    const content = await readFile(localFileUri.fsPath, 'utf8');
    await provider.writeFile(target.remoteFilePath, content);
    await vscode.window.showInformationMessage(`Uploaded ${target.relativePath} to ${target.remoteFilePath}.`);
  });
}