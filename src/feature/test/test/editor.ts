import * as vscode from 'vscode';
import * as diff from 'diff';

import { TestRunner } from './runner';

export const runner = new TestRunner(vscode.window);
process.on('exit', () => runner.shutdown());
process.on('SIGINT', () => runner.shutdown());
process.on('SIGTERM', () => runner.shutdown());

const prevText = new Map<vscode.TextDocument, string>();

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

export function onDocumentUpdate(editor?: vscode.TextEditor | vscode.TextDocument, line?: number) {
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

    const doc = editor.document;

    runner.getResults(doc).addEditor(editor);

    if (line === undefined && prevText.has(doc)) {
      const changes = diff.structuredPatch('a', 'b', prevText.get(doc), newText, 'a', 'b', { context: 0 });
      const newLines = changes.hunks.map(x => x.newStart || x.oldStart);
      if (newLines.length < 5) {
        lines.push(...newLines);
      }
    } else {
      lines.push(line || 1);
    }

    if (!lines.length && runner.getResults(doc).getTotals().total === 0) {
      lines.push(1);
    }

    if (lines.length) {
      runner.run(doc, lines[0]).catch(e => console.error(e));
    }
    prevText.set(doc, newText);
  }
}

export function onDocumentClose(doc: vscode.TextDocument) {
  const gone = vscode.workspace.textDocuments.find(d => d.fileName === doc.fileName);
  if (gone) {
    runner.close(gone);
  }
}

export function destroy() {
  runner.shutdown();
}