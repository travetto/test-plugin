import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
import { FsUtil } from '@travetto/boot';

import { Workspace } from './workspace';

const writeProm = util.promisify(fs.writeFile);

/**
 * Storage manager
 */
export class ActionStorage<T> {

  /**
   * Local stroage
   */
  private storage: Record<string, { key: string, data: T, time: number }> = {};

  constructor(public scope: string, public root: string = Workspace.cacheDir) {
    this.init();
  }

  /**
   * Load configuration
   */
  get resolved() {
    return path.resolve(this.root, `${this.scope}.json`);
  }

  /**
   * Initialize
   */
  async init(): Promise<void> {
    try {
      if (FsUtil.existsSync(this.root)) {
        FsUtil.mkdirpSync(this.root);
      }

      this.storage = JSON.parse(fs.readFileSync(this.resolved, 'utf8'));
    } catch {
      await this.persist();
    }
  }

  reset() {
    this.storage = {};
    return this.persist();
  }

  persist() {
    return writeProm(this.resolved, JSON.stringify(this.storage), 'utf8');
  }

  /**
   * Set value
   * @param key 
   * @param value 
   */
  async set(key: string, value?: T): Promise<void> {
    if (value) {
      this.storage[key] = { key, data: value, time: Date.now() };
    } else {
      delete this.storage[key];
    }
    return this.persist(); // Don't wait
  }

  /**
   * Check value
   * @param key 
   */
  has(key: string) {
    return key in this.storage;
  }

  /**
   * Get value
   * @param key 
   */
  get(key: string): T & { time: number } {
    const ent = this.storage[key];
    return { ...ent.data, time: ent.time };
  }

  /**
   * Get most recent values
   * @param size 
   */
  getRecent(size = 5): (T & { key: string, time: number })[] {
    return Object.values(this.storage)
      .sort((a, b) => b.time - a.time)
      .slice(0, size)
      .map(x => ({ ...x.data, key: x.key, time: x.time }));
  }

  /**
   * Get recent and filter out stale data
   * @param size 
   * @param remove 
   */
  getRecentAndFilterState(size: number, remove: (x: T) => boolean) {
    return this.getRecent(size)
      .filter(x => {
        if (remove(x)) {
          this.set(x.key!);
        }
        return x;
      });
  }
}