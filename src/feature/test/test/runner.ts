import * as vscode from 'vscode';
import * as path from 'path';
import { ExecUtil, FsUtil, ExecutionState } from '@travetto/boot';
import { ResultsManager } from './results';
import { Logger } from '../../../core/log';
import { Workspace } from '../../../core/workspace';
import { TestEvent, StatusUnknown } from './types';


export class TestRunner {
  private status: vscode.StatusBarItem;
  private runner: ExecutionState;
  private running = true;

  private results: Map<string, ResultsManager> = new Map();
  private cacheDir = `${Workspace.path}/.trv_cache_test`;

  constructor(private window: typeof vscode.window) {
    this.status = this.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.status.command = 'workbench.action.showErrorsWarnings';
    const done = this.destroy.bind(this, false);
    process.on('exit', done);
    process.on('SIGINT', done);
    process.on('SIGTERM', done);
  }

  /**
   * Get totals from teh runner
   */
  getTotals() {
    const totals: Record<StatusUnknown, number> = {
      skipped: 0,
      failed: 0,
      passed: 0,
      unknown: 0
    };
    for (const mgr of this.results.values()) {
      const test = mgr.getTotals();
      totals.skipped += test.skipped;
      totals.failed += test.failed;
      totals.passed += test.passed;
      totals.unknown += test.unknown;
    }
    return totals;
  }

  /**
   * Set overall status
   * @param message 
   * @param color 
   */
  setStatus(message: string, color?: string) {
    if (!message) {
      this.status.hide();
    } else {
      this.status.color = color || '#fff';
      this.status.text = message;
      this.status.show();
    }
  }

  /**
   * Get test results
   * @param target 
   */
  getResults(target: vscode.TextDocument | string | TestEvent) {
    let file: string;
    if (typeof target === 'string') {
      file = target;
    } else if ('fileName' in target) {
      file = target.fileName;
    } else {
      switch (target.type) {
        case 'test': file = target.test.file; break;
        case 'suite': file = target.suite.file; break;
        case 'assertion': file = target.assertion.file; break;
      }
    }

    if (file) {
      file = path.resolve(Workspace.path, file);

      if (!this.results.has(file)) {
        const rm = new ResultsManager(file);
        this.results.set(file, rm);
      }
      return this.results.get(file)!;
    }
  }

  /**
   * On test event
   * @param ev 
   */
  onEvent(ev: TestEvent) {
    this.getResults(ev)?.onEvent(ev);
    const totals = this.getTotals();
    this.setStatus(`Passed ${totals.passed}, Failed ${totals.failed}`, totals.failed ? '#f33' : '#8f8');
  }

  /**
   * Start runner
   */
  async init() {
    FsUtil.copyRecursiveSync(`${Workspace.path}/.trv_cache`, this.cacheDir, true);

    this.runner = ExecUtil.fork(`${Workspace.path}/node_modules/@travetto/test/bin/travetto-watch-test`, [], {
      env: {
        ...process.env,
        TRV_CACHE: this.cacheDir,
        TEST_FORMAT: 'exec'
      },
      cwd: Workspace.path,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

    this.runner.process.stdout?.pipe(process.stdout);
    this.runner.process.stderr?.pipe(process.stderr);

    this.runner.result.finally(() => {
      if (this.running) { // If still running, reinit
        this.reinit();
      }
    });

    this.runner.process.addListener('message', this.onEvent.bind(this));
  }

  /**
   * Stop runner
   */
  async destroy(running: boolean) {
    Logger.debug('Test', 'Shutting down');
    this.running = running;
    if (!this.runner.process.killed) {
      this.runner.process.kill();
    }
    // Remove all state
    const entries = [...this.results.entries()];
    this.results.clear();
    for (const [k, v] of entries) {
      v.dispose();
    }
  }

  /**
   * Reinitialize
   */
  async reinit() {
    this.destroy(true);
    FsUtil.unlinkRecursiveSync(this.cacheDir);
    this.init();
  }

  /**
   * Close a document
   * @param doc 
   */
  async close(doc: vscode.TextDocument) {
    if (this.results.has(doc.fileName)) {
      this.results.get(doc.fileName)!.dispose();
    }
  }
}