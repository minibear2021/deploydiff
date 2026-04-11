import * as vscode from 'vscode';
import { getOrResolveResourceUri } from '../config/deploymentConfiguration';
import { openDeployedDiff } from '../diff/openDeployedDiff';

export function registerCompareWithDeployedCommand(
): vscode.Disposable {
  return vscode.commands.registerCommand(
    'deploydiff.compareWithDeployedVersion',
    async (resource?: vscode.Uri) => {
      const localFileUri = getOrResolveResourceUri(resource);
      await openDeployedDiff(localFileUri);
    }
  );
}