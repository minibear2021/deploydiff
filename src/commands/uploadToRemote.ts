import * as vscode from 'vscode';
import { getOrResolveResourceUri, resolveDeploymentTarget } from '../config/deploymentConfiguration';
import { RemoteDiffDocumentProvider } from '../diff/remoteDiffDocumentProvider';
import { createRemoteFileProvider } from '../remote/RemoteFileProvider';
import { joinRemotePath } from '../remote/remotePath';
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
    const localStat = await vscode.workspace.fs.stat(localFileUri);
    const isDirectory = (localStat.type & vscode.FileType.Directory) !== 0;

    if (confirmSync) {
      const answer = await vscode.window.showWarningMessage(
        isDirectory
          ? `Upload directory ${target.relativePath || '.'} to ${target.remoteFilePath}?`
          : `Upload ${target.relativePath} to ${target.mapping.remoteRoot}?`,
        { modal: true },
        'Upload'
      );
      if (answer !== 'Upload') {
        return;
      }
    }

    if (isDirectory) {
      const summary = { filesUploaded: 0, directoriesCreated: 0 };
      await uploadDirectoryToRemote(localFileUri, target.remoteFilePath, provider, summary);
      await vscode.window.showInformationMessage(
        `Uploaded ${summary.filesUploaded} file(s) from ${target.relativePath || '.'} to ${target.remoteFilePath}.`
      );
      return;
    }

    await uploadFileToRemote(localFileUri, target.remoteFilePath, provider, target.relativePath);
    remoteDiffDocumentProvider.refresh(localFileUri);
    await vscode.window.showInformationMessage(`Uploaded ${target.relativePath} to ${target.remoteFilePath}.`);
  });
}

async function uploadDirectoryToRemote(
  localDirectoryUri: vscode.Uri,
  remoteDirectoryPath: string,
  provider: Awaited<ReturnType<typeof createRemoteFileProvider>>,
  summary: { filesUploaded: number; directoriesCreated: number }
): Promise<void> {
  await provider.createDirectory(remoteDirectoryPath);
  summary.directoriesCreated += 1;

  const entries = await vscode.workspace.fs.readDirectory(localDirectoryUri);
  for (const [name, type] of entries) {
    const childLocalUri = vscode.Uri.joinPath(localDirectoryUri, name);
    const childRemotePath = joinRemotePath(remoteDirectoryPath, name);

    if ((type & vscode.FileType.Directory) !== 0) {
      await uploadDirectoryToRemote(childLocalUri, childRemotePath, provider, summary);
      continue;
    }

    if ((type & vscode.FileType.File) !== 0) {
      await uploadFileToRemote(childLocalUri, childRemotePath, provider, childLocalUri.path.split('/').pop() ?? name);
      summary.filesUploaded += 1;
      continue;
    }

    throw new Error(`DeployDiff cannot upload unsupported directory entry ${name}.`);
  }
}

async function uploadFileToRemote(
  localFileUri: vscode.Uri,
  remoteFilePath: string,
  provider: Awaited<ReturnType<typeof createRemoteFileProvider>>,
  label: string
): Promise<void> {
  const localStat = await vscode.workspace.fs.stat(localFileUri);
  if (await provider.exists(remoteFilePath)) {
    const remoteMetadata = await provider.stat(remoteFilePath);
    const conflictMessage = detectSyncConflict('upload', new Date(localStat.mtime), remoteMetadata);
    if (conflictMessage && !(await confirmSyncConflict('upload', conflictMessage, label))) {
      return;
    }
  }

  const contentBytes = await vscode.workspace.fs.readFile(localFileUri);
  const content = Buffer.from(contentBytes).toString('utf8');
  await provider.writeFile(remoteFilePath, content);
}