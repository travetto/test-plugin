import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { Util } from './util';

const writeProm = util.promisify(fs.writeFile);

const cacheDir = [
  os.tmpdir(),
  'travetto-plugin',
  `${Util.hash(vscode.workspace.workspaceFolders[0].uri.fsPath)}`
].reduce((acc, v) => {
  let out = path.resolve(acc, v);
  if (!fs.existsSync(out)) {
    fs.mkdirSync(out);
  }
  return out;
}, '');

console.log('storage', cacheDir);

export class ActionStorage<T> {

  private storage: { [key: string]: { data: T, time: number } } = {};

  constructor(public scope: string, public root: string = cacheDir) {
    this.init();
  }

  get resolved() {
    return path.resolve(this.root, `${this.scope}.json`);
  }

  async init(): Promise<void> {
    try {
      if (!fs.existsSync(this.root)) {
        fs.mkdirSync(this.root);
      }

      this.storage = JSON.parse(fs.readFileSync(this.resolved).toString());
    } catch {
      await this.persist();
    }
  }

  reset() {
    this.storage = {};
    return this.persist();
  }

  persist() {
    return writeProm(this.resolved, JSON.stringify(this.storage));
  }

  async set(key: string, value?: T): Promise<void> {
    if (value) {
      this.storage[key] = { data: value, time: Date.now() };
    } else {
      delete this.storage[key];
    }
    return this.persist(); // Don't wait
  }

  has(key: string) {
    return key in this.storage;
  }

  get(key: string): T & { time: number } {
    const ent = this.storage[key];
    return { ...ent.data, time: ent.time };
  }

  getRecent(size = 5): (T & { time: number })[] {
    return Object.values(this.storage)
      .sort((a, b) => b.time - a.time)
      .slice(0, size)
      .map(x => ({ ...x.data, time: x.time }));
  }
}