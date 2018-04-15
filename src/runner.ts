import * as vscode from 'vscode';
import { Pool, Factory, createPool, Options } from 'generic-pool';
import { ResultsManager } from './results';
import { TestExecution } from './execution';
import { log } from './util';

export class TestRunner {

  private results: ResultsManager;
  private ready: boolean = false;
  private queue: [vscode.TextEditor, number][] = [];
  private running: Promise<void>;
  private status: vscode.StatusBarItem;

  private prev: vscode.TextEditor;
  private pool: Pool<TestExecution>;

  constructor(private window: typeof vscode.window) {
    this.results = new ResultsManager();
    this.pool = createPool<TestExecution>({
      async create() {
        const exec = new TestExecution();
        await exec.init();
        return exec;
      },
      async destroy(exec) {
        exec.kill();
        return undefined;
      },
      async validate(exec) {
        return exec.active;
      }
    }, { min: 0, max: 4 });
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

  async _runNext(editor: vscode.TextEditor, line: number) {
    if (editor === this.window.activeTextEditor) {
      log('Running', editor.document.fileName, line);

      const exec = await this.pool.acquire();

      this._runJob(exec, editor, line)
        .then(() => {
          this.pool.release(exec);
        }, e => {
          this.pool.release(exec);
          log('Errored', e);
        });
    }
  }

  async run(editor: vscode.TextEditor, lines: number[]) {
    for (const line of lines) {
      this._runNext(editor, line);
      log('Queuing', editor.document.fileName, line);
    }
  }

  async _runJob(exec: TestExecution, editor: vscode.TextEditor, line: number) {

    if (editor === this.window.activeTextEditor) {
      this.setStatus('Running...', '#ccc');
    }

    try {
      if (!line) {
        this.results.resetAll();
      }

      if (editor !== this.prev) {
        this.prev = editor;
        this.results.setEditor(editor);
      }

      await exec.run(editor.document.fileName, line, e => {
        if (process.env.DEBUG) {
          console.log('Event Recieved', e);
        }
        if (editor === this.window.activeTextEditor) {
          this.results.onEvent(e, line);
          const totals = this.results.getTotals();
          this.setStatus(`Tests ${totals.success}/${totals.total}`, totals.failed ? '#f33' : '#8f8');
        }
      });
    } catch (e) {
      log(e);
    }
  }
}