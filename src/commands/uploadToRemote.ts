import * as vscode from 'vscode';
import { getOrResolveResourceUri, resolveDeploymentTarget } from '../config/deploymentConfiguration';
import { RemoteDiffDocumentProvider } from '../diff/remoteDiffDocumentProvider';
import { DeployDiffLogger } from '../logging/outputLogger';
import { createRemoteFileProvider } from '../remote/RemoteFileProvider';
import { joinRemotePath } from '../remote/remotePath';
import { confirmSyncConflict, detectSyncConflict } from '../sync/conflictDetection';
import { registerDeployCommand } from './runDeployCommand';

export function registerUploadToRemoteCommand(
  context: vscode.ExtensionContext,
  remoteDiffDocumentProvider: RemoteDiffDocumentProvider,
  logger: DeployDiffLogger
): vscode.Disposable {
  return registerDeployCommand('deploydiff.uploadToRemote', logger, async (resource?: vscode.Uri) => {
    const localFileUri = getOrResolveResourceUri(resource);
    const target = resolveDeploymentTarget(localFileUri);
    const configuration = vscode.workspace.getConfiguration('deploydiff', target.workspaceFolder.uri);
    const confirmSync = configuration.get<boolean>('confirmSync', true);
    const provider = await createRemoteFileProvider(target.workspaceFolder, context.secrets, logger);
    const localStat = await vscode.workspace.fs.stat(localFileUri);
    const isDirectory = (localStat.type & vscode.FileType.Directory) !== 0;

    logger.info('Preparing upload', {
      localFile: localFileUri.fsPath,
      remotePath: target.remoteFilePath,
      isDirectory
    });

    if (confirmSync) {
      const answer = await vscode.window.showWarningMessage(
        isDirectory
          ? `Upload directory ${target.relativePath || '.'} to ${target.remoteFilePath}?`
          : `Upload ${target.relativePath} to ${target.mapping.remoteRoot}?`,
        { modal: true },
        'Upload'
      );
      if (answer !== 'Upload') {
        logger.info('Upload cancelled by user', {
          localFile: localFileUri.fsPath,
          remotePath: target.remoteFilePath
        });
        return;
      }
    }

    if (isDirectory) {
      const summary = { filesUploaded: 0, directoriesCreated: 0 };
      await uploadDirectoryToRemote(localFileUri, target.remoteFilePath, provider, summary, logger);
      logger.info('Upload completed', {
        localFile: localFileUri.fsPath,
        remotePath: target.remoteFilePath,
        filesUploaded: summary.filesUploaded,
        directoriesCreated: summary.directoriesCreated
      });
      await vscode.window.showInformationMessage(
        `Uploaded ${summary.filesUploaded} file(s) from ${target.relativePath || '.'} to ${target.remoteFilePath}.`
      );
      return;
    }

    await uploadFileToRemote(localFileUri, target.remoteFilePath, provider, target.relativePath, logger);
    remoteDiffDocumentProvider.refresh(localFileUri);
    logger.info('Upload completed', {
      localFile: localFileUri.fsPath,
      remotePath: target.remoteFilePath,
      filesUploaded: 1
    });
    await vscode.window.showInformationMessage(`Uploaded ${target.relativePath} to ${target.remoteFilePath}.`);
  });
}

async function uploadDirectoryToRemote(
  localDirectoryUri: vscode.Uri,
  remoteDirectoryPath: string,
  provider: Awaited<ReturnType<typeof createRemoteFileProvider>>,
  summary: { filesUploaded: number; directoriesCreated: number },
  logger: DeployDiffLogger
): Promise<void> {
  logger.info('Ensuring remote directory exists', {
    localDirectory: localDirectoryUri.fsPath,
    remotePath: remoteDirectoryPath
  });
  await provider.createDirectory(remoteDirectoryPath);
  summary.directoriesCreated += 1;

  const entries = await vscode.workspace.fs.readDirectory(localDirectoryUri);
  for (const [name, type] of entries) {
    const childLocalUri = vscode.Uri.joinPath(localDirectoryUri, name);
    const childRemotePath = joinRemotePath(remoteDirectoryPath, name);

    if ((type & vscode.FileType.Directory) !== 0) {
      await uploadDirectoryToRemote(childLocalUri, childRemotePath, provider, summary, logger);
      continue;
    }

    if ((type & vscode.FileType.File) !== 0) {
      await uploadFileToRemote(
        childLocalUri,
        childRemotePath,
        provider,
        childLocalUri.path.split('/').pop() ?? name,
        logger
      );
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
  label: string,
  logger: DeployDiffLogger
): Promise<void> {
  const localStat = await vscode.workspace.fs.stat(localFileUri);
  if (await provider.exists(remoteFilePath)) {
    const remoteMetadata = await provider.stat(remoteFilePath);
    const conflictMessage = detectSyncConflict('upload', new Date(localStat.mtime), remoteMetadata);
    if (conflictMessage && !(await confirmSyncConflict('upload', conflictMessage, label))) {
      logger.warn('Upload conflict declined by user', {
        localFile: localFileUri.fsPath,
        remotePath: remoteFilePath
      });
      return;
    }
  }

  logger.info('Uploading file', {
    localFile: localFileUri.fsPath,
    remotePath: remoteFilePath
  });
  const contentBytes = await vscode.workspace.fs.readFile(localFileUri);
  const content = Buffer.from(contentBytes).toString('utf8');
  await provider.writeFile(remoteFilePath, content);
}
