import * as vscode from 'vscode';
import { Pool, createPool } from 'generic-pool';
import { ResultsManager } from './results';
import { TestExecution } from './execution';
import { Util } from '../../../util';

import { execSync } from 'child_process';

export class TestRunner {
  private status: vscode.StatusBarItem;

  private pool: Pool<TestExecution>;
  private dockerNS = `test-${process.pid}`;
  private _results = new Map<string, ResultsManager>();

  constructor(private window: typeof vscode.window) {
    process.env.DOCKER_NS = this.dockerNS;

    this.pool = createPool<TestExecution>({
      async create() {
        if (!this.active) {
          const { PhaseManager } = Util.requireLocal('@travetto/base/src/phase');
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

  getResults(document: vscode.TextDocument) {
    if (!this._results.has(document.fileName)) {
      const rm = new ResultsManager(document);
      this._results.set(document.fileName, rm);
    }
    return this._results.get(document.fileName);
  }

  async run(document: vscode.TextDocument, line: number) {
    const res = this.getResults(document);
    if (res.active) {
      return;
    }

    let exec: TestExecution;
    res.active = true;
    Util.log('Running', document.fileName, line);

    try {
      exec = await this.pool.acquire();
      await this._runJob(exec, document, line)
    } catch (e) {
      Util.debug('Errored', e);
    } finally {
      res.active = false;
      if (exec) {
        exec.release();
        if (this.pool.isBorrowedResource(exec)) {
          await this.pool.release(exec);
        }
      }
    }
  }

  async _runJob(exec: TestExecution, document: vscode.TextDocument, line: number) {
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

      let title = 'All Suites/Tests';

      if (this.getResults(document).hasTotalError()) {
        line = 0;
      }

      const { method, suite } = Util.getCurrentClassMethod(document, line);

      if (!suite) {
        this.getResults(document).resetAll();
      }

      if (method) {
        title = `@Test ${suite.name!.text}.${method.name['text']}`;
      } else if (suite) {
        title = `@Suite ${suite.name!.text}`;
      }

      title = `Running ${document.fileName.split(/[\\/]/g).pop()}: ${title}`;

      await this.window.withProgress({ cancellable: !method, title, location: method ? vscode.ProgressLocation.Window : vscode.ProgressLocation.Notification },
        async (progress, cancel) => {
          if (cancel) {
            cancel.onCancellationRequested(() => exec.kill());
          }

          try {
            extend();
            await exec.run(document.fileName, line, e => {
              extend();
              if (process.env.DEBUG) {
                Util.debug('Event Received', e);
              }
              if (e.type === 'runComplete' && e.error) {
                this.getResults(document).resetAll();
                this.getResults(document).setTotalError(e.error);
              }
              this.getResults(document).onEvent(e, line);
              const progressTotals = this.getResults(document).getTotals();
              if (!method) {
                progress.report({ message: `Tests: Success ${progressTotals.success}, Failed ${progressTotals.failed}` });
              }
            });
          } catch (e) {
            Util.debug(e.message, e);
          }
        });
    } catch (e) {
      Util.debug(e.message, e);
    }

    extend(false);

    const totals = this.getResults(document).getTotals();
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

  async close(doc: vscode.TextDocument) {
    if (this._results.has(doc.fileName)) {
      this._results.get(doc.fileName).removeEditors();
      this._results.get(doc.fileName).resetAll();
      this._results.delete(doc.fileName);
    }
  }
}