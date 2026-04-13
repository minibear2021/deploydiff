import * as vscode from 'vscode';
import { DeployDiffLogger } from '../logging/outputLogger';
import { DEPLOYDIFF_SFTP_PASSWORD_SECRET_KEY } from '../remote/sftpConfiguration';
import { registerDeployCommand } from './runDeployCommand';

export function registerSetSftpPasswordCommand(
  context: vscode.ExtensionContext,
  logger: DeployDiffLogger
): vscode.Disposable {
  return registerDeployCommand('deploydiff.setSftpPassword', logger, async () => {
    const password = await vscode.window.showInputBox({
      title: 'Set DeployDiff SFTP Password',
      prompt: 'Password is stored in VS Code Secret Storage for this workspace session profile.',
      password: true,
      ignoreFocusOut: true
    });

    if (password === undefined) {
      return;
    }

    await context.secrets.store(DEPLOYDIFF_SFTP_PASSWORD_SECRET_KEY, password);
    await vscode.window.showInformationMessage('DeployDiff SFTP password stored in Secret Storage.');
  });
}

export function registerClearSftpPasswordCommand(
  context: vscode.ExtensionContext,
  logger: DeployDiffLogger
): vscode.Disposable {
  return registerDeployCommand('deploydiff.clearSftpPassword', logger, async () => {
    await context.secrets.delete(DEPLOYDIFF_SFTP_PASSWORD_SECRET_KEY);
    await vscode.window.showInformationMessage('DeployDiff SFTP password cleared from Secret Storage.');
  });
}
