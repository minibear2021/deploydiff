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
  return registerDeployCommand('deploydiff.compareWithDeployedVersion', logger, async (resource?: vscode.Uri | vscode.Uri[]) => {
    const uris: vscode.Uri[] = [];
    if (Array.isArray(resource)) {
      uris.push(...resource);
    } else if (resource) {
      uris.push(resource);
    } else {
      uris.push(getOrResolveResourceUri(undefined));
    }

    let openedCount = 0;
    const failedNames: string[] = [];

    for (const localFileUri of uris) {
      if (localFileUri.scheme !== 'file') {
        continue;
      }
      try {
        await openDeployedDiff(localFileUri, remoteDiffDocumentProvider, logger);
        diffSessionManager.addOrUpdate({
          localUri: localFileUri,
          remoteUri: createRemoteDocumentUri(localFileUri)
        });
        openedCount++;
      } catch (error) {
        const name = localFileUri.path.split('/').pop() ?? localFileUri.toString();
        failedNames.push(name);
        logger.error('Failed to compare file', error, { localFile: localFileUri.fsPath });
      }
    }

    if (failedNames.length > 0 && openedCount === 0) {
      throw new Error(`Could not compare ${failedNames.join(', ')}. See the DeployDiff output channel for details.`);
    }
  });
}
