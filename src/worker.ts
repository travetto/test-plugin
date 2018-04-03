import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as spawn from 'cross-spawn';

import { EntityPhase, Entity, CWD } from './types';

type Event = { type: string } & { [key: string]: any };
type EventHandler = (e: Event) => boolean | undefined;
const ProcEvents = {
  MESSAGE: 'message',
  CLOSE: 'close'
}

export class Worker {
  private sub: child_process.ChildProcess;

  constructor(private script: string, private args?: any[], private env?: object, private cwd?: string) { }

  async init(handler: EventHandler) {
    if (this.sub) {
      return;
    }

    this.sub = spawn(`${CWD}/${this.script}`, this.args || [], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      cwd: this.cwd || CWD,
      env: this.env || {}
    });

    this.sub.stderr.on('data', d => console.log(d.toString()));
    this.sub.stdout.on('data', d => console.error(d.toString()));
    this.sub.on(ProcEvents.CLOSE, async code => this.sub = undefined);

    await this.listen(handler);
  }

  async send(e: Event) {
    this.sub.send(e);
  }

  async listen(handler: EventHandler) {
    return new Promise((resolve, reject) => {
      const kill = () => {
        this.sub.removeListener(ProcEvents.MESSAGE, fn);
      };
      const fn = (e) => {
        try {
          if (handler(e)) {
            kill();
            resolve();
          }
        } catch (e) {
          kill();
          reject(e);
        }
      };
      this.sub.on(ProcEvents.MESSAGE, fn);
    });
  }
}