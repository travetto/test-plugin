import * as vscode from 'vscode';
import { Worker } from './worker';
import { DecorationManager } from './manager';
import { Entity, EntityPhase, CWD } from './types';

const Events = {
  INIT: 'init',
  READY: 'ready',
  RUN: 'run',
  RUN_COMPLETE: 'runComplete'
};

export class TestRunner {

  private worker: Worker;
  private mgr: DecorationManager;

  constructor(private context: vscode.ExtensionContext) {
    this.worker = new Worker(`node_modules/@travetto/test/bin/worker.js`);
    this.mgr = new DecorationManager(context);
  }

  async run(activeEditor: vscode.TextEditor) {

    const file = activeEditor.document.fileName.split(CWD)[1];

    await this.worker.init(e => {
      if (e.type === Events.READY) {
        console.log('Ready, lets init');
        this.worker.send({ type: Events.INIT });
        return true;
      }
    });

    await this.worker.send({ type: Events.RUN, file });

    await this.worker.listen((ev) => {
      if (ev.phase === EntityPhase.AFTER) {
        if (ev.type === Entity.SUITE) {
          this.mgr.onSuite(ev.suite);
        } else if (ev.type === Entity.TEST) {
          this.mgr.onTest(ev.test);
        } else if (ev.type === Entity.ASSERT) {
          this.mgr.onAssertion(ev.assert);
        }

        this.mgr.applyDecorations(activeEditor);
      } else if (ev.type === Events.RUN_COMPLETE) {
        return true;
      }
    });
  }
}