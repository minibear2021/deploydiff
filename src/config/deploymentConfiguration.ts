import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  DeploymentMapping,
  ResolvedDeploymentTarget,
  resolveMappingForFile
} from '../deployment/mapping';
import { getLocalFileUriFromRemoteDocumentUri, isRemoteDocumentUri } from '../diff/remoteDiffDocumentProvider';

type RawMapping = {
  name: string;
  localPath: string;
  remotePath: string;
};

export function parseDeploymentMapping(
  workspaceFolder: vscode.WorkspaceFolder,
  mapping: RawMapping,
  index: number
): DeploymentMapping {
  const name = mapping.name?.trim();
  const localPath = mapping.localPath?.trim();
  const remotePath = mapping.remotePath?.trim();
  const label = name || `mapping #${index + 1}`;

  if (!name) {
    throw new Error(`DeployDiff ${label} must define a non-empty name.`);
  }

  if (!localPath) {
    throw new Error(`DeployDiff ${label} must define a non-empty localPath.`);
  }

  if (!remotePath) {
    throw new Error(`DeployDiff ${label} must define a non-empty remotePath.`);
  }

  if (!remotePath.startsWith('/')) {
    throw new Error(`DeployDiff ${label} remotePath must be an absolute POSIX path.`);
  }

  return {
    name,
    localRoot: path.resolve(workspaceFolder.uri.fsPath, localPath),
    remoteRoot: remotePath.replace(/\/+$/, '') || '/'
  };
}

export function getOrResolveResourceUri(resource?: vscode.Uri): vscode.Uri {
  if (resource?.scheme === 'file') {
    return resource;
  }

  if (resource && isRemoteDocumentUri(resource)) {
    return getLocalFileUriFromRemoteDocumentUri(resource);
  }

  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (activeUri?.scheme === 'file') {
    return activeUri;
  }

  if (activeUri && isRemoteDocumentUri(activeUri)) {
    return getLocalFileUriFromRemoteDocumentUri(activeUri);
  }

  throw new Error('Select a local file in the explorer or open one in the editor first.');
}

export function getDeploymentMappings(workspaceFolder: vscode.WorkspaceFolder): DeploymentMapping[] {
  const configuration = vscode.workspace.getConfiguration('deploydiff', workspaceFolder.uri);
  const mappings = configuration.get<RawMapping[]>('mappings', []);

  return mappings.map((mapping, index) => parseDeploymentMapping(workspaceFolder, mapping, index));
}

export function resolveDeploymentTarget(localFileUri: vscode.Uri): ResolvedDeploymentTarget {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(localFileUri);
  if (!workspaceFolder) {
    throw new Error('The selected file is not inside an open workspace folder.');
  }

  const mappings = getDeploymentMappings(workspaceFolder);
  return resolveMappingForFile(localFileUri.fsPath, workspaceFolder, mappings);
}