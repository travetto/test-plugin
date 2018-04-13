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
  private running: Promise<{ total: number, failed: number, unknown: number, success: number }>;

  constructor() {
    this.mgr = new ResultsManager();
    this.execution = new TestExecution();
  }

  async _runQueue() {
    let last;
    while (this.queue.length) {
      const [editor, line] = this.queue.shift();
      console.debug('Running', editor.document.fileName, line);
      try {
        last = await this._runJob(editor, line);
      } catch (e) {
        console.debug('Errored', e);
      }
    }
    return last;
  }

  async run(editor: vscode.TextEditor, lines: number[]) {
    for (const line of lines) {
      this.queue.push([editor, line]);
      console.debug('Queuing', editor.document.fileName, line);
    }

    if (!this.running && this.queue.length) {
      this.running = this._runQueue().then(
        x => { delete this.running; return x; },
        x => { delete this.running; throw x });
    }
    return this.running;
  }

  async _runJob(editor: vscode.TextEditor, line: number) {

    try {
      if (!line) {
        this.mgr.init();
      }

      await this.execution.run(editor.document.fileName, line, e => {
        this.mgr.onEvent(e, editor, line);
        this.mgr.applyDecorations(editor);
      });

    } catch (e) {
      console.debug(e);
    }

    this.mgr.applyDecorations(editor);

    return this.mgr.getTotals();
  }
}