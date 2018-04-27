import * as vscode from 'vscode';
import { Pool, Factory, createPool, Options } from 'generic-pool';
import { ResultsManager } from './results';
import { TestExecution } from './execution';
import { log, debug, getCurrentClassMethod } from './util';
import * as ts from 'typescript';

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
    }, { min: 0, max: 4, testOnBorrow: true, autostart: true });
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
        .then(
          () => {
            exec.release();
            this.pool.release(exec);
          },
          e => {
            exec.release();
            this.pool.release(exec);
            debug('Errored', e);
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
    if (editor !== this.window.activeTextEditor) {
      return;
    }

    let timeout: NodeJS.Timer;
    const extend = (again: boolean = true) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (again) {
        timeout = setTimeout(() => {
          this.pool.release(exec);
        }, 20000); // Force 20 sec max between comms
      }
    }
    try {

      let title = 'Running all suites/tests';

      const { method, suite } = getCurrentClassMethod(editor, line);
      if (method) {
        title = `Running @Test ${suite.name!.text}.${method.name['text']}`;
      } else if (suite) {
        title = `Running @Suite ${suite.name!.text}`;
      }

      if (!suite) {
        this.results.resetAll();
      }

      if (editor !== this.prev) {
        this.prev = editor;
        this.results.setEditor(editor);
      }

      await this.window.withProgress({ cancellable: true, title, location: method ? vscode.ProgressLocation.Notification : vscode.ProgressLocation.Window },
        async (progress, cancel) => {
          if (cancel) {
            cancel.onCancellationRequested(exec.kill.bind(exec));
          }

          try {
            extend();
            await exec.run(editor.document.fileName, line, e => {
              extend();
              if (process.env.DEBUG) {
                debug('Event Recieved', e);
              }
              this.results.onEvent(e, line);
              const totals = this.results.getTotals();
              if (!method) {
                progress.report({ message: `Tests: Success ${totals.success}, Failed ${totals.failed}` });
              }
            });
          } catch (e) {
            debug(e.message, e);
          }
        });
    } catch (e) {
      debug(e.message, e);
    }

    extend(false);

    const totals = this.results.getTotals();
    this.setStatus(`Success ${totals.success}, Failed ${totals.failed}`, totals.failed ? '#f33' : '#8f8');
  }

  async shutdown() {
    await this.pool.drain();
    this.pool.clear();
  }

  async setEditor(editor: vscode.TextEditor, refresh = false) {
    this.results.setEditor(editor, refresh);
  }
}