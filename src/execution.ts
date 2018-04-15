import * as vscode from 'vscode';
import { ChildProcess } from 'child_process';
import { log, CWD } from './util';
import * as spawn from 'cross-spawn';

function logit(str: NodeJS.ReadableStream) {
  str.on('data', (b: Buffer) => console.log(b.toString()));
  return str;
}

const EXIT = Symbol('EXIT');

export class TestExecution {
  private proc: ChildProcess;
  private waitForKill: Promise<any>;
  private procHandle: Promise<any>;

  listenOnce(type: string) {
    return new Promise(resolve => this.proc.on('message', (e: any) => {
      if (e.type === type) {
        resolve();
      }
    }));
  }

  async _init() {
    this.proc = spawn(`node_modules/.bin/travetto-test`, [], {
      cwd: CWD,
      env: {
        EXECUTION: true,
        PATH: process.env.PATH
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    logit(this.proc.stdout);
    logit(this.proc.stderr);

    this.waitForKill = new Promise((_, reject) => {
      for (const k of ['error', 'close', 'exit']) {
        this.proc.on(k, (...args) => {
          console.log(k, args);
          reject(EXIT);
        });
      }
    });

    await this.listenOnce('ready');
    log('Ready, lets init');
    this.proc.send({ type: 'init' });
    await this.listenOnce('initComplete');
    log('Init Complete');
  }

  init() {
    if (!this.procHandle) {
      this.procHandle = this._init();
    }
  }

  async run(file: string, line: number, handler: (e) => void) {
    await this.procHandle;

    this.proc.on('message', handler);

    log('Running', file);
    this.proc.send({ type: 'run', file, class: line });

    try {
      await Promise.race([this.waitForKill, this.listenOnce('runComplete')]);
      log('Run Complete', file);
    } catch (e) {
      console.log
    }
  }

  kill() {
    this.proc.kill('SIGKILL');
    delete this.proc;
  }

  get active() {
    return !!this.proc;
  }
}