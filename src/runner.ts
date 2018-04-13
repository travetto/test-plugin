import * as vscode from 'vscode';
import { ResultsManager } from './results';
import { Entity, EntityPhase, CWD, State } from './types';
import { TestExecution } from './execution';
import { TestResult, SuiteResult, Assertion } from '@travetto/test/src/model';
import { Decorations } from './decoration';

export class TestRunner {

  private execution: TestExecution;
  private mgr: ResultsManager;
  private ready: boolean = false;
  private queue: [vscode.TextEditor, number][] = [];
  private running: Promise<any>;

  constructor() {
    this.mgr = new ResultsManager();
    this.execution = new TestExecution();
  }

  async _runQueue() {
    while (this.queue.length) {
      const [editor, line] = this.queue.shift();
      console.log('Running', editor.document.fileName, line);
      try {
        await this._runJob(editor, line);
      } catch (e) {
        console.log('Errored', e);
      }
    }
  }

  async run(editor: vscode.TextEditor, lines: number[]) {
    for (const line of lines) {
      this.queue.push([editor, line]);
      console.log('Queuing', editor.document.fileName, line);
    }

    if (!this.running && this.queue.length) {
      this.running = this._runQueue()
        .then(x => delete this.running, x => delete this.running);
    }
    return this.running;
  }

  async _runJob(editor: vscode.TextEditor, line: number) {

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
        this.mgr.onEvent(e, editor, line);
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