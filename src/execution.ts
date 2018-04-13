import * as vscode from 'vscode';
import { EntityPhase, Entity, CWD } from './types';
import { ChildProcess } from 'child_process';
import * as spawn from 'cross-spawn';
import { SuiteResult, TestResult, Assertion, SuiteConfig, TestConfig } from '@travetto/test/src/model';

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
        console.debug('Ready, lets init');
        this.proc.send({ type: 'init' });
        await this.listenOnce('initComplete');
        console.debug('Init Complete');
        resolve();
      });
    }
    return this._init;
  }

  async run(file: string, line: number, handler: (e) => void) {
    await this.init();

    if (this.running) {
      console.debug('Run already in progress', file);
      this.kill();
    }

    this.proc.on('message', handler);

    this.running = true;

    console.debug('Running', file);
    this.proc.send({ type: 'run', file, class: line });

    await this.listenOnce('runComplete');
    console.debug('Run Complete', file);

    this.kill();
  }

  kill() {
    delete this.running;
    this.proc.removeAllListeners('message');
  }
}