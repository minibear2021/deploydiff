import * as vscode from 'vscode';
import { registerCompareWithDeployedCommand } from './commands/compareWithDeployed';
import { registerDownloadFromRemoteCommand } from './commands/downloadFromRemote';
import {
  registerClearSftpPasswordCommand,
  registerSetSftpPasswordCommand
} from './commands/manageSftpPassword';
import { registerRefreshDeployedVersionCommand } from './commands/refreshDeployedVersion';
import { registerUploadToRemoteCommand } from './commands/uploadToRemote';
import {
  DEPLOYDIFF_REMOTE_DOCUMENT_SCHEME,
  RemoteDiffDocumentProvider
} from './diff/remoteDiffDocumentProvider';
import { DeploymentStatusIndicator } from './status/deploymentStatusIndicator';
import { DiffDirectionIndicator } from './status/diffDirectionIndicator';

export type DeployDiffExtensionApi = {
  secrets: vscode.SecretStorage;
};

export function activate(context: vscode.ExtensionContext): DeployDiffExtensionApi {
  const remoteDiffDocumentProvider = new RemoteDiffDocumentProvider(context.secrets);
  const deploymentStatusIndicator = new DeploymentStatusIndicator(remoteDiffDocumentProvider);
  const diffDirectionIndicator = new DiffDirectionIndicator();

  context.subscriptions.push(
    deploymentStatusIndicator,
    diffDirectionIndicator,
    vscode.window.onDidChangeActiveTextEditor(() => deploymentStatusIndicator.update()),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('deploydiff')) {
        deploymentStatusIndicator.update();
      }
    }),
    vscode.workspace.registerFileSystemProvider(
      DEPLOYDIFF_REMOTE_DOCUMENT_SCHEME,
      remoteDiffDocumentProvider,
      {
        isCaseSensitive: true,
        isReadonly: false
      }
    ),
    registerCompareWithDeployedCommand(remoteDiffDocumentProvider),
    registerUploadToRemoteCommand(context, remoteDiffDocumentProvider),
    registerDownloadFromRemoteCommand(context, remoteDiffDocumentProvider),
    registerRefreshDeployedVersionCommand(remoteDiffDocumentProvider),
    registerSetSftpPasswordCommand(context),
    registerClearSftpPasswordCommand(context)
  );

  return {
    secrets: context.secrets
  };
}

export function deactivate(): void {}