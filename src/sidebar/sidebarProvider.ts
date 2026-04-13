import * as vscode from 'vscode';
import { DiffSession } from './diffSession';
import { DiffSessionManager } from './diffSessionManager';

export const OPEN_DIFF_SESSION_COMMAND_ID = 'deploydiff.openDiffSession';

export class DiffSessionTreeItem extends vscode.TreeItem {
  public constructor(public readonly session: DiffSession) {
    const fileName = session.localUri.path.split('/').pop() ?? session.localUri.toString();
    const isDirty = DiffSessionTreeItem.isSessionDirty(session);
    super(fileName, vscode.TreeItemCollapsibleState.None);

    this.description = vscode.workspace.asRelativePath(session.localUri);
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

export class DeployDiffSidebarProvider implements vscode.TreeDataProvider<DiffSessionTreeItem>, vscode.Disposable {
  private readonly didChangeTreeDataEmitter = new vscode.EventEmitter<DiffSessionTreeItem | void>();
  private readonly textDocumentChangeDisposable: vscode.Disposable;

  public readonly onDidChangeTreeData = this.didChangeTreeDataEmitter.event;

  public constructor(private readonly manager: DiffSessionManager) {
    this.manager.onDidChange(() => this.refresh());

    this.textDocumentChangeDisposable = vscode.workspace.onDidChangeTextDocument(() => this.refresh());
  }

  public dispose(): void {
    this.textDocumentChangeDisposable.dispose();
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
}
