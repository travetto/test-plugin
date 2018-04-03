import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as spawn from 'cross-spawn';

import { EntityPhase, Entity, CWD } from './types';

const ProcEvents = {
  MESSAGE: 'message',
  CLOSE: 'close'
}

export class Worker {
  private sub: child_process.ChildProcess;

  constructor(private script: string, private args?: any[], private env?: object, private cwd?: string) { }

  async _init(handler: (event: any) => void) {
    const sub = spawn(`${CWD}/${this.script}`, this.args || [], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      cwd: this.cwd || CWD,
      env: this.env || {}
    });

    sub.stderr.on('data', d => console.log(d.toString()));
    sub.stdout.on('data', d => console.error(d.toString()));

    return new Promise<child_process.ChildProcess>((resolve, reject) => {
      const send = (type: string, data: object) => sub.send({ type, ...data });
      sub.on(ProcEvents.MESSAGE, function ready(e) {
        const res = handler(e);
        if (res) {
          sub.removeListener(ProcEvents.MESSAGE, ready);
          resolve(sub)
        }
      });
      sub.on(ProcEvents.CLOSE, async code => this.sub = undefined);
    });
  }

  async init(handler: (e: any) => void) {
    if (!this.sub) {
      this.sub = await this._init(handler);
    }
  }

  async run(event: string, data: object, handler: (event: any) => void) {
    const fn = (e) => handler(e);
    this.sub.send({ type: event, ...data });

    this.sub.on(ProcEvents.MESSAGE, fn);

    return () => {
      this.sub.removeListener(ProcEvents.MESSAGE, fn);
    }
  }
}