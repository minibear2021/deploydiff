import * as path from 'node:path';
import * as vscode from 'vscode';

export type DeploymentMapping = {
  name: string;
  localRoot: string;
  remoteRoot: string;
};

export type ResolvedDeploymentTarget = {
  workspaceFolder: vscode.WorkspaceFolder;
  mapping: DeploymentMapping;
  localFilePath: string;
  relativePath: string;
  remoteFilePath: string;
};

export function resolveMappingForFile(
  localFilePath: string,
  workspaceFolder: vscode.WorkspaceFolder,
  mappings: DeploymentMapping[]
): ResolvedDeploymentTarget {
  const normalizedFilePath = path.normalize(localFilePath);
  const matchingMapping = [...mappings]
    .sort((left, right) => right.localRoot.length - left.localRoot.length)
    .find((mapping) => {
      const normalizedRoot = ensureTrailingSeparator(path.normalize(mapping.localRoot));
      return normalizedFilePath.startsWith(normalizedRoot) || normalizedFilePath === path.normalize(mapping.localRoot);
    });

  if (!matchingMapping) {
    throw new Error(
      'No deployment mapping matched this file. Add deploydiff.mappings in workspace settings first.'
    );
  }

  const relativePath = path.relative(matchingMapping.localRoot, normalizedFilePath);
  const remoteFilePath = toRemoteFilePath(matchingMapping, normalizedFilePath);

  return {
    workspaceFolder,
    mapping: matchingMapping,
    localFilePath: normalizedFilePath,
    relativePath,
    remoteFilePath
  };
}

export function toRemoteFilePath(mapping: DeploymentMapping, localFilePath: string): string {
  const relativePath = path.relative(mapping.localRoot, path.normalize(localFilePath));
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`The selected file is outside the mapping root ${mapping.localRoot}.`);
  }

  return joinRemotePath(mapping.remoteRoot, relativePath);
}

function ensureTrailingSeparator(inputPath: string): string {
  return inputPath.endsWith(path.sep) ? inputPath : `${inputPath}${path.sep}`;
}

function joinRemotePath(remoteRoot: string, relativePath: string): string {
  const remoteSegments = relativePath.split(path.sep).filter(Boolean);
  const sanitizedRoot = remoteRoot.replace(/\/+$/, '');
  return [sanitizedRoot, ...remoteSegments].join('/');
}