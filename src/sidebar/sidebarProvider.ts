import * as vscode from 'vscode';
import { DiffSession } from './diffSession';
import { DiffSessionManager } from './diffSessionManager';

export const OPEN_DIFF_SESSION_COMMAND_ID = 'deploydiff.openDiffSession';

function getSessionDirectionLabel(session: DiffSession): string {
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (tab.input instanceof vscode.TabInputTextDiff) {
        const input = tab.input;
        const matchesSession =
          input.original.toString() === session.localUri.toString() &&
          input.modified.toString() === session.remoteUri.toString();
        const matchesSwapped =
          input.original.toString() === session.remoteUri.toString() &&
          input.modified.toString() === session.localUri.toString();
        if (matchesSession || matchesSwapped) {
          const originalIsLocal = input.original.toString() === session.localUri.toString();
          return originalIsLocal ? '(local ↔ remote)' : '(remote ↔ local)';
        }
      }
    }
  }
  return '(local ↔ remote)';
}

export class DiffSessionTreeItem extends vscode.TreeItem {
  public constructor(public readonly session: DiffSession) {
    const fileName = session.localUri.path.split('/').pop() ?? session.localUri.toString();
    const isDirty = DiffSessionTreeItem.isSessionDirty(session);
    super(fileName, vscode.TreeItemCollapsibleState.None);

    const directionLabel = getSessionDirectionLabel(session);
    this.description = `${vscode.workspace.asRelativePath(session.localUri)} ${directionLabel}`;
    this.tooltip = session.localUri.fsPath;
    this.contextValue = 'diffSession';
    this.iconPath = new vscode.ThemeIcon('file');
    this.command = {
      command: OPEN_DIFF_SESSION_COMMAND_ID,
      title: 'Open Diff Session',
      arguments: [session.localUri]
    };

    if (isDirty) {
      this.label = `${fileName} *`;
    }
  }

  private static isSessionDirty(session: DiffSession): boolean {
    const localDoc = vscode.workspace.textDocuments.find(
      (doc) => doc.uri.toString() === session.localUri.toString()
    );
    const remoteDoc = vscode.workspace.textDocuments.find(
      (doc) => doc.uri.toString() === session.remoteUri.toString()
    );
    return Boolean(localDoc?.isDirty || remoteDoc?.isDirty);
  }
}

export class DeployDiffSidebarProvider implements vscode.TreeDataProvider<DiffSessionTreeItem>, vscode.TreeDragAndDropController<DiffSessionTreeItem>, vscode.Disposable {
  private readonly didChangeTreeDataEmitter = new vscode.EventEmitter<DiffSessionTreeItem | void>();
  private readonly textDocumentChangeDisposable: vscode.Disposable;
  private readonly tabGroupsChangeDisposable: vscode.Disposable;

  public readonly onDidChangeTreeData = this.didChangeTreeDataEmitter.event;
  public readonly dropMimeTypes = ['text/uri-list'];
  public readonly dragMimeTypes: string[] = [];

  public constructor(private readonly manager: DiffSessionManager) {
    this.manager.onDidChange(() => this.refresh());

    this.textDocumentChangeDisposable = vscode.workspace.onDidChangeTextDocument(() => this.refresh());
    this.tabGroupsChangeDisposable = vscode.window.tabGroups.onDidChangeTabs(() => this.refresh());
  }

  public dispose(): void {
    this.textDocumentChangeDisposable.dispose();
    this.tabGroupsChangeDisposable.dispose();
    this.didChangeTreeDataEmitter.dispose();
  }

  public getTreeItem(element: DiffSessionTreeItem): vscode.TreeItem {
    return element;
  }

  public getChildren(): DiffSessionTreeItem[] {
    return this.manager.getAll().map((session) => new DiffSessionTreeItem(session));
  }

  public refresh(): void {
    this.didChangeTreeDataEmitter.fire();
  }

  public async handleDrop(
    _target: DiffSessionTreeItem | undefined,
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<void> {
    const uriListItem = dataTransfer.get('text/uri-list');
    if (!uriListItem) {
      return;
    }

    const uriListString = await uriListItem.asString();
    const uriStrings = uriListString.split('\n').map((s) => s.trim()).filter(Boolean);

    for (const uriString of uriStrings) {
      if (token.isCancellationRequested) {
        break;
      }
      try {
        const uri = vscode.Uri.parse(uriString);
        if (uri.scheme === 'file') {
          await vscode.commands.executeCommand('deploydiff.compareWithDeployedVersion', uri);
        }
      } catch {
        // ignore invalid uris
      }
    }
  }
}
