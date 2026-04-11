import * as vscode from 'vscode';
import { getOrResolveResourceUri, resolveDeploymentTarget } from '../config/deploymentConfiguration';
import { RemoteDiffDocumentProvider } from '../diff/remoteDiffDocumentProvider';
import { createRemoteFileProvider } from '../remote/RemoteFileProvider';
import { confirmSyncConflict, detectSyncConflict } from '../sync/conflictDetection';
import { registerDeployCommand } from './runDeployCommand';

export function registerUploadToRemoteCommand(
  context: vscode.ExtensionContext,
  remoteDiffDocumentProvider: RemoteDiffDocumentProvider
): vscode.Disposable {
  return registerDeployCommand('deploydiff.uploadToRemote', async (resource?: vscode.Uri) => {
    const localFileUri = getOrResolveResourceUri(resource);
    const target = resolveDeploymentTarget(localFileUri);
    const configuration = vscode.workspace.getConfiguration('deploydiff', target.workspaceFolder.uri);
    const confirmSync = configuration.get<boolean>('confirmSync', true);
    const provider = await createRemoteFileProvider(target.workspaceFolder, context.secrets);

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

    const localStat = await vscode.workspace.fs.stat(localFileUri);
    if (await provider.exists(target.remoteFilePath)) {
      const remoteMetadata = await provider.stat(target.remoteFilePath);
      const conflictMessage = detectSyncConflict('upload', new Date(localStat.mtime), remoteMetadata);
      if (conflictMessage && !(await confirmSyncConflict('upload', conflictMessage, target.relativePath))) {
        return;
      }
    }

    const contentBytes = await vscode.workspace.fs.readFile(localFileUri);
    const content = Buffer.from(contentBytes).toString('utf8');
    await provider.writeFile(target.remoteFilePath, content);
    remoteDiffDocumentProvider.refresh(localFileUri);
    await vscode.window.showInformationMessage(`Uploaded ${target.relativePath} to ${target.remoteFilePath}.`);
  });
}