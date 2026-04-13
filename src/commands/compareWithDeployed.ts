import * as vscode from 'vscode';
import { getOrResolveResourceUri } from '../config/deploymentConfiguration';
import { openDeployedDiff } from '../diff/openDeployedDiff';
import { RemoteDiffDocumentProvider } from '../diff/remoteDiffDocumentProvider';
import { DeployDiffLogger } from '../logging/outputLogger';
import { registerDeployCommand } from './runDeployCommand';
import { DiffSessionManager } from '../sidebar/diffSessionManager';
import { createRemoteDocumentUri } from '../diff/remoteDiffDocumentProvider';

export function registerCompareWithDeployedCommand(
  remoteDiffDocumentProvider: RemoteDiffDocumentProvider,
  logger: DeployDiffLogger,
  diffSessionManager: DiffSessionManager
): vscode.Disposable {
  return registerDeployCommand('deploydiff.compareWithDeployedVersion', logger, async (resource?: vscode.Uri) => {
    const localFileUri = getOrResolveResourceUri(resource);
    await openDeployedDiff(localFileUri, remoteDiffDocumentProvider, logger);
    diffSessionManager.addOrUpdate({
      localUri: localFileUri,
      remoteUri: createRemoteDocumentUri(localFileUri)
    });
  });
}
