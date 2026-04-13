import * as vscode from 'vscode';
import { getOrResolveResourceUri, resolveDeploymentTarget } from '../config/deploymentConfiguration';
import { RemoteDiffDocumentProvider } from '../diff/remoteDiffDocumentProvider';
import { DeployDiffLogger } from '../logging/outputLogger';
import { createRemoteFileProvider, RemoteFileProvider } from '../remote/RemoteFileProvider';
import { joinRemotePath } from '../remote/remotePath';
import { confirmSyncConflict, detectSyncConflict } from '../sync/conflictDetection';
import { registerDeployCommand } from './runDeployCommand';

export function registerDownloadFromRemoteCommand(
  context: vscode.ExtensionContext,
  remoteDiffDocumentProvider: RemoteDiffDocumentProvider,
  logger: DeployDiffLogger
): vscode.Disposable {
  return registerDeployCommand('deploydiff.downloadFromRemote', logger, async (resource?: vscode.Uri) => {
    const localFileUri = getOrResolveResourceUri(resource);
    const target = resolveDeploymentTarget(localFileUri);
    const configuration = vscode.workspace.getConfiguration('deploydiff', target.workspaceFolder.uri);
    const confirmSync = configuration.get<boolean>('confirmSync', true);
    const provider = await createRemoteFileProvider(target.workspaceFolder, context.secrets, logger);
    const remoteMetadata = await provider.stat(target.remoteFilePath);
    const isDirectory = remoteMetadata.type === 'directory';

    logger.info('Preparing download', {
      localFile: localFileUri.fsPath,
      remotePath: target.remoteFilePath,
      isDirectory
    });

    if (confirmSync) {
      const answer = await vscode.window.showWarningMessage(
        isDirectory
          ? `Replace local directory ${target.relativePath || '.'} with the deployed contents from ${target.remoteFilePath}?`
          : `Replace local file ${target.relativePath} with the deployed version from ${target.mapping.remoteRoot}?`,
        { modal: true },
        'Download'
      );
      if (answer !== 'Download') {
        logger.info('Download cancelled by user', {
          localFile: localFileUri.fsPath,
          remotePath: target.remoteFilePath
        });
        return;
      }
    }

    if (isDirectory) {
      const summary = { filesDownloaded: 0, directoriesCreated: 0 };
      await downloadDirectoryFromRemote(localFileUri, target.remoteFilePath, provider, summary, logger);
      logger.info('Download completed', {
        localFile: localFileUri.fsPath,
        remotePath: target.remoteFilePath,
        filesDownloaded: summary.filesDownloaded,
        directoriesCreated: summary.directoriesCreated
      });
      await vscode.window.showInformationMessage(
        `Downloaded ${summary.filesDownloaded} file(s) from ${target.remoteFilePath} to ${target.relativePath || '.'}.`
      );
      return;
    }

    await downloadFileFromRemote(localFileUri, target.remoteFilePath, provider, target.relativePath, logger);
    remoteDiffDocumentProvider.refresh(localFileUri);
    logger.info('Download completed', {
      localFile: localFileUri.fsPath,
      remotePath: target.remoteFilePath,
      filesDownloaded: 1
    });
    await vscode.window.showInformationMessage(`Downloaded ${target.remoteFilePath} to ${target.relativePath}.`);
  });
}

async function downloadDirectoryFromRemote(
  localDirectoryUri: vscode.Uri,
  remoteDirectoryPath: string,
  provider: RemoteFileProvider,
  summary: { filesDownloaded: number; directoriesCreated: number },
  logger: DeployDiffLogger
): Promise<void> {
  logger.info('Ensuring local directory exists', {
    localDirectory: localDirectoryUri.fsPath,
    remotePath: remoteDirectoryPath
  });
  await vscode.workspace.fs.createDirectory(localDirectoryUri);
  summary.directoriesCreated += 1;

  const entries = await provider.listDirectory(remoteDirectoryPath);
  for (const entry of entries) {
    const childLocalUri = vscode.Uri.joinPath(localDirectoryUri, entry.name);
    const childRemotePath = joinRemotePath(remoteDirectoryPath, entry.name);

    if (entry.type === 'directory') {
      await downloadDirectoryFromRemote(childLocalUri, childRemotePath, provider, summary, logger);
      continue;
    }

    await downloadFileFromRemote(childLocalUri, childRemotePath, provider, entry.name, logger);
    summary.filesDownloaded += 1;
  }
}

async function downloadFileFromRemote(
  localFileUri: vscode.Uri,
  remoteFilePath: string,
  provider: RemoteFileProvider,
  label: string,
  logger: DeployDiffLogger
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
      logger.warn('Download conflict declined by user', {
        localFile: localFileUri.fsPath,
        remotePath: remoteFilePath
      });
      return;
    }
  }

  logger.info('Downloading file', {
    localFile: localFileUri.fsPath,
    remotePath: remoteFilePath
  });
  const content = await provider.readFile(remoteFilePath);
  await vscode.workspace.fs.writeFile(localFileUri, Buffer.from(content, 'utf8'));
}
