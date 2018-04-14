import * as vscode from 'vscode';
import { ChildProcess } from 'child_process';
import { SuiteConfig, TestConfig } from '@travetto/test/src/model';
import { CWD } from './types';
import { log } from './util';
import * as spawn from 'cross-spawn';

export class TestExecution {
  private _init: Promise<any>;
  private proc: ChildProcess;
  private running: boolean = false;

  private suite: SuiteConfig;
  private test: TestConfig;

  constructor() {
    this.proc = spawn(`node_modules/.bin/travetto-test`, [], {
      cwd: CWD, env: {
        EXECUTION: true,
        PATH: process.env.PATH
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });
    if (process.env.DEV) {
      this.proc.on('error', e => console.log('Error', e.message, e));
      this.proc.on('close', code => console.log('Close', code))
      this.proc.stderr.pipe(process.stdout);
      this.proc.stdout.pipe(process.stdout);
    }
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
        log('Ready, lets init');
        this.proc.send({ type: 'init' });
        await this.listenOnce('initComplete');
        log('Init Complete');
        resolve();
      });
    }
    return this._init;
  }

  async run(file: string, line: number, handler: (e) => void) {
    await this.init();

    if (this.running) {
      log('Run already in progress', file);
      this.kill();
    }

    this.proc.on('message', handler);

    this.running = true;

    log('Running', file);
    this.proc.send({ type: 'run', file, class: line });

    await this.listenOnce('runComplete');
    log('Run Complete', file);

    this.kill();
  }

  kill() {
    delete this.running;
    this.proc.removeAllListeners('message');
    this.proc.kill();
    delete this._init;
  }
}