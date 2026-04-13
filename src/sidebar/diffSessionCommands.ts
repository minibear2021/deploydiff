import * as vscode from 'vscode';
import { DeployDiffLogger } from '../logging/outputLogger';
import { RemoteDiffDocumentProvider } from '../diff/remoteDiffDocumentProvider';
import { DiffSessionManager } from './diffSessionManager';

export const SAVE_ALL_DIFF_SESSIONS_COMMAND_ID = 'deploydiff.saveAllDiffSessions';
export const REMOVE_DIFF_SESSION_COMMAND_ID = 'deploydiff.removeDiffSession';

export function registerOpenDiffSessionCommand(
  manager: DiffSessionManager,
  remoteDiffDocumentProvider: RemoteDiffDocumentProvider,
  logger: DeployDiffLogger
): vscode.Disposable {
  return vscode.commands.registerCommand('deploydiff.openDiffSession', async (localUri: vscode.Uri) => {
    const session = manager.findByLocalUri(localUri);
    if (!session) {
      logger.warn('Diff session not found', { localFile: localUri.fsPath });
      return;
    }

    logger.info('Opening diff session from sidebar', { localFile: localUri.fsPath });

    const localDocument = await vscode.workspace.openTextDocument(session.localUri);
    const remoteDocument = await vscode.workspace.openTextDocument(session.remoteUri);
    const fileName = session.localUri.path.split('/').pop() ?? session.localUri.toString();
    const title = `${fileName} ↔ ${fileName}`;

    if (remoteDocument.languageId !== localDocument.languageId) {
      await vscode.languages.setTextDocumentLanguage(remoteDocument, localDocument.languageId);
    }

    await vscode.commands.executeCommand('vscode.diff', session.localUri, session.remoteUri, title, {
      preview: false
    });
    logger.info('Diff session opened', { localFile: localUri.fsPath, title });
  });
}

export function registerSaveAllDiffSessionsCommand(
  manager: DiffSessionManager,
  logger: DeployDiffLogger
): vscode.Disposable {
  return vscode.commands.registerCommand(SAVE_ALL_DIFF_SESSIONS_COMMAND_ID, async () => {
    const sessions = manager.getAll();
    if (sessions.length === 0) {
      await vscode.window.showInformationMessage('No active DeployDiff sessions to save.');
      return;
    }

    logger.info('Saving all diff sessions', { count: sessions.length });

    let savedCount = 0;
    let failedCount = 0;
    const failedFiles: string[] = [];

    for (const session of sessions) {
      const docs = vscode.workspace.textDocuments.filter(
        (doc) => doc.uri.toString() === session.localUri.toString() || doc.uri.toString() === session.remoteUri.toString()
      );

      for (const doc of docs) {
        if (!doc.isDirty) {
          continue;
        }

        try {
          await doc.save();
          savedCount++;
          logger.info('Saved document', { uri: doc.uri.toString() });
        } catch (error) {
          failedCount++;
          const name = doc.uri.path.split('/').pop() ?? doc.uri.toString();
          failedFiles.push(name);
          logger.error('Failed to save document', error, { uri: doc.uri.toString() });
        }
      }
    }

    if (failedCount > 0) {
      await vscode.window.showWarningMessage(
        `Saved ${savedCount} document(s). Failed to save ${failedCount}: ${failedFiles.join(', ')}`
      );
    } else if (savedCount > 0) {
      await vscode.window.showInformationMessage(`Saved ${savedCount} document(s).`);
    } else {
      await vscode.window.showInformationMessage('No unsaved changes in DeployDiff sessions.');
    }

    logger.info('Save all diff sessions completed', { savedCount, failedCount });
  });
}

export function registerRemoveDiffSessionCommand(manager: DiffSessionManager): vscode.Disposable {
  return vscode.commands.registerCommand(REMOVE_DIFF_SESSION_COMMAND_ID, (localUri: vscode.Uri) => {
    manager.remove(localUri);
  });
}
