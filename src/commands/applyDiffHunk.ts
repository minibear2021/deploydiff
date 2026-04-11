import * as vscode from 'vscode';
import { getOrResolveResourceUri, resolveDeploymentTarget } from '../config/deploymentConfiguration';
import { RemoteDiffDocumentProvider } from '../diff/remoteDiffDocumentProvider';
import { computeDiffHunks, DiffHunk, extractLines, replaceLinesInText } from '../diff/hunks';
import { createRemoteFileProvider } from '../remote/RemoteFileProvider';
import { registerDeployCommand } from './runDeployCommand';

type HunkCommandArguments = {
  localFileUri: string;
  hunk: DiffHunk;
};

export function registerApplyHunkToRemoteCommand(
  context: vscode.ExtensionContext,
  remoteDiffDocumentProvider: RemoteDiffDocumentProvider
): vscode.Disposable {
  return registerDeployCommand('deploydiff.applyHunkToRemote', async (resource?: vscode.Uri) => {
    const argumentsPayload = await resolveHunkArguments(resource, remoteDiffDocumentProvider);

    const localFileUri = vscode.Uri.parse(argumentsPayload.localFileUri);
    const target = resolveDeploymentTarget(localFileUri);
    const provider = await createRemoteFileProvider(target.workspaceFolder, context.secrets);
    const localBytes = await vscode.workspace.fs.readFile(localFileUri);
    const localText = Buffer.from(localBytes).toString('utf8');
    const remoteText = await provider.readFile(target.remoteFilePath);
    const replacement = extractLines(localText, argumentsPayload.hunk.localStartLine, argumentsPayload.hunk.localEndLine);
    const nextRemoteText = replaceLinesInText(
      remoteText,
      argumentsPayload.hunk.remoteStartLine,
      argumentsPayload.hunk.remoteEndLine,
      replacement
    );

    await provider.writeFile(target.remoteFilePath, nextRemoteText);
    remoteDiffDocumentProvider.refresh(localFileUri);
  });
}

export function registerApplyHunkToLocalCommand(
  context: vscode.ExtensionContext,
  remoteDiffDocumentProvider: RemoteDiffDocumentProvider
): vscode.Disposable {
  return registerDeployCommand('deploydiff.applyHunkToLocal', async (resource?: vscode.Uri) => {
    const argumentsPayload = await resolveHunkArguments(resource, remoteDiffDocumentProvider);

    const localFileUri = vscode.Uri.parse(argumentsPayload.localFileUri);
    const target = resolveDeploymentTarget(localFileUri);
    const provider = await createRemoteFileProvider(target.workspaceFolder, context.secrets);
    const localBytes = await vscode.workspace.fs.readFile(localFileUri);
    const localText = Buffer.from(localBytes).toString('utf8');
    const remoteText = await provider.readFile(target.remoteFilePath);
    const replacement = extractLines(remoteText, argumentsPayload.hunk.remoteStartLine, argumentsPayload.hunk.remoteEndLine);
    const nextLocalText = replaceLinesInText(
      localText,
      argumentsPayload.hunk.localStartLine,
      argumentsPayload.hunk.localEndLine,
      replacement
    );

    await vscode.workspace.fs.writeFile(localFileUri, Buffer.from(nextLocalText, 'utf8'));
    remoteDiffDocumentProvider.refresh(localFileUri);
  });
}

async function resolveHunkArguments(
  resource: vscode.Uri | undefined,
  remoteDiffDocumentProvider: RemoteDiffDocumentProvider
): Promise<HunkCommandArguments> {
  const candidate = resource as unknown as HunkCommandArguments | undefined;
  if (candidate?.localFileUri && candidate.hunk) {
    return candidate;
  }

  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    throw new Error('Open a diff editor and place the cursor inside a changed block first.');
  }

  const localFileUri = getOrResolveResourceUri(resource ?? activeEditor.document.uri);
  await remoteDiffDocumentProvider.preload(localFileUri);
  const remoteText = remoteDiffDocumentProvider.getCachedContent(localFileUri);
  if (remoteText === undefined) {
    throw new Error('The deployed diff content is not loaded yet. Open Compare with Deployed Version first.');
  }

  const localBytes = await vscode.workspace.fs.readFile(localFileUri);
  const localText = Buffer.from(localBytes).toString('utf8');
  const hunks = computeDiffHunks(localText, remoteText);
  const activeLine = activeEditor.selection.active.line;
  const isLocalSide = activeEditor.document.uri.scheme === 'file';
  const hunk = hunks.find((item) =>
    isLineInsideHunk(
      activeLine,
      isLocalSide ? item.localStartLine : item.remoteStartLine,
      isLocalSide ? item.localEndLine : item.remoteEndLine
    )
  );

  if (!hunk) {
    throw new Error('Place the cursor inside a changed block in the diff editor first.');
  }

  return {
    localFileUri: localFileUri.toString(),
    hunk
  };
}

function isLineInsideHunk(line: number, startLine: number, endLine: number): boolean {
  if (startLine === endLine) {
    return line === startLine;
  }

  return line >= startLine && line < endLine;
}