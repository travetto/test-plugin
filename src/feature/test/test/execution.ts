import { ChildProcess, spawn } from 'child_process';

import { TestEvent } from './types';
import { Workspace } from '../../../core/workspace';
import { Logger } from '../../../core/log';

const EXIT = Symbol('EXIT');

const TEST_BIN = 'node_modules/@travetto/test/bin';

const TEST_SERVER_EXEC = `${TEST_BIN}/travetto-test-server`;

export class TestExecution {

  static buildKillPromise(proc: ChildProcess) {
    return new Promise((_, reject) => {
      for (const k of ['error', 'close', 'exit']) {
        proc.on(k, (...args) => {
          console.debug(k, args);
          reject(EXIT);
        });
      }
    });
  }
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
        EXECUTION_REUSABLE: true,
        TRV_TEST_BASE: `${Workspace.path}/node_modules/@travetto/test`
      };

      if (process.env.TRV_FRAMEWORK_DEV) {
        Object.assign(env, {
          NODE_PRESERVE_SYMLINKS: 1,
        });
      }

      this.proc = spawn('node', [TEST_SERVER_EXEC], {
        cwd: Workspace.path,
        shell: false,
        env,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      });

      if (Logger.debugMode) {
        this.proc.stdout.on('data', (b: Buffer) => Logger.debug(`Test[${this.proc.pid}] ${b.toString()}`));
        this.proc.stderr.on('data', (b: Buffer) => Logger.error(`Test[${this.proc.pid}] ${b.toString()}`));
      }

      this.waitForKill = TestExecution.buildKillPromise(this.proc)
        .catch(e => {
          delete this.proc;
          throw e;
        });

      const sub = async () => {
        await this.listenOnce('ready');
        Logger.debug(`Test[${this.proc.pid}]`, 'Ready, lets init');
        this.proc.send({ type: 'init' });
        await this.listenOnce('initComplete');
        Logger.debug(`Test[${this.proc.pid}]`, 'Init Complete');
      };

      await Promise.race([sub(), this.waitForKill]);
    } catch (e) {
      if (this.proc) {
        Logger.error(`Test[${this.proc.pid}]`, e.message, e);
      } else {
        Logger.error(`Test[none]`, e.message, e);
      }
    }
  }

  init() {
    if (!this.procHandle) {
      this.procHandle = this._init();
    }
    return this.procHandle;
  }

  async run(file: string, line: number, handler: (payload: TestEvent | { type: 'runComplete', error?: Error }) => void) {
    const relative = file.replace(Workspace.path, '.');

    Logger.debug(`Test[${this.proc.pid}]`, 'Starting', relative, line);

    await this.init();

    this.proc.on('message', e => {
      Logger.debug(`Test[${this.proc.pid}]`, 'Event Received', relative, e.type, JSON.stringify(e).substring(0, 20));
      handler(e);
    });

    try {
      Logger.info(`Test[${this.proc.pid}]`, 'Running', relative);
      this.proc.send({ type: 'run', file, class: line });

      await Promise.race([this.waitForKill, this.listenOnce('runComplete')]);
      Logger.info(`Test[${this.proc.pid}]`, 'Run Complete', relative);
    } catch (e) {
      if (e !== EXIT) {
        Logger.error(`Test[${this.proc.pid}]`, 'Errored', relative, e.message, e);
      }
    }

    if (this.proc) {
      this.proc.removeListener('message', handler);
    }
  }

  kill() {
    if (this.proc) {
      this.proc.removeAllListeners();
      this.proc.kill(process.platform === 'win32' ? undefined : 'SIGKILL');
      delete this.proc;
    }
  }

  release() {
    if (this.proc) {
      this.proc.removeAllListeners('message');
    }
  }

  get active() {
    return !!this.proc;
  }
}