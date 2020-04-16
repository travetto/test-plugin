import * as vscode from 'vscode';

import { TestRunner } from './runner';

export const runner = new TestRunner(vscode.window);

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

  console.log('Document updated', editor.document.fileName);

  if (editor.document) {
    const results = runner.getResults(editor.document);
    results?.addEditor(editor);
  }
}

export function onDocumentClose(doc: vscode.TextDocument) {
  const gone = vscode.workspace.textDocuments.find(d => d.fileName === doc.fileName);
  if (gone) {
    runner.close(gone);
  }
}

export function activate() {
  runner.init();
}

export function deactivate() {
  runner.destroy(false);
}

export function reinit() {
  runner.reinit();
}