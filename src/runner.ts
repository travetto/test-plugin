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
    this.mgr.init();

    this.execution = new TestExecution();
    this.execution.init();
  }

  async run(editor: vscode.TextEditor) {
    let timer: any;

    if (!editor || !editor.document || !/@Test\(/.test(editor.document.getText() || '')) {
      return;
    }

    const file = editor.document.fileName.split(CWD)[1];

    try {

      this.mgr.resetDecorations();

      if (timer) {
        clearInterval(timer);
      }

      let pending = false;

      timer = setInterval(() => {
        if (pending) {
          this.mgr.applyDecorations(editor);
          pending = false;
        }
      }, 200);

      await this.execution.run(file, this.mgr, () => {
        pending = true;
      });

    } catch (e) {
      console.log(e);
    }

    if (timer) {
      clearInterval(timer);
    }

    console.log('Applying', file);
    this.mgr.applyDecorations(editor);
  }
}