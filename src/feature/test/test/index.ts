import * as vscode from 'vscode';
import { activate as editorActivate, deactivate as editorDeactivate, onDocumentClose, onDocumentUpdate } from './editor';
import { launchTests } from './launch';
import { Workspace } from '../../../core/workspace';

export async function activate() {
  try {
    const context = Workspace.context;
    vscode.workspace.onDidOpenTextDocument(x => onDocumentUpdate(x, 0), null, context.subscriptions);
    vscode.workspace.onDidCloseTextDocument(x => onDocumentClose(x), null, context.subscriptions);
    vscode.window.onDidChangeActiveTextEditor(x => onDocumentUpdate(x), null, context.subscriptions);

    // vscode.window.onDidChangeVisibleTextEditors(eds => eds.forEach(x => onDocumentUpdate(x, 0)), null, context.subscriptions);
    setTimeout(() => vscode.window.visibleTextEditors.forEach(x => onDocumentUpdate(x, 0)), 1000);
  } catch (e) {
    console.error('WOAH', e);
  }

  await editorActivate();
}
export async function deactivate() {
  await editorDeactivate();
}

vscode.commands.registerCommand('travetto.test.test:all', async config => launchTests());
vscode.commands.registerCommand('travetto.test.test:line', async config => launchTests(true));
vscode.commands.registerCommand('travetto.test.test:rerun', async config => onDocumentUpdate(vscode.window.activeTextEditor, 0));
