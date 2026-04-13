import * as vscode from 'vscode';
import { DEPLOYDIFF_SHOW_OUTPUT_COMMAND_ID } from './showOutput';
import { isDeployDiffError } from '../errors/DeployDiffError';
import { DeployDiffLogger } from '../logging/outputLogger';

const SHOW_LOGS_ACTION_LABEL = 'Show Logs';

export function registerDeployCommand(
  commandId: string,
  logger: DeployDiffLogger,
  handler: (resource?: vscode.Uri) => Promise<void>
): vscode.Disposable {
  return vscode.commands.registerCommand(commandId, async (resource?: vscode.Uri) => {
    logger.info('Command started', {
      commandId,
      resource: resource?.toString()
    });

    try {
      await handler(resource);
      logger.info('Command completed', {
        commandId,
        resource: resource?.toString()
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown DeployDiff error.';
      const userMessage = `${message} See the "DeployDiff" output channel for details.`;

      logger.error('Command failed', error, {
        commandId,
        resource: resource?.toString()
      });
      logger.show(false);

      if (isDeployDiffError(error) && error.actions.length > 0) {
        const actionLabels = [SHOW_LOGS_ACTION_LABEL, ...error.actions.map((action) => action.label)];
        const selectedActionLabel = await vscode.window.showErrorMessage(userMessage, ...actionLabels);

        if (selectedActionLabel === SHOW_LOGS_ACTION_LABEL) {
          await vscode.commands.executeCommand(DEPLOYDIFF_SHOW_OUTPUT_COMMAND_ID);
          return;
        }

        const selectedAction = error.actions.find((action) => action.label === selectedActionLabel);

        if (selectedAction) {
          logger.info('Executing recovery action', {
            commandId,
            actionLabel: selectedAction.label,
            actionCommandId: selectedAction.commandId
          });
          await vscode.commands.executeCommand(selectedAction.commandId, ...(selectedAction.arguments ?? []));
        }

        return;
      }

      const selectedActionLabel = await vscode.window.showErrorMessage(userMessage, SHOW_LOGS_ACTION_LABEL);
      if (selectedActionLabel === SHOW_LOGS_ACTION_LABEL) {
        await vscode.commands.executeCommand(DEPLOYDIFF_SHOW_OUTPUT_COMMAND_ID);
      }
    }
  });
}
