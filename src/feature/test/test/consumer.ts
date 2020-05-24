import * as vscode from 'vscode';
import * as path from 'path';

import { Workspace } from '../../../core/workspace';

import { ResultsManager } from './results';
import { TestEvent, StatusUnknown } from './types';


export class TestConsumer {
  private status: vscode.StatusBarItem;
  private results: Map<string, ResultsManager> = new Map();

  constructor(private window: typeof vscode.window) {
    this.status = this.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.status.command = 'workbench.action.showErrorsWarnings';
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
   * Stop runner
   */
  async dispose() {
    // Remove all state
    const entries = [...this.results.entries()];
    this.results.clear();
    for (const [k, v] of entries) {
      v.dispose();
    }
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