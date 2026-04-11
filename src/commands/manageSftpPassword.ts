import * as vscode from 'vscode';
import { registerDeployCommand } from './runDeployCommand';
import { DEPLOYDIFF_SFTP_PASSWORD_SECRET_KEY } from '../remote/sftpConfiguration';

export function registerSetSftpPasswordCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return registerDeployCommand('deploydiff.setSftpPassword', async () => {
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

export function registerClearSftpPasswordCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return registerDeployCommand('deploydiff.clearSftpPassword', async () => {
    await context.secrets.delete(DEPLOYDIFF_SFTP_PASSWORD_SECRET_KEY);
    await vscode.window.showInformationMessage('DeployDiff SFTP password cleared from Secret Storage.');
  });
}