import * as vscode from 'vscode';

export type DiffSession = {
  localUri: vscode.Uri;
  remoteUri: vscode.Uri;
};
