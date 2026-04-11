import * as vscode from 'vscode';

export function registerDeployCommand(
  commandId: string,
  handler: (resource?: vscode.Uri) => Promise<void>
): vscode.Disposable {
  return vscode.commands.registerCommand(commandId, async (resource?: vscode.Uri) => {
    try {
      await handler(resource);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown DeployDiff error.';
      await vscode.window.showErrorMessage(message);
    }
  });
}