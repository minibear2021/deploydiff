import { diffLines } from 'diff';

export type DiffHunk = {
  localStartLine: number;
  localEndLine: number;
  remoteStartLine: number;
  remoteEndLine: number;
};

export function computeDiffHunks(localText: string, remoteText: string): DiffHunk[] {
  const changes = diffLines(localText, remoteText);
  const hunks: DiffHunk[] = [];

  let localLine = 0;
  let remoteLine = 0;
  let currentHunk: DiffHunk | undefined;

  for (const change of changes) {
    const lineCount = countLines(change.value);

    if (!change.added && !change.removed) {
      if (currentHunk) {
        hunks.push(currentHunk);
        currentHunk = undefined;
      }

      localLine += lineCount;
      remoteLine += lineCount;
      continue;
    }

    if (!currentHunk) {
      currentHunk = {
        localStartLine: localLine,
        localEndLine: localLine,
        remoteStartLine: remoteLine,
        remoteEndLine: remoteLine
      };
    }

    if (change.removed) {
      localLine += lineCount;
      currentHunk.localEndLine = localLine;
      continue;
    }

    remoteLine += lineCount;
    currentHunk.remoteEndLine = remoteLine;
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
}

export function replaceLinesInText(text: string, startLine: number, endLine: number, replacement: string): string {
  const offsets = getLineStartOffsets(text);
  const startOffset = getOffsetForLine(offsets, text, startLine);
  const endOffset = getOffsetForLine(offsets, text, endLine);
  return `${text.slice(0, startOffset)}${replacement}${text.slice(endOffset)}`;
}

export function extractLines(text: string, startLine: number, endLine: number): string {
  const offsets = getLineStartOffsets(text);
  const startOffset = getOffsetForLine(offsets, text, startLine);
  const endOffset = getOffsetForLine(offsets, text, endLine);
  return text.slice(startOffset, endOffset);
}

function countLines(value: string): number {
  if (value.length === 0) {
    return 0;
  }

  const matches = value.match(/\r\n|\r|\n/g);
  const newlineCount = matches?.length ?? 0;
  return value.endsWith('\n') || value.endsWith('\r') ? newlineCount : newlineCount + 1;
}

function getLineStartOffsets(text: string): number[] {
  const offsets = [0];

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '\n') {
      offsets.push(index + 1);
      continue;
    }

    if (character === '\r') {
      if (text[index + 1] === '\n') {
        offsets.push(index + 2);
        index += 1;
      } else {
        offsets.push(index + 1);
      }
    }
  }

  return offsets;
}

function getOffsetForLine(offsets: number[], text: string, line: number): number {
  if (line <= 0) {
    return 0;
  }

  if (line >= offsets.length) {
    return text.length;
  }

  return offsets[line];
}