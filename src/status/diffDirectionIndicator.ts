import * as vscode from 'vscode';
import { isRemoteDocumentUri } from '../diff/remoteDiffDocumentProvider';

export class DiffDirectionIndicator implements vscode.Disposable {
  private readonly statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
  private readonly disposables: vscode.Disposable[] = [];

  public constructor() {
    this.statusBarItem.name = 'DeployDiff Direction';

    this.disposables.push(
      vscode.window.tabGroups.onDidChangeTabs(() => this.update()),
      vscode.window.onDidChangeActiveTextEditor(() => this.update())
    );

    this.update();
  }

  public update(): void {
    const diffInput = this.getActiveDiffInput();
    if (!diffInput) {
      this.statusBarItem.hide();
      return;
    }

    const leftIsRemote = isRemoteDocumentUri(diffInput.original);
    const leftRole = leftIsRemote ? 'remote' : 'local';
    const rightRole = leftIsRemote ? 'local' : 'remote';

    this.statusBarItem.text = `$(arrow-left) ${leftRole}  |  ${rightRole} $(arrow-right)`;
    this.statusBarItem.tooltip = `Left: ${leftRole}  —  Right: ${rightRole}\nRevert Block pushes right → left (${rightRole} → ${leftRole})`;
    this.statusBarItem.show();
  }

  private getActiveDiffInput(): vscode.TabInputTextDiff | undefined {
    const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
    if (!activeTab || !(activeTab.input instanceof vscode.TabInputTextDiff)) {
      return undefined;
    }

    const input = activeTab.input;
    if (isRemoteDocumentUri(input.original) || isRemoteDocumentUri(input.modified)) {
      return input;
    }

    return undefined;
  }

  public dispose(): void {
    this.statusBarItem.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
