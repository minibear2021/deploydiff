import * as vscode from 'vscode';
import { RemoteFileMetadata } from '../remote/RemoteFileProvider';

export type SyncDirection = 'upload' | 'download';

export function detectSyncConflict(
  direction: SyncDirection,
  localModifiedAt: Date,
  remoteMetadata: RemoteFileMetadata
): string | undefined {
  if (!remoteMetadata.modifiedAt) {
    return undefined;
  }

  const localTime = localModifiedAt.getTime();
  const remoteTime = remoteMetadata.modifiedAt.getTime();

  if (direction === 'upload' && remoteTime > localTime) {
    return `The deployed file was modified after the local file at ${remoteMetadata.modifiedAt.toISOString()}.`;
  }

  if (direction === 'download' && localTime > remoteTime) {
    return `The local file was modified after the deployed file at ${localModifiedAt.toISOString()}.`;
  }

  return undefined;
}

export async function confirmSyncConflict(
  direction: SyncDirection,
  conflictMessage: string,
  relativePath: string
): Promise<boolean> {
  const actionLabel = direction === 'upload' ? 'Overwrite Remote' : 'Overwrite Local';
  const answer = await vscode.window.showWarningMessage(
    `${conflictMessage} Continue syncing ${relativePath}?`,
    { modal: true },
    actionLabel
  );

  return answer === actionLabel;
}