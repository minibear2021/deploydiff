import * as assert from 'node:assert';
import * as vscode from 'vscode';

suite('Extension bootstrap', () => {
  test('commands are registered', async () => {
    const extension = vscode.extensions.getExtension('chen.deploydiff');
    assert.ok(extension);

    await extension.activate();

    const commands = await vscode.commands.getCommands(true);

    assert.ok(commands.includes('deploydiff.compareWithDeployedVersion'));
    assert.ok(commands.includes('deploydiff.uploadToRemote'));
    assert.ok(commands.includes('deploydiff.downloadFromRemote'));
  });
});