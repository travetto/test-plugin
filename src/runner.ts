import * as vscode from 'vscode';
import { ResultsManager } from './results';
import { Entity, EntityPhase, CWD, State } from './types';
import { TestExecution } from './execution';
import { TestResult, SuiteResult, Assertion } from '@travetto/test/src/model';
import { Decorations } from './decoration';
import { log } from './util';

export class TestRunner {

  private execution: TestExecution;
  private mgr: ResultsManager;
  private ready: boolean = false;
  private queue: [vscode.TextEditor, number][] = [];
  private running: Promise<{ total: number, failed: number, unknown: number, success: number }>;
  private status: vscode.StatusBarItem;

  private prev: vscode.TextEditor;

  constructor(private window: typeof vscode.window) {
    this.mgr = new ResultsManager();
    this.execution = new TestExecution();
    this.status = window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  }
  setStatus(message: string, color?: string) {
    if (!message) {
      this.status.hide();
    } else {
      this.status.color = color || '#fff';
      this.status.text = message;
      this.status.show();
    }
  }

  async _runQueue() {
    while (this.queue.length) {
      const [editor, line] = this.queue.shift();
      log('Running', editor.document.fileName, line);
      try {
        await this._runJob(editor, line);
      } catch (e) {
        log('Errored', e);
      }
    }
    const totals = this.mgr.getTotals();

    this.setStatus(`Tests ${totals.success}/${totals.total}`, totals.failed ? '#f33' : '#8f8');

    return totals;
  }

  async run(editor: vscode.TextEditor, lines: number[]) {
    for (const line of lines) {
      this.queue.push([editor, line]);
      log('Queuing', editor.document.fileName, line);
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

      if (editor !== this.prev) {
        this.prev = editor;
        this.mgr.setEditor(editor);
      }

      await this.execution.run(editor.document.fileName, line, e => {
        this.mgr.onEvent(e, line);
      });

    } catch (e) {
      log(e);
    }
  }
}