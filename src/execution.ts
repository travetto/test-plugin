import * as vscode from 'vscode';
import { EntityPhase, Entity, CWD } from './types';
import { ChildProcess } from 'child_process';
import * as spawn from 'cross-spawn';
import { SuiteResult, TestResult, Assertion } from '@travetto/test/src/model';

interface ResultHandler {
  onSuite(suite: SuiteResult): void;
  onTest(test: TestResult): void;
  onAssertion(assertion: Assertion): void;
}

export class TestExecution {
  private ready: boolean = false;
  private proc: ChildProcess;

  constructor() {
    this.proc = spawn(`node_modules/.bin/travetto-test`, [], { cwd: CWD, env: { EXECUTION: true } });
  }

  listenOnce(type: string) {
    return new Promise(resolve => this.proc.on('messge', (e: any) => {
      if (e.type === type) {
        resolve();
      }
    }))
  }

  async init() {
    if (!this.ready) {
      this.ready = true;
      await this.listenOnce('ready');
      console.log('Ready, lets init');
      this.proc.send({ type: 'init' });
      await this.listenOnce('initComplete');
    }
  }

  async run(editor: vscode.TextEditor, file: string, handler: ResultHandler, onAll: () => void) {
    await this.init();

    this.proc.send({ type: 'run', file });

    this.proc.on('message', (ev) => {
      if (ev.phase === EntityPhase.AFTER) {
        if (ev.type === Entity.SUITE) {
          handler.onSuite(ev.suite);
        } else if (ev.type === Entity.TEST) {
          handler.onTest(ev.test);
        } else if (ev.type === Entity.ASSERTION) {
          handler.onAssertion(ev.assertion);
        }
        onAll();
      }
    });

    await this.listenOnce('runComplete');
    this.ready = false;
    this.proc.removeAllListeners('message');
  }
}