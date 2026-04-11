import * as vscode from 'vscode';
import { getOrResolveResourceUri } from '../config/deploymentConfiguration';
import { openDeployedDiff } from '../diff/openDeployedDiff';
import { registerDeployCommand } from './runDeployCommand';

export function registerCompareWithDeployedCommand(
  context: vscode.ExtensionContext
): vscode.Disposable {
  return registerDeployCommand('deploydiff.compareWithDeployedVersion', async (resource?: vscode.Uri) => {
    const localFileUri = getOrResolveResourceUri(resource);
    await openDeployedDiff(localFileUri, context.secrets);
  });
}