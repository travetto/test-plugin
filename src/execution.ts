import * as vscode from 'vscode';
import { EntityPhase, Entity, CWD } from './types';
import { ChildProcess } from 'child_process';
import * as spawn from 'cross-spawn';
import { SuiteResult, TestResult, Assertion, SuiteConfig, TestConfig } from '@travetto/test/src/model';

interface ResultHandler {
  onSuiteStart(suite: SuiteResult): void;
  onTestStart(suite: SuiteConfig, test: TestConfig): void;

  onSuiteEnd(suite: SuiteResult): void;
  onTestEnd(suite: SuiteConfig, test: TestResult): void;

  onAssertion(suite: SuiteConfig, test: TestConfig, assertion: Assertion): void;
  onAny?: () => void;
}

export class TestExecution {
  private _init: Promise<any>;
  private proc: ChildProcess;
  private running: boolean = false;

  private suite: SuiteConfig;
  private test: TestConfig;

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

  init() {
    if (!this._init) {
      this._init = new Promise(async (resolve) => {
        await this.listenOnce('ready');
        console.log('Ready, lets init');
        this.proc.send({ type: 'init' });
        await this.listenOnce('initComplete');
        console.log('Init Complete');
        resolve();
      });
    }
    return this._init;
  }

  async run(file: string, line: number, handler: ResultHandler) {
    await this.init();

    if (this.running) {
      console.log('Run already in progress', file);
      this.kill();
    }

    this.proc.on('message', (ev) => {
      try {
        if (ev.phase === EntityPhase.BEFORE) {
          if (ev.type === Entity.SUITE) {
            this.suite = ev.suite;
            handler.onSuiteStart(ev.suite);
          } else if (ev.type === Entity.TEST) {
            this.test = ev.test;
            handler.onTestStart(this.suite, this.test);
          }
        } else if (ev.phase === EntityPhase.AFTER) {
          if (ev.type === Entity.SUITE) {
            handler.onSuiteEnd(ev.suite);
            delete this.suite;
          } else if (ev.type === Entity.TEST) {
            handler.onTestEnd(this.suite, ev.test);
            delete this.test;
          } else if (ev.type === Entity.ASSERTION) {
            handler.onAssertion(this.suite, this.test, ev.assertion);
          }
          handler.onAny();
        }
      } catch (e) {
        console.log(e);
      }
    });

    this.running = true;

    console.log('Running', file);
    this.proc.send({ type: 'run', file, class: line });

    await this.listenOnce('runComplete');
    console.log('Run Complete', file);

    this.kill();
  }

  kill() {
    delete this.running;
    this.proc.removeAllListeners('message');
  }
}