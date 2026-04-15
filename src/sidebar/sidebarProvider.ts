import * as vscode from 'vscode';
import { DiffSession } from './diffSession';
import { DiffSessionManager } from './diffSessionManager';

export const OPEN_DIFF_SESSION_COMMAND_ID = 'deploydiff.openDiffSession';

function getSessionDirectionLabel(session: DiffSession): string {
  let originalIsLocal = true;
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
          originalIsLocal = input.original.toString() === session.localUri.toString();
          break;
        }
      }
    }
  }

  const localDoc = vscode.workspace.textDocuments.find(
    (doc) => doc.uri.toString() === session.localUri.toString()
  );
  const remoteDoc = vscode.workspace.textDocuments.find(
    (doc) => doc.uri.toString() === session.remoteUri.toString()
  );
  const localDirty = localDoc?.isDirty ? '*' : '';
  const remoteDirty = remoteDoc?.isDirty ? '*' : '';

  return originalIsLocal
    ? `(local${localDirty} ↔ remote${remoteDirty})`
    : `(remote${remoteDirty} ↔ local${localDirty})`;
}

export class DiffSessionTreeItem extends vscode.TreeItem {
  public constructor(public readonly session: DiffSession) {
    const fileName = session.localUri.path.split('/').pop() ?? session.localUri.toString();
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

  private async collectFilesRecursively(uri: vscode.Uri, token: vscode.CancellationToken): Promise<vscode.Uri[]> {
    const files: vscode.Uri[] = [];
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.type === vscode.FileType.File) {
        files.push(uri);
      } else if (stat.type === vscode.FileType.Directory || (stat.type as number) === (vscode.FileType.Directory | vscode.FileType.SymbolicLink)) {
        const entries = await vscode.workspace.fs.readDirectory(uri);
        for (const [name, type] of entries) {
          if (token.isCancellationRequested) {
            break;
          }
          const childUri = vscode.Uri.joinPath(uri, name);
          if (type === vscode.FileType.File) {
            files.push(childUri);
          } else if (type === vscode.FileType.Directory || (type as number) === (vscode.FileType.Directory | vscode.FileType.SymbolicLink)) {
            const nested = await this.collectFilesRecursively(childUri, token);
            files.push(...nested);
          }
        }
      }
    } catch {
      // ignore unreadable paths
    }
    return files;
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
          const files = await this.collectFilesRecursively(uri, token);
          for (const fileUri of files) {
            if (token.isCancellationRequested) {
              break;
            }
            await vscode.commands.executeCommand('deploydiff.compareWithDeployedVersion', fileUri);
          }
        }
      } catch {
        // ignore invalid uris
      }
    }
  }
}
