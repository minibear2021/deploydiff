import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { runTests } from '@vscode/test-electron';

async function runExtensionTests(cachePath: string): Promise<void> {
  const extensionDevelopmentPath = path.resolve(__dirname, '../../');
  const extensionTestsPath = path.resolve(__dirname, './suite/index');
  const workspacePath = path.resolve(__dirname, '../../');

  await runTests({
    cachePath,
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [workspacePath]
  });
}

async function main(): Promise<void> {
  const cachePath = path.resolve(__dirname, '../../.vscode-test');

  try {
    await runExtensionTests(cachePath);
  } catch {
    console.warn(
      'Initial VS Code test launch failed. Clearing cached test install and retrying once.'
    );

    try {
      await fs.rm(cachePath, { recursive: true, force: true, maxRetries: 3 });
      await runExtensionTests(cachePath);
    } catch (retryError) {
      console.error('Failed to run extension tests.');
      console.error(retryError);
      process.exit(1);
    }
  }
}

void main();
