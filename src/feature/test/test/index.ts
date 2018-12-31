import * as vscode from 'vscode';
import { Decorations } from './decoration';
import { destroy, onDocumentClose, onDocumentUpdate } from './editor';
import { launchTests } from './launch';

export function activate(context: vscode.ExtensionContext) {
  Decorations.context = context;

  try {
    vscode.workspace.onDidOpenTextDocument(x => onDocumentUpdate(x, 0), null, context.subscriptions);
    vscode.workspace.onDidSaveTextDocument(x => onDocumentUpdate(x), null, context.subscriptions);
    vscode.workspace.onDidCloseTextDocument(x => onDocumentClose(x), null, context.subscriptions);
    vscode.window.onDidChangeActiveTextEditor(x => onDocumentUpdate(x), null, context.subscriptions);

    // vscode.window.onDidChangeVisibleTextEditors(eds => eds.forEach(x => onDocumentUpdate(x, 0)), null, context.subscriptions);
    setTimeout(() => vscode.window.visibleTextEditors.forEach(x => onDocumentUpdate(x, 0)), 1000);
  } catch (e) {
    console.error('WOAH', e);
  }
}
export function deactivate() {
  destroy();
}

vscode.commands.registerCommand('travetto.test.test:all', async config => launchTests());
vscode.commands.registerCommand('travetto.test.test:line', async config => launchTests(true));
vscode.commands.registerCommand('travetto.test.test:rerun', async config => onDocumentUpdate(vscode.window.activeTextEditor, 0));
