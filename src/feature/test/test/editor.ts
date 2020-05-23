import * as vscode from 'vscode';

import { TestRunner } from './runner';

export const runner = new TestRunner(vscode.window);

/**
 * See if an entity is an editor
 * @param o 
 */
function isEditor(o: any): o is vscode.TextEditor {
  return 'document' in o;
}

/**
 * Get the editor for a doc
 * @param doc 
 */
function getEditor(doc: vscode.TextDocument) {
  for (const e of vscode.window.visibleTextEditors) {
    if (e.document === doc) {
      return e;
    }
  }
}

/**
 * On document update, track for results
 * @param editor 
 * @param line 
 */
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

/**
 * On Document close, stop listening
 */
export function onDocumentClose(doc: vscode.TextDocument) {
  const gone = vscode.workspace.textDocuments.find(d => d.fileName === doc.fileName);
  if (gone) {
    runner.close(gone);
  }
}

/**
 * Handle activation
 */
export function activate() {
  runner.init();
}

/**
 * Handle deactivation
 */
export function deactivate() {
  runner.destroy(false);
}

/**
 * Handle reinit
 */
export function reinit() {
  runner.reinit();
}