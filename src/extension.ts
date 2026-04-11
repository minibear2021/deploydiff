import * as vscode from 'vscode';
import { registerCompareWithDeployedCommand } from './commands/compareWithDeployed';
import { registerDownloadFromRemoteCommand } from './commands/downloadFromRemote';
import {
  registerClearSftpPasswordCommand,
  registerSetSftpPasswordCommand
} from './commands/manageSftpPassword';
import { registerUploadToRemoteCommand } from './commands/uploadToRemote';
import {
  DEPLOYDIFF_REMOTE_DOCUMENT_SCHEME,
  RemoteDiffDocumentProvider
} from './diff/remoteDiffDocumentProvider';

export type DeployDiffExtensionApi = {
  secrets: vscode.SecretStorage;
};

export function activate(context: vscode.ExtensionContext): DeployDiffExtensionApi {
  const remoteDiffDocumentProvider = new RemoteDiffDocumentProvider(context.secrets);

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      DEPLOYDIFF_REMOTE_DOCUMENT_SCHEME,
      remoteDiffDocumentProvider
    ),
    registerCompareWithDeployedCommand(),
    registerUploadToRemoteCommand(context, remoteDiffDocumentProvider),
    registerDownloadFromRemoteCommand(context, remoteDiffDocumentProvider),
    registerSetSftpPasswordCommand(context),
    registerClearSftpPasswordCommand(context)
  );

  return {
    secrets: context.secrets
  };
}

export function deactivate(): void {}