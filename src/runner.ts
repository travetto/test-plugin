import * as vscode from 'vscode';
import { DecorationManager } from './manager';
import { Entity, EntityPhase, CWD } from './types';

import { Events } from '@travetto/test/src/exec/communication';
import { ChildExecution } from '@travetto/exec';

export class TestRunner {

  private worker: ChildExecution;
  private mgr: DecorationManager;

  constructor(private context: vscode.ExtensionContext) {
    this.worker = new ChildExecution(`node_modules/@travetto/test/bin/travetto-test.js`, true, { env: 'test' });
    this.mgr = new DecorationManager(context);
  }

  async run(editor: vscode.TextEditor) {
    try {
      if (!editor || !editor.document || !/@Test\(/.test(editor.document.getText() || '')) {
        return;
      }

      const file = editor.document.fileName.split(CWD)[1];

      this.mgr.init();

      if (this.worker.init()) {
        await this.worker.listenOnce(Events.READY);
        console.log('Ready, lets init');
        this.worker.send(Events.INIT);
      }

      this.worker.listen((ev, done) => {
        if (ev.phase === EntityPhase.AFTER) {
          if (ev.type === Entity.SUITE) {
            this.mgr.onSuite(ev.suite);
          } else if (ev.type === Entity.TEST) {
            this.mgr.onTest(ev.test);
          } else if (ev.type === Entity.ASSERTION) {
            this.mgr.onAssertion(ev.assertion);
          }

          this.mgr.applyDecorations(editor);
        } else if (ev.type === Events.RUN_COMPLETE) {
          done();
        }
      });

      this.worker.send(Events.RUN, { file });
    } catch (e) {
      console.log(e);
    }
  }
}