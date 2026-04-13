import * as vscode from 'vscode';
import { DeployDiffLogger } from '../logging/outputLogger';

export const DEPLOYDIFF_SHOW_OUTPUT_COMMAND_ID = 'deploydiff.showOutput';

export function registerShowOutputCommand(logger: DeployDiffLogger): vscode.Disposable {
  return vscode.commands.registerCommand(DEPLOYDIFF_SHOW_OUTPUT_COMMAND_ID, () => {
    logger.info('Opening DeployDiff output channel');
    logger.show(false);
  });
}
