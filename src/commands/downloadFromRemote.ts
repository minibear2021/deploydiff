import * as vscode from 'vscode';
import { getOrResolveResourceUri, resolveDeploymentTarget } from '../config/deploymentConfiguration';
import { RemoteDiffDocumentProvider } from '../diff/remoteDiffDocumentProvider';
import { createRemoteFileProvider, RemoteFileProvider } from '../remote/RemoteFileProvider';
import { joinRemotePath } from '../remote/remotePath';
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
    const remoteMetadata = await provider.stat(target.remoteFilePath);
    const isDirectory = remoteMetadata.type === 'directory';

    if (confirmSync) {
      const answer = await vscode.window.showWarningMessage(
        isDirectory
          ? `Replace local directory ${target.relativePath || '.'} with the deployed contents from ${target.remoteFilePath}?`
          : `Replace local file ${target.relativePath} with the deployed version from ${target.mapping.remoteRoot}?`,
        { modal: true },
        'Download'
      );
      if (answer !== 'Download') {
        return;
      }
    }

    if (isDirectory) {
      const summary = { filesDownloaded: 0, directoriesCreated: 0 };
      await downloadDirectoryFromRemote(localFileUri, target.remoteFilePath, provider, summary);
      await vscode.window.showInformationMessage(
        `Downloaded ${summary.filesDownloaded} file(s) from ${target.remoteFilePath} to ${target.relativePath || '.'}.`
      );
      return;
    }

    await downloadFileFromRemote(localFileUri, target.remoteFilePath, provider, target.relativePath);
    remoteDiffDocumentProvider.refresh(localFileUri);
    await vscode.window.showInformationMessage(`Downloaded ${target.remoteFilePath} to ${target.relativePath}.`);
  });
}

async function downloadDirectoryFromRemote(
  localDirectoryUri: vscode.Uri,
  remoteDirectoryPath: string,
  provider: RemoteFileProvider,
  summary: { filesDownloaded: number; directoriesCreated: number }
): Promise<void> {
  await vscode.workspace.fs.createDirectory(localDirectoryUri);
  summary.directoriesCreated += 1;

  const entries = await provider.listDirectory(remoteDirectoryPath);
  for (const entry of entries) {
    const childLocalUri = vscode.Uri.joinPath(localDirectoryUri, entry.name);
    const childRemotePath = joinRemotePath(remoteDirectoryPath, entry.name);

    if (entry.type === 'directory') {
      await downloadDirectoryFromRemote(childLocalUri, childRemotePath, provider, summary);
      continue;
    }

    await downloadFileFromRemote(childLocalUri, childRemotePath, provider, entry.name);
    summary.filesDownloaded += 1;
  }
}

async function downloadFileFromRemote(
  localFileUri: vscode.Uri,
  remoteFilePath: string,
  provider: RemoteFileProvider,
  label: string
): Promise<void> {
  let localStat: vscode.FileStat | undefined;
  try {
    localStat = await vscode.workspace.fs.stat(localFileUri);
  } catch {
    localStat = undefined;
  }

  if (localStat) {
    const remoteMetadata = await provider.stat(remoteFilePath);
    const conflictMessage = detectSyncConflict('download', new Date(localStat.mtime), remoteMetadata);
    if (conflictMessage && !(await confirmSyncConflict('download', conflictMessage, label))) {
      return;
    }
  }

  const content = await provider.readFile(remoteFilePath);
  await vscode.workspace.fs.writeFile(localFileUri, Buffer.from(content, 'utf8'));
}