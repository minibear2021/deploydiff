import * as vscode from 'vscode';
import { registerCompareWithDeployedCommand } from './commands/compareWithDeployed';
import { registerDownloadFromRemoteCommand } from './commands/downloadFromRemote';
import {
  registerClearFtpPasswordCommand,
  registerSetFtpPasswordCommand
} from './commands/manageFtpPassword';
import {
  registerClearSftpPasswordCommand,
  registerSetSftpPasswordCommand
} from './commands/manageSftpPassword';
import { registerShowOutputCommand } from './commands/showOutput';
import { registerUploadToRemoteCommand } from './commands/uploadToRemote';
import {
  DEPLOYDIFF_REMOTE_DOCUMENT_SCHEME,
  RemoteDiffDocumentProvider
} from './diff/remoteDiffDocumentProvider';
import { DeployDiffLogger } from './logging/outputLogger';
import { DeploymentStatusIndicator } from './status/deploymentStatusIndicator';
import { DiffDirectionIndicator } from './status/diffDirectionIndicator';

export type DeployDiffExtensionApi = {
  secrets: vscode.SecretStorage;
};

export function activate(context: vscode.ExtensionContext): DeployDiffExtensionApi {
  const logger = new DeployDiffLogger();
  const remoteDiffDocumentProvider = new RemoteDiffDocumentProvider(context.secrets, logger);
  const deploymentStatusIndicator = new DeploymentStatusIndicator(remoteDiffDocumentProvider);
  const diffDirectionIndicator = new DiffDirectionIndicator();

  logger.info('DeployDiff extension activated');

  context.subscriptions.push(
    logger,
    deploymentStatusIndicator,
    diffDirectionIndicator,
    vscode.window.onDidChangeActiveTextEditor(() => deploymentStatusIndicator.update()),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('deploydiff')) {
        deploymentStatusIndicator.update();
      }
    }),
    vscode.workspace.registerFileSystemProvider(
      DEPLOYDIFF_REMOTE_DOCUMENT_SCHEME,
      remoteDiffDocumentProvider,
      {
        isCaseSensitive: true,
        isReadonly: false
      }
    ),
    registerCompareWithDeployedCommand(remoteDiffDocumentProvider, logger),
    registerUploadToRemoteCommand(context, remoteDiffDocumentProvider, logger),
    registerDownloadFromRemoteCommand(context, remoteDiffDocumentProvider, logger),
    registerShowOutputCommand(logger),
    registerSetFtpPasswordCommand(context, logger),
    registerClearFtpPasswordCommand(context, logger),
    registerSetSftpPasswordCommand(context, logger),
    registerClearSftpPasswordCommand(context, logger)
  );

  return {
    secrets: context.secrets
  };
}

export function deactivate(): void {}
