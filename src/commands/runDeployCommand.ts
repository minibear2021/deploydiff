import * as vscode from 'vscode';
import { isDeployDiffError } from '../errors/DeployDiffError';

export function registerDeployCommand(
  commandId: string,
  handler: (resource?: vscode.Uri) => Promise<void>
): vscode.Disposable {
  return vscode.commands.registerCommand(commandId, async (resource?: vscode.Uri) => {
    try {
      await handler(resource);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown DeployDiff error.';

      if (isDeployDiffError(error) && error.actions.length > 0) {
        const actionLabels = error.actions.map((action) => action.label);
        const selectedActionLabel = await vscode.window.showErrorMessage(message, ...actionLabels);
        const selectedAction = error.actions.find((action) => action.label === selectedActionLabel);

        if (selectedAction) {
          await vscode.commands.executeCommand(selectedAction.commandId, ...(selectedAction.arguments ?? []));
        }

        return;
      }

      await vscode.window.showErrorMessage(message);
    }
  });
}