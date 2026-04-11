import * as vscode from 'vscode';
import { getOrResolveResourceUri, resolveDeploymentTarget } from '../config/deploymentConfiguration';
import { isRemoteDocumentUri, RemoteDiffDocumentProvider } from '../diff/remoteDiffDocumentProvider';

export class DeploymentStatusIndicator implements vscode.Disposable {
  private readonly statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);

  public constructor(private readonly remoteDiffDocumentProvider: RemoteDiffDocumentProvider) {
    this.statusBarItem.name = 'DeployDiff Target';
    this.statusBarItem.command = 'deploydiff.compareWithDeployedVersion';
    this.update();
  }

  public update(): void {
    const activeUri = vscode.window.activeTextEditor?.document.uri;
    if (!activeUri || (activeUri.scheme !== 'file' && !isRemoteDocumentUri(activeUri))) {
      this.statusBarItem.hide();
      return;
    }

    try {
      const localFileUri = getOrResolveResourceUri(activeUri);
      const target = resolveDeploymentTarget(localFileUri);
      const remoteMetadata = this.remoteDiffDocumentProvider.getCachedMetadata(localFileUri);
      const metadataLine = remoteMetadata
        ? remoteMetadata.modifiedAt
          ? `Remote modified: ${remoteMetadata.modifiedAt.toISOString()}`
          : `Remote size: ${remoteMetadata.size} bytes`
        : 'Remote metadata not loaded yet';

      this.statusBarItem.text = `DeployDiff $(arrow-right) ${target.mapping.name}`;
      this.statusBarItem.tooltip = `Remote path: ${target.remoteFilePath}\n${metadataLine}`;
      this.statusBarItem.show();
    } catch {
      this.statusBarItem.hide();
    }
  }

  public dispose(): void {
    this.statusBarItem.dispose();
  }
}