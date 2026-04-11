import * as vscode from 'vscode';
import { registerCompareWithDeployedCommand } from './commands/compareWithDeployed';
import { registerDownloadFromRemoteCommand } from './commands/downloadFromRemote';
import {
  registerClearSftpPasswordCommand,
  registerSetSftpPasswordCommand
} from './commands/manageSftpPassword';
import { registerUploadToRemoteCommand } from './commands/uploadToRemote';

export type DeployDiffExtensionApi = {
  secrets: vscode.SecretStorage;
};

export function activate(context: vscode.ExtensionContext): DeployDiffExtensionApi {
  context.subscriptions.push(
    registerCompareWithDeployedCommand(context),
    registerUploadToRemoteCommand(context),
    registerDownloadFromRemoteCommand(context),
    registerSetSftpPasswordCommand(context),
    registerClearSftpPasswordCommand(context)
  );

  return {
    secrets: context.secrets
  };
}

export function deactivate(): void {}