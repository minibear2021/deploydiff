import * as vscode from 'vscode';
import { getOrResolveResourceUri } from '../config/deploymentConfiguration';
import { RemoteDiffDocumentProvider } from '../diff/remoteDiffDocumentProvider';
import { registerDeployCommand } from './runDeployCommand';

export function registerRefreshDeployedVersionCommand(
  remoteDiffDocumentProvider: RemoteDiffDocumentProvider
): vscode.Disposable {
  return registerDeployCommand('deploydiff.refreshDeployedVersion', async (resource?: vscode.Uri) => {
    const localFileUri = getOrResolveResourceUri(resource);
    await remoteDiffDocumentProvider.preload(localFileUri);
    remoteDiffDocumentProvider.refresh(localFileUri);
  });
}