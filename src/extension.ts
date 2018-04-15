import * as vscode from 'vscode';
import * as diff from 'diff';

import { TestRunner } from './runner';
import { TestExecution } from './execution';
import { Decorations } from './decoration';

const runner = new TestRunner(vscode.window);

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  Decorations.context = context;

  try {
    let oldText = '';

    function onUpdate(target?: vscode.TextDocument) {

      const editor = vscode.window.activeTextEditor;

      if (!editor || (target && editor.document !== target)) {
        return;
      }

      if (editor.document && /@Test\(/.test(editor.document.getText() || '')) {

        const newText = editor.document.getText();
        const lines = [];

        if (oldText) {
          const changes = diff.structuredPatch('a', 'b', oldText, newText, 'a', 'b', { context: 0 });
          const newLines = changes.hunks.map(x => x.newStart || x.oldStart);
          if (newLines.length < 3) {
            lines.push(...newLines);
          }
        }

        if (!lines.length) {
          lines.push(0);
        }

        runner.run(editor, lines).catch(e => console.error(e));

        oldText = newText;
      } else {
        runner.setStatus('');
      }
    };

    vscode.window.onDidChangeActiveTextEditor(x => {
      oldText = '';
      onUpdate();
    }, null, context.subscriptions);
    vscode.workspace.onDidSaveTextDocument(onUpdate, null, context.subscriptions);

    onUpdate();

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "travetto-test-plugin" is now active!', `${__dirname}/success.png`);
  } catch (e) {
    console.error('WOAH', e);
  }
}

async function deactivate() {
  runner.shutdown();
}