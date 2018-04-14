import * as vscode from 'vscode';
import { ResultsManager } from './results';
import { TestExecution } from './execution';
import { log } from './util';

export class TestRunner {

  private execution: TestExecution;
  private results: ResultsManager;
  private ready: boolean = false;
  private queue: [vscode.TextEditor, number][] = [];
  private running: Promise<void>;
  private status: vscode.StatusBarItem;

  private prev: vscode.TextEditor;

  constructor(private window: typeof vscode.window) {
    this.results = new ResultsManager();
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

  clear() {
    this.queue = [];
    this.execution.kill();
  }

  async _runQueue() {

    this.setStatus('Running...', '#ccc');

    while (this.queue.length) {
      const [editor, line] = this.queue.shift();
      log('Running', editor.document.fileName, line);
      try {
        await this._runJob(editor, line);
      } catch (e) {
        log('Errored', e);
      }
    }
    return;
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
        this.results.resetAll();
      }

      if (editor !== this.prev) {
        this.prev = editor;
        this.results.setEditor(editor);
      }

      await this.execution.run(editor.document.fileName, line, e => {
        this.results.onEvent(e, line);
        const totals = this.results.getTotals();
        this.setStatus(`Tests ${totals.success}/${totals.total}`, totals.failed ? '#f33' : '#8f8');
      });

    } catch (e) {
      log(e);
    }
  }
}