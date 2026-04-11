import * as vscode from 'vscode';
import { getOrResolveResourceUri, resolveDeploymentTarget } from '../config/deploymentConfiguration';
import { RemoteDiffDocumentProvider } from '../diff/remoteDiffDocumentProvider';
import { createRemoteFileProvider } from '../remote/RemoteFileProvider';
import { confirmSyncConflict, detectSyncConflict } from '../sync/conflictDetection';
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

    const localStat = await vscode.workspace.fs.stat(localFileUri);
    const remoteMetadata = await provider.stat(target.remoteFilePath);
    const conflictMessage = detectSyncConflict('download', new Date(localStat.mtime), remoteMetadata);
    if (conflictMessage && !(await confirmSyncConflict('download', conflictMessage, target.relativePath))) {
      return;
    }

    const content = await provider.readFile(target.remoteFilePath);
    await vscode.workspace.fs.writeFile(localFileUri, Buffer.from(content, 'utf8'));
    remoteDiffDocumentProvider.refresh(localFileUri);
    await vscode.window.showInformationMessage(`Downloaded ${target.remoteFilePath} to ${target.relativePath}.`);
  });
}