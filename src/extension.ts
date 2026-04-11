import * as vscode from 'vscode';
import { registerCompareWithDeployedCommand } from './commands/compareWithDeployed';
import { registerDownloadFromRemoteCommand } from './commands/downloadFromRemote';
import { registerUploadToRemoteCommand } from './commands/uploadToRemote';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    registerCompareWithDeployedCommand(),
    registerUploadToRemoteCommand(),
    registerDownloadFromRemoteCommand()
  );
}

export function deactivate(): void {}