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

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

  let activeEditor: vscode.TextEditor;

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "travetto-test-plugin" is now active!', `${__dirname}/success.png`);

  const worker = new Worker(`node_modules/@travetto/test/bin/worker.js`);
  const mgr = new DecorationManager(context);

  async function runTests() {
    if (!activeEditor) {
      return;
    }

    await worker.init(e => {
      if (e.type === Events.READY) {
        console.log('Ready, lets init');
        return Events.INIT;
      }
    });

    const kill = await worker.run(Events.RUN, { file: activeEditor.document.fileName.split(CWD)[1] }, (ev) => {
      if (ev.phase === EntityPhase.AFTER) {
        if (ev.type === Entity.SUITE) {
          mgr.onSuite(ev.suite);
        } else if (ev.type === Entity.TEST) {
          mgr.onTest(ev.test);
        } else if (ev.type === Entity.ASSERT) {
          mgr.onAssertion(ev.assert);
        }

        mgr.applyDecorations(activeEditor);
      } else if (ev.type === Events.RUN_COMPLETE) {
        kill();
      }
    })
  }

  function onUpdate(editor: vscode.TextEditor) {
    if (!editor || !editor.document || !/@Test\(/.test(editor.document.getText() || '')) {
      return;
    }

    activeEditor = editor;

    // if (timeout) {
    //   clearTimeout(timeout);
    // }

    // timeout = setTimeout(runTests, 500);
    runTests();
  }

  vscode.window.onDidChangeActiveTextEditor(ed => onUpdate(ed), null, context.subscriptions);
  vscode.workspace.onDidSaveTextDocument(doc => {
    if (doc === activeEditor.document) {
      onUpdate(activeEditor);
    }
  }, null, context.subscriptions);

  onUpdate(vscode.window.activeTextEditor);
}