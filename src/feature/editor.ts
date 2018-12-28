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

function getEditor(doc: vscode.TextDocument) {
  for (const e of vscode.window.visibleTextEditors) {
    if (e.document === doc) {
      return e;
    }
  }
}

function onUpdate(editor?: vscode.TextEditor | vscode.TextDocument, line?: number) {
  if (!editor) {
    return;
  }

  editor = !isEditor(editor) ? getEditor(editor) : editor;

  if (!editor) {
    return;
  }

  if (editor.document && /@Test\(/.test(editor.document.getText() || '')) {
    const newText = editor.document.getText();
    const lines = [];

    if (line === undefined && !prevText.has(editor.document)) {
      line = editor.selection.start.line;
    }

    runner.getResults(editor).setEditor(editor);

    if (!lines.length && prevText.has(editor.document)) {
      const changes = diff.structuredPatch('a', 'b', prevText.get(editor.document), newText, 'a', 'b', { context: 0 });
      const newLines = changes.hunks.map(x => x.newStart || x.oldStart);
      if (newLines.length < 5) {
        lines.push(...newLines);
      }
    } else {
      lines.push(line || 1);
    }

    if (!lines.length && runner.getResults(editor).getTotals().total === 0) {
      lines.push(1);
    }

    runner.run(editor, lines).catch(e => console.error(e));
    prevText.set(editor.document, newText);
  }
}

export function activate(context: vscode.ExtensionContext) {
  Decorations.context = context;

  try {
    vscode.workspace.onDidOpenTextDocument(x => onUpdate(x, 0), null, context.subscriptions);
    vscode.workspace.onDidSaveTextDocument(x => onUpdate(x), null, context.subscriptions);
    vscode.workspace.onDidCloseTextDocument(x => runner.close(x), null, context.subscriptions);
    vscode.window.onDidChangeActiveTextEditor(x => onUpdate(x), null, context.subscriptions);

    // vscode.window.onDidChangeVisibleTextEditors(eds => eds.forEach(x => onUpdate(x, 0)), null, context.subscriptions);
    setTimeout(() => vscode.window.visibleTextEditors.forEach(x => onUpdate(x, 0)), 1000);

    console.log('Congratulations, extension "travetto-test-plugin" is now active!', `${__dirname}/success.png`);
  } catch (e) {
    console.error('WOAH', e);
  }
}

export async function deactivate() {
  await runner.shutdown();
}

