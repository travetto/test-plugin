import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { SuiteResult, Assertion } from '@encore2/test';

const cwd = vscode.workspace.workspaceFolders[0].uri.path;

function buildMessage(a: Assertion) {
  return a.actual + ' should be ' + a.operator + ' ' + a.expected;
}

function getWorker() {
  let sub = child_process.spawn(require.resolve(cwd + '/node_modules/@encore2/test/bin/worker.js'), [], {
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    cwd,
    env: {
      DEBUG: 1,
      ENV: 'test'
    }
  });
  sub.stderr.on('data', d => console.log(d.toString()));
  sub.stdout.on('data', d => console.error(d.toString()));
  sub.once('message', function ready(e) {
    if (e.type === 'ready') {
      sub.removeListener('message', ready);
      console.log('Ready, lets init');
      sub.send({ type: 'init' });
    }
  });
  return sub;
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

  function buildDec(state: string) {
    return vscode.window.createTextEditorDecorationType({
      isWholeLine: false,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
      overviewRulerColor: state === 'fail' ? 'rgba(255,0,0,0.5)' : state === 'success' ? 'rgba(0,255,0,.5)' : 'rgba(255,255,255,.5)',
      //gutterIconPath: context.asAbsolutePath('images/' + state + '.png'),
      //gutterIconSize: 'auto',
      textDecoration: 'font-style: italic;',
      light: {
        after: { color: 'darkgrey' }
      },
      dark: {
        after: { color: 'lightgray' }
      }
    });
  }

  const DECORATIONS = {
    success: buildDec('success'),
    fail: buildDec('fail'),
    unknown: buildDec('unknown')
  };

  let timeout = null;
  let activeEditor: vscode.TextEditor;
  let sub = getWorker();

  sub.on('close', code => {
    sub = getWorker();
  });

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "encore2-test-plugin" is now active!', __dirname + '/success.png');

  function runTests() {
    if (!activeEditor) {
      return;
    }

    console.log('Running tests', activeEditor.document.fileName)

    try {
      let suites = [];
      sub.send({ type: 'run', file: activeEditor.document.fileName.split(cwd)[1] });
      let fn = (ev) => {
        if (ev.phase === 'after' && ev.type === 'suite') {
          suites.push(ev.suite);
        }
        if (ev.type === 'runComplete') {
          sub.removeListener('message', fn);
          onTest(activeEditor, suites);
        }
      }
      sub.on('message', fn);
    } catch (e) {
      console.log(e);
    }
  }

  function onTest(activeEditor: vscode.TextEditor, results: SuiteResult[]) {
    console.log('HEre', results);
    let decorations = [];

    let text = activeEditor.document.getText();
    let index = -1;


    let decs = {
      fail: [] as vscode.DecorationOptions[],
      success: [] as vscode.DecorationOptions[],
      unknown: [] as vscode.DecorationOptions[]
    }

    for (let suite of results) {
      for (let test of suite.tests) {
        for (let assertion of test.assertions) {
          if (assertion.error) {
            decs.fail.push({
              range: new vscode.Range(assertion.line - 1, 0, assertion.line - 1, 100000000000),
              renderOptions: {
                after: {
                  contentText: '  ' + (assertion.message || buildMessage(assertion))
                }
              }
            });
          } else {
            decs.success.push({
              range: new vscode.Range(assertion.line - 1, 0, assertion.line - 1, 100000000000),
            })
          }
        }
      }
    }
    console.log(decs);
    for (let key in decs) {
      activeEditor.setDecorations(DECORATIONS[key], decs[key]);
    }
  }

  function onUpdate(editor: vscode.TextEditor) {
    if (!editor || !editor.document || !/@Test\(/.test(editor.document.getText() || '')) {
      return;
    }

    activeEditor = editor;

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(runTests, 500);
  }

  vscode.window.onDidChangeActiveTextEditor(ed => onUpdate(ed), null, context.subscriptions);
  vscode.workspace.onDidSaveTextDocument(doc => {
    if (doc === activeEditor.document) {
      onUpdate(activeEditor);
    }
  }, null, context.subscriptions);

  onUpdate(vscode.window.activeTextEditor);
}