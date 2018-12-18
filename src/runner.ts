import * as vscode from 'vscode';
import { Pool, createPool } from 'generic-pool';
import { ResultsManager } from './results';
import { TestExecution } from './execution';
import { log, debug, getCurrentClassMethod, requireLocal } from './util';

import { execSync } from 'child_process';

export class TestRunner {
  private status: vscode.StatusBarItem;

  private prev: vscode.TextEditor;
  private pool: Pool<TestExecution>;
  private dockerNS = `test-${process.pid}`;
  public results: ResultsManager;

  constructor(private window: typeof vscode.window) {
    this.results = new ResultsManager();
    process.env.DOCKER_NS = this.dockerNS;

    this.pool = createPool<TestExecution>({
      async create() {
        if (!this.active) {
          const { PhaseManager } = requireLocal('@travetto/base/src/phase');
          await new PhaseManager('test').load().run();
          this.active = true;
        }

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
    };

    try {

      let title = 'Running all suites/tests';

      if (editor.document !== (this.prev && this.prev.document)) {
        this.results.setEditor(this.prev = editor);
        line = 0;
      }

      if (this.results.hasTotalError()) {
        line = 0;
      }

      const { method, suite } = getCurrentClassMethod(editor, line);

      if (!suite) {
        this.results.resetAll();
      }

      if (method) {
        title = `Running @Test ${suite.name!.text}.${method.name['text']}`;
      } else if (suite) {
        title = `Running @Suite ${suite.name!.text}`;
      }

      await this.window.withProgress({ cancellable: !method, title, location: method ? vscode.ProgressLocation.Window : vscode.ProgressLocation.Notification },
        async (progress, cancel) => {
          if (cancel) {
            cancel.onCancellationRequested(exec.kill.bind(exec));
          }

          try {
            extend();
            await exec.run(editor.document.fileName, line, e => {
              extend();
              if (process.env.DEBUG) {
                debug('Event Received', e);
              }
              if (e.type === 'runComplete' && e.error) {
                this.results.resetAll();
                this.results.setTotalError(editor, e.error);
              }
              this.results.onEvent(e, line);
              const progressTotals = this.results.getTotals();
              if (!method) {
                progress.report({ message: `Tests: Success ${progressTotals.success}, Failed ${progressTotals.failed}` });
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
    console.debug('Shutting down');
    const lines = execSync('docker ps -a').toString().split('\n');
    const ids = lines.filter(x => x.includes(this.dockerNS)).map(x => x.split(' ')[0]);

    if (ids.length) {
      execSync(`docker rm -f ${ids.join(' ')}`);
    }
    await this.pool.drain();
    this.pool.clear();
  }

  async setEditor(editor: vscode.TextEditor, refresh = false) {
    this.results.setEditor(editor, refresh);
  }
}