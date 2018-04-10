import * as vscode from 'vscode';
import { DecorationManager } from './manager';
import { Entity, EntityPhase, CWD } from './types';
import { TestExecution } from './execution';
import { TestResult, SuiteResult, Assertion } from '@travetto/test/src/model';

export class TestRunner {

  private execution: TestExecution;
  private mgr: DecorationManager;
  private ready: boolean = false;
  private queue: [vscode.TextEditor, number][] = [];
  private running: Promise<any>;

  constructor(private context: vscode.ExtensionContext) {
    this.mgr = new DecorationManager(context);
    this.execution = new TestExecution();
  }

  async run(editor: vscode.TextEditor, all: boolean = true) {
    this.queue.push([editor, all ? 0 : editor.selection.active.line]);

    if (this.running) {
      return this.running;
    } else {
      this.running = new Promise(async (resolve, reject) => {
        while (this.queue.length) {
          const [rEditor, rLine] = this.queue.shift();
          await this._run(rEditor, rLine);
        }
        resolve();
      });
      return this.running;
    }
  }

  async _run(editor: vscode.TextEditor, line: number) {

    let timer: any;

    try {
      if (!line) {
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

      await this.execution.run(editor.document.fileName, line, e => {
        this.mgr.onEvent(e);
        pending = true;
      });

    } catch (e) {
      console.log(e);
    }

    if (timer) {
      clearInterval(timer);
    }

    this.mgr.applyDecorations(editor);
  }
}