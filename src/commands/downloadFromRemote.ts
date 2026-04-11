import * as vscode from 'vscode';
import { getOrResolveResourceUri, resolveDeploymentTarget } from '../config/deploymentConfiguration';
import { RemoteDiffDocumentProvider } from '../diff/remoteDiffDocumentProvider';
import { createRemoteFileProvider } from '../remote/RemoteFileProvider';
import { registerDeployCommand } from './runDeployCommand';

export function registerDownloadFromRemoteCommand(
  context: vscode.ExtensionContext,
  remoteDiffDocumentProvider: RemoteDiffDocumentProvider
): vscode.Disposable {
  return registerDeployCommand('deploydiff.downloadFromRemote', async (resource?: vscode.Uri) => {
    const localFileUri = getOrResolveResourceUri(resource);
    const target = resolveDeploymentTarget(localFileUri);
    const configuration = vscode.workspace.getConfiguration('deploydiff', target.workspaceFolder.uri);
    const confirmSync = configuration.get<boolean>('confirmSync', true);
    const provider = await createRemoteFileProvider(target.workspaceFolder, context.secrets);

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
    await vscode.workspace.fs.writeFile(localFileUri, Buffer.from(content, 'utf8'));
    remoteDiffDocumentProvider.refresh(localFileUri);
    await vscode.window.showInformationMessage(`Downloaded ${target.remoteFilePath} to ${target.relativePath}.`);
  });
}