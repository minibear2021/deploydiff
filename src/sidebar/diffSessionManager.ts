import * as vscode from 'vscode';
import { DiffSession } from './diffSession';

function isUriInDiffTabs(uri: vscode.Uri): boolean {
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (tab.input instanceof vscode.TabInputTextDiff) {
        if (
          tab.input.original.toString() === uri.toString() ||
          tab.input.modified.toString() === uri.toString()
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

export class DiffSessionManager {
  private readonly sessions = new Map<string, DiffSession>();
  private readonly didChangeEmitter = new vscode.EventEmitter<void>();

  public readonly onDidChange = this.didChangeEmitter.event;

  public addOrUpdate(session: DiffSession): void {
    const key = session.localUri.toString();
    this.sessions.set(key, session);
    this.didChangeEmitter.fire();
  }

  public remove(localUri: vscode.Uri): void {
    const removed = this.sessions.delete(localUri.toString());
    if (removed) {
      this.didChangeEmitter.fire();
    }
  }

  public getAll(): DiffSession[] {
    return Array.from(this.sessions.values());
  }

  public findByLocalUri(localUri: vscode.Uri): DiffSession | undefined {
    return this.sessions.get(localUri.toString());
  }

  public pruneClosedSessions(): void {
    const toRemove: string[] = [];
    for (const [key, session] of this.sessions) {
      const localOpen = isUriInDiffTabs(session.localUri);
      const remoteOpen = isUriInDiffTabs(session.remoteUri);
      if (!localOpen && !remoteOpen) {
        toRemove.push(key);
      }
    }

    if (toRemove.length === 0) {
      return;
    }

    for (const key of toRemove) {
      this.sessions.delete(key);
    }
    this.didChangeEmitter.fire();
  }
}
