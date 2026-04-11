import * as vscode from 'vscode';
import { writeFile } from 'node:fs/promises';
import { getOrResolveResourceUri, resolveDeploymentTarget } from '../config/deploymentConfiguration';
import { createRemoteFileProvider } from '../remote/RemoteFileProvider';

export function registerDownloadFromRemoteCommand(
): vscode.Disposable {
  return vscode.commands.registerCommand('deploydiff.downloadFromRemote', async (resource?: vscode.Uri) => {
    const localFileUri = getOrResolveResourceUri(resource);
    const target = resolveDeploymentTarget(localFileUri);
    const configuration = vscode.workspace.getConfiguration('deploydiff', target.workspaceFolder.uri);
    const confirmSync = configuration.get<boolean>('confirmSync', true);
    const provider = createRemoteFileProvider(target.workspaceFolder);

    if (confirmSync) {
      const answer = await vscode.window.showWarningMessage(
        `Replace local file ${target.relativePath} with the deployed version from ${target.mapping.remoteRoot}?`,
        { modal: true },
        'Download'
      );
      if (answer !== 'Download') {
        return;
      }
    }

    const content = await provider.readFile(target.remoteFilePath);
    await writeFile(localFileUri.fsPath, content, 'utf8');
    await vscode.window.showInformationMessage(`Downloaded ${target.remoteFilePath} to ${target.relativePath}.`);
  });
}