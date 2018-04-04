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
  private _init: boolean;
  private proc: ChildProcess;
  private running: boolean = false;

  constructor() {
    this.proc = spawn(`node_modules/.bin/travetto-test`, [], {
      cwd: CWD, env: { EXECUTION: true },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });
  }

  listenOnce(type: string) {
    return new Promise(resolve => this.proc.on('message', (e: any) => {
      if (e.type === type) {
        resolve();
      }
    }))
  }

  async init() {
    if (!this._init) {
      await this.listenOnce('ready');
      console.log('Ready, lets init');
      this.proc.send({ type: 'init' });
      await this.listenOnce('initComplete');
      console.log('Init Complete');
      this._init = true;
    }
  }

  async run(file: string, handler: ResultHandler, onAll: () => void) {
    await this.init();

    if (this.running) {
      console.log('Run already in progress', file);
      this.kill();
    }

    this.proc.on('message', (ev) => {
      try {
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
      } catch (e) {
        console.log(e);
      }
    });

    this.running = true;

    console.log('Running', file);
    this.proc.send({ type: 'run', file });

    await this.listenOnce('runComplete');
    console.log('Run Complete', file);
  }

  kill() {
    delete this.running;
    this.proc.removeAllListeners('message');
  }
}