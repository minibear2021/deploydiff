import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  DeploymentMapping,
  ResolvedDeploymentTarget,
  resolveMappingForFile
} from '../deployment/mapping';

type RawMapping = {
  name: string;
  localPath: string;
  remotePath: string;
};

export function getOrResolveResourceUri(resource?: vscode.Uri): vscode.Uri {
  if (resource?.scheme === 'file') {
    return resource;
  }

  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (activeUri?.scheme === 'file') {
    return activeUri;
  }

  throw new Error('Select a local file in the explorer or open one in the editor first.');
}

export function getDeploymentMappings(workspaceFolder: vscode.WorkspaceFolder): DeploymentMapping[] {
  const configuration = vscode.workspace.getConfiguration('deploydiff', workspaceFolder.uri);
  const mappings = configuration.get<RawMapping[]>('mappings', []);

  return mappings.map((mapping) => ({
    name: mapping.name,
    localRoot: path.resolve(workspaceFolder.uri.fsPath, mapping.localPath),
    remoteRoot: mapping.remotePath
  }));
}

export function resolveDeploymentTarget(localFileUri: vscode.Uri): ResolvedDeploymentTarget {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(localFileUri);
  if (!workspaceFolder) {
    throw new Error('The selected file is not inside an open workspace folder.');
  }

  const mappings = getDeploymentMappings(workspaceFolder);
  return resolveMappingForFile(localFileUri.fsPath, workspaceFolder, mappings);
}