import * as vscode from 'vscode';

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export type LogContext = Record<string, unknown>;

export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (
    typeof error === 'number' ||
    typeof error === 'boolean' ||
    typeof error === 'bigint' ||
    typeof error === 'symbol' ||
    error === null ||
    error === undefined
  ) {
    return String(error);
  }

  if (typeof error === 'function') {
    return `[Function ${error.name || 'anonymous'}]`;
  }

  try {
    return JSON.stringify(error) ?? Object.prototype.toString.call(error);
  } catch {
    return Object.prototype.toString.call(error);
  }
}

function formatContextValue(value: unknown): string {
  if (value instanceof vscode.Uri) {
    return value.toString();
  }

  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint' ||
    typeof value === 'symbol' ||
    value === null ||
    value === undefined
  ) {
    return String(value);
  }

  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`;
  }

  try {
    return JSON.stringify(value) ?? Object.prototype.toString.call(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

function formatLogContext(context?: LogContext): string {
  if (!context || Object.keys(context).length === 0) {
    return '';
  }

  const parts = Object.entries(context).map(([key, value]) => `${key}=${formatContextValue(value)}`);
  return ` | ${parts.join(', ')}`;
}

export class DeployDiffLogger implements vscode.Disposable {
  private readonly outputChannel = vscode.window.createOutputChannel('DeployDiff');

  public info(message: string, context?: LogContext): void {
    this.write('INFO', message, context);
  }

  public warn(message: string, context?: LogContext): void {
    this.write('WARN', message, context);
  }

  public error(message: string, error?: unknown, context?: LogContext): void {
    this.write('ERROR', message, context);

    if (error === undefined) {
      this.show(false);
      return;
    }

    const detailPrefix = `[${new Date().toISOString()}] [ERROR] `;
    for (const line of describeError(error).split(/\r?\n/)) {
      this.outputChannel.appendLine(`${detailPrefix}${line}`);
    }

    this.show(false);
  }

  public show(preserveFocus = false): void {
    this.outputChannel.show(preserveFocus);
  }

  public dispose(): void {
    this.outputChannel.dispose();
  }

  private write(level: LogLevel, message: string, context?: LogContext): void {
    this.outputChannel.appendLine(
      `[${new Date().toISOString()}] [${level}] ${message}${formatLogContext(context)}`
    );
  }
}
