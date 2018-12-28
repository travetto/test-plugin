import * as vscode from 'vscode';
import * as diff from 'diff';

import { TestRunner } from '../test-run/runner';
import { Decorations } from './decoration';

// Register typescript import
const runner = new TestRunner(vscode.window);
const prevText = new Map<vscode.TextDocument, string>();

process.on('exit', () => runner.shutdown());
process.on('SIGINT', () => runner.shutdown());
process.on('SIGTERM', () => runner.shutdown());

function isEditor(o: any): o is vscode.TextEditor {
  return 'document' in o;
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  Decorations.context = context;

  try {
    function onUpdate(editor?: vscode.TextEditor | vscode.TextDocument, line?: number) {

      if (!editor) {
        return;
      }

      if (!isEditor(editor)) {
        if (vscode.window.activeTextEditor.document === editor) {
          editor = vscode.window.activeTextEditor;
          line = editor.selection.start.line;
        } else {
          return;
        }
      }

      if (editor.document && /@Test\(/.test(editor.document.getText() || '')) {
        const newText = editor.document.getText();
        const lines = [];

        if (!lines.length && prevText.has(editor.document)) {
          const changes = diff.structuredPatch('a', 'b', prevText.get(editor.document), newText, 'a', 'b', { context: 0 });
          const newLines = changes.hunks.map(x => x.newStart || x.oldStart);
          if (newLines.length < 5) {
            lines.push(...newLines);
          }
        } else {
          lines.push(line || 1);
        }

        runner.run(editor, lines).catch(e => console.error(e));
        prevText.set(editor.document, newText);
      }
    }

    vscode.workspace.onDidOpenTextDocument(x => onUpdate(x), null, context.subscriptions);
    vscode.workspace.onDidSaveTextDocument(x => onUpdate(x), null, context.subscriptions);
    vscode.workspace.onDidCloseTextDocument(x => runner.close(x), null, context.subscriptions);

    vscode.window.onDidChangeVisibleTextEditors(eds => eds.forEach(onUpdate), null, context.subscriptions);
    setTimeout(() => vscode.window.visibleTextEditors.forEach(onUpdate), 1000);

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, extension "travetto-test-plugin" is now active!', `${__dirname}/success.png`);
  } catch (e) {
    console.error('WOAH', e);
  }
}

export async function deactivate() {
  await runner.shutdown();
}

