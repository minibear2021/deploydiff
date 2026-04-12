export function getRemoteParentDirectory(remotePath: string): string {
  const normalizedPath = remotePath.replace(/\/+/g, '/');
  const lastSlashIndex = normalizedPath.lastIndexOf('/');

  if (lastSlashIndex <= 0) {
    return '/';
  }

  return normalizedPath.slice(0, lastSlashIndex) || '/';
}

export function getRemoteFileName(remotePath: string): string {
  const normalizedPath = remotePath.replace(/\/+/g, '/');
  const fileName = normalizedPath.split('/').pop();

  if (!fileName) {
    throw new Error(`DeployDiff could not resolve a file name from remote path ${remotePath}.`);
  }

  return fileName;
}

export function joinRemotePath(remoteRoot: string, childName: string): string {
  const sanitizedRoot = remoteRoot.replace(/\/+/g, '/').replace(/\/+$/, '') || '/';
  const sanitizedChild = childName.replace(/\/+/g, '/').replace(/^\/+/, '');

  if (!sanitizedChild) {
    return sanitizedRoot;
  }

  if (sanitizedRoot === '/') {
    return `/${sanitizedChild}`;
  }

  return `${sanitizedRoot}/${sanitizedChild}`;
}