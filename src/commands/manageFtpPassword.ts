import * as vscode from 'vscode';
import { DeployDiffLogger } from '../logging/outputLogger';
import { DEPLOYDIFF_FTP_PASSWORD_SECRET_KEY } from '../remote/ftpConfiguration';
import { registerDeployCommand } from './runDeployCommand';

export function registerSetFtpPasswordCommand(
  context: vscode.ExtensionContext,
  logger: DeployDiffLogger
): vscode.Disposable {
  return registerDeployCommand('deploydiff.setFtpPassword', logger, async () => {
    const password = await vscode.window.showInputBox({
      title: 'Set DeployDiff FTP Password',
      prompt: 'Password is stored in VS Code Secret Storage for this workspace session profile.',
      password: true,
      ignoreFocusOut: true
    });

    if (password === undefined) {
      return;
    }

    await context.secrets.store(DEPLOYDIFF_FTP_PASSWORD_SECRET_KEY, password);
    await vscode.window.showInformationMessage('DeployDiff FTP password stored in Secret Storage.');
  });
}

export function registerClearFtpPasswordCommand(
  context: vscode.ExtensionContext,
  logger: DeployDiffLogger
): vscode.Disposable {
  return registerDeployCommand('deploydiff.clearFtpPassword', logger, async () => {
    await context.secrets.delete(DEPLOYDIFF_FTP_PASSWORD_SECRET_KEY);
    await vscode.window.showInformationMessage('DeployDiff FTP password cleared from Secret Storage.');
  });
}
