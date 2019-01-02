import { Pool, createPool } from 'generic-pool';
import { TestExecution } from './execution';
import { Workspace } from '../../../core/workspace';
import { Logger } from '../../../core/log';

export class TestExecutionPool {
  private pool: Pool<TestExecution>;
  private active = false;

  constructor() {
    this.init();
  }

  init() {
    // tslint:disable-next-line:no-this-assignment
    const self = this;
    this.pool = createPool<TestExecution>({
      async create() {
        if (!self.active) {
          const { PhaseManager } = Workspace.requireLibrary('@travetto/base/src/phase');
          await new PhaseManager('test').load().run();
          self.active = true;
        }

        const exec = new TestExecution();
        await exec.init();
        Logger.debug(`Test[${(exec as any).proc.pid}]`, 'Created');
        return exec;
      },
      async destroy(exec) {
        Logger.debug(`Test[${(exec as any).proc.pid}]`, 'Killing');
        exec.kill();
        return undefined;
      },
      async validate(exec) {
        return exec.active;
      }
    }, { min: 0, max: 4, testOnBorrow: true, autostart: true });
  }

  async run(op: (exec: TestExecution) => Promise<void>, lock?: { active: boolean }) {
    let exec: TestExecution = undefined as any;
    if (lock) {
      if (lock.active) {
        throw new Error('Already in progress');
      }
      lock.active = true;
    }

    try {
      // Run
      exec = await this.pool.acquire();
      Logger.debug(`Test[${(exec as any).proc.pid}]`, 'Acquired');
      await op(exec);
    } catch (e) {
      if (e.fatal && exec !== undefined) { // Kill if needed
        Logger.debug(`Test[${(exec as any).proc.pid}]`, 'Killing');
        exec.kill();
      }
    } finally {
      if (lock) {
        lock.active = false;
      }

      // Cleanup
      if (exec) {
        Logger.debug(`Test[${(exec as any).proc.pid}]`, 'Releasing');
        exec.release();
        if (this.pool.isBorrowedResource(exec)) {
          await this.pool.release(exec);
        }
      }
    }
  }

  async shutdown() {
    await this.pool.drain();
    this.pool.clear();
  }
}