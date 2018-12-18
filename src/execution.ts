import { ChildProcess, spawn } from 'child_process';
import { log, CWD, channel, debug, requireLocal, NEW_CLI, } from './util';

const { Env } = requireLocal('@travetto/base/src/env');

function logit(str: NodeJS.ReadableStream) {
  str.on('data', (b: Buffer) => {
    // console.log(b.toString());
    channel.append(b.toString());
  });
  return str;
}

const EXIT = Symbol('EXIT');

const TEST_BIN = 'node_modules/@travetto/test/bin'

const TEST_SERVER_EXEC = NEW_CLI ?
  `${TEST_BIN}/travetto-test-server` :
  `${TEST_BIN}/travetto-test`;

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
    try {
      const env: { [key: string]: any } = {
        ...process.env,
        EXECUTION: true,
        EXECUTION_REUSABLE: true
      };

      if (Env.frameworkDev) {
        env.NODE_PRESERVE_SYMLINKS = 1;
      }

      this.proc = spawn('node', [TEST_SERVER_EXEC], {
        cwd: CWD,
        shell: false,
        env,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      });

      if (process.env.DEBUG) {
        logit(this.proc.stdout);
        logit(this.proc.stderr);
      }

      this.waitForKill = new Promise((_, reject) => {
        for (const k of ['error', 'close', 'exit']) {
          this.proc.on(k, (...args) => {
            console.debug(k, args);
            delete this.proc;
            reject(EXIT);
          });
        }
      });

      await this.listenOnce('ready');
      debug('Ready, lets init');
      this.proc.send({ type: 'init' });
      await this.listenOnce('initComplete');
      debug('Init Complete');
    } catch (e) {
      debug(`Error: ${e.message}`, e);
    }
  }

  init() {
    if (!this.procHandle) {
      this.procHandle = this._init();
    }
    return this.procHandle;
  }

  async run(file: string, line: number, handler: (e) => void) {
    await this.init();

    this.proc.on('message', handler);

    try {
      log('Running', file);
      this.proc.send({ type: 'run', file, class: line });

      await Promise.race([this.waitForKill, this.listenOnce('runComplete')]);
      log('Run Complete', file);
    } catch (e) {
      if (e !== EXIT) {
        log(e.message, e);
      }
    }

    if (this.proc) {
      this.proc.removeListener('message', handler);
    }
  }

  kill() {
    if (this.proc) {
      this.proc.removeAllListeners();
      this.proc.kill('SIGKILL');
      delete this.proc;
    }
  }

  release() {
    this.proc.removeAllListeners('message');
  }

  get active() {
    return !!this.proc;
  }
}