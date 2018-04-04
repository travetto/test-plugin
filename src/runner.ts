import * as vscode from 'vscode';
import { DecorationManager } from './manager';
import { Entity, EntityPhase, CWD } from './types';
import { TestExecution } from './execution';
import { TestResult, SuiteResult, Assertion } from '@travetto/test/src/model';

export class TestRunner {

  private execution: TestExecution;
  private mgr: DecorationManager;
  private ready: boolean = false;

  constructor(private context: vscode.ExtensionContext) {
    this.mgr = new DecorationManager(context);
    this.execution = new TestExecution();
  }

  async run(editor: vscode.TextEditor) {
    try {
      if (!editor || !editor.document || !/@Test\(/.test(editor.document.getText() || '')) {
        return;
      }

      const file = editor.document.fileName.split(CWD)[1];
      this.mgr.init();

      this.execution.run(editor, file, this.mgr, () => {
        this.mgr.applyDecorations(editor);
      });
    } catch (e) {
      console.log(e);
    }
  }
}