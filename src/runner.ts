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

  async run(editor: vscode.TextEditor, all: boolean = true) {
    let timer: any;

    try {
      if (!editor || !editor.document || !/@Test\(/.test(editor.document.getText() || '')) {
        return;
      }

      if (all) {
        this.mgr.init();
      }

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

      await this.execution.run(
        editor.document.fileName,
        all ? 0 : editor.selection.active.line,
        e => {
          this.mgr.onEvent(e);
          pending = true;
        }
      );

    } catch (e) {
      console.log(e);
    }

    if (timer) {
      clearInterval(timer);
    }

    this.mgr.applyDecorations(editor);
  }
}