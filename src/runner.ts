import * as vscode from 'vscode';
import { DecorationManager } from './manager';
import { TestExecution } from './execution';

export class TestRunner {

  private mgr: DecorationManager;
  private ready: boolean = false;

  constructor(private context: vscode.ExtensionContext) {
    this.mgr = new DecorationManager(context);
    this.mgr.init();
  }

  async applyDecorations(editor: vscode.TextEditor) {
    if (!editor || !editor.document || !/@Test\(/.test(editor.document.getText() || '')) {
      return;
    }
    TestExecution.on('assertion', (e) => {
      this.mgr.onAssertion(e);
    });
    this.mgr.applyDecorations(editor);
  }
}