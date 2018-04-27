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
    if (editor !== this.window.activeTextEditor) {
      return;
    }

    let timeout: NodeJS.Timer;
    const extend = (again: boolean = true) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (again) {
        timeout = setTimeout(this.pool.release.bind(this.pool, exec), 20000); // Force 20 sec max between comms
      }
    }
    try {
      if (!line) {
        this.results.resetAll();
      }

      if (editor !== this.prev) {
        this.prev = editor;
        this.results.setEditor(editor);
      }

      this.window.withProgress({ cancellable: true, title: 'Running tests', location: vscode.ProgressLocation.Notification },
        async (progress, cancel) => {
          cancel.onCancellationRequested(exec.kill.bind(exec));

          try {
            await exec.run(editor.document.fileName, line, e => {
              extend();
              if (process.env.DEBUG) {
                log('Event Recieved', e);
              }
              this.results.onEvent(e, line);
              progress.report({});
            });
          } catch (e) {
            log(e.message, e);
          }
        });
    } catch (e) {
      log(e.message, e);
    }
    extend(false);
  }

  async shutdown() {
    await this.pool.drain();
    this.pool.clear();
  }

  async setEditor(editor: vscode.TextEditor, refresh = false) {
    this.results.setEditor(editor, refresh);
  }
}