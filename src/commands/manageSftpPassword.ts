import * as vscode from 'vscode';
import { DeployDiffLogger } from '../logging/outputLogger';
import { getSftpPasswordSecretKey } from '../remote/sftpConfiguration';
import { registerDeployCommand } from './runDeployCommand';

function getFirstWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.workspaceFolders?.[0];
}

export function registerSetSftpPasswordCommand(
  context: vscode.ExtensionContext,
  logger: DeployDiffLogger
): vscode.Disposable {
  return registerDeployCommand('deploydiff.setSftpPassword', logger, async () => {
    const workspaceFolder = getFirstWorkspaceFolder();
    if (!workspaceFolder) {
      await vscode.window.showWarningMessage('DeployDiff SFTP password must be set within an open workspace.');
      return;
    }

    const password = await vscode.window.showInputBox({
      title: 'Set DeployDiff SFTP Password',
      prompt: 'Password is stored in VS Code Secret Storage for this workspace.',
      password: true,
      ignoreFocusOut: true
    });

    if (password === undefined) {
      return;
    }

    await context.secrets.store(getSftpPasswordSecretKey(workspaceFolder), password);
    await vscode.window.showInformationMessage('DeployDiff SFTP password stored in Secret Storage for the current workspace.');
  });
}

export function registerClearSftpPasswordCommand(
  context: vscode.ExtensionContext,
  logger: DeployDiffLogger
): vscode.Disposable {
  return registerDeployCommand('deploydiff.clearSftpPassword', logger, async () => {
    const workspaceFolder = getFirstWorkspaceFolder();
    if (!workspaceFolder) {
      await vscode.window.showWarningMessage('No open workspace to clear the DeployDiff SFTP password from.');
      return;
    }

    await context.secrets.delete(getSftpPasswordSecretKey(workspaceFolder));
    await vscode.window.showInformationMessage('DeployDiff SFTP password cleared from Secret Storage for the current workspace.');
  });
}
