import * as vscode from 'vscode';
import { getOrResolveResourceUri } from '../config/deploymentConfiguration';
import { openDeployedDiff } from '../diff/openDeployedDiff';
import { RemoteDiffDocumentProvider } from '../diff/remoteDiffDocumentProvider';
import { DeployDiffLogger } from '../logging/outputLogger';
import { registerDeployCommand } from './runDeployCommand';

export function registerCompareWithDeployedCommand(
  remoteDiffDocumentProvider: RemoteDiffDocumentProvider,
  logger: DeployDiffLogger
): vscode.Disposable {
  return registerDeployCommand('deploydiff.compareWithDeployedVersion', logger, async (resource?: vscode.Uri) => {
    const localFileUri = getOrResolveResourceUri(resource);
    await openDeployedDiff(localFileUri, remoteDiffDocumentProvider, logger);
  });
}
