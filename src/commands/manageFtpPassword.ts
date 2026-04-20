import * as vscode from 'vscode';
import { DeployDiffLogger } from '../logging/outputLogger';
import { getFtpPasswordSecretKey } from '../remote/ftpConfiguration';
import { registerDeployCommand } from './runDeployCommand';

function getFirstWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.workspaceFolders?.[0];
}

export function registerSetFtpPasswordCommand(
  context: vscode.ExtensionContext,
  logger: DeployDiffLogger
): vscode.Disposable {
  return registerDeployCommand('deploydiff.setFtpPassword', logger, async () => {
    const workspaceFolder = getFirstWorkspaceFolder();
    if (!workspaceFolder) {
      await vscode.window.showWarningMessage('DeployDiff FTP password must be set within an open workspace.');
      return;
    }

    const password = await vscode.window.showInputBox({
      title: 'Set DeployDiff FTP Password',
      prompt: 'Password is stored in VS Code Secret Storage for this workspace.',
      password: true,
      ignoreFocusOut: true
    });

    if (password === undefined) {
      return;
    }

    await context.secrets.store(getFtpPasswordSecretKey(workspaceFolder), password);
    await vscode.window.showInformationMessage('DeployDiff FTP password stored in Secret Storage for the current workspace.');
  });
}

export function registerClearFtpPasswordCommand(
  context: vscode.ExtensionContext,
  logger: DeployDiffLogger
): vscode.Disposable {
  return registerDeployCommand('deploydiff.clearFtpPassword', logger, async () => {
    const workspaceFolder = getFirstWorkspaceFolder();
    if (!workspaceFolder) {
      await vscode.window.showWarningMessage('No open workspace to clear the DeployDiff FTP password from.');
      return;
    }

    await context.secrets.delete(getFtpPasswordSecretKey(workspaceFolder));
    await vscode.window.showInformationMessage('DeployDiff FTP password cleared from Secret Storage for the current workspace.');
  });
}
