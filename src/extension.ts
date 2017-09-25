import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { SuiteResult, Assertion } from '@encore2/test/src/model';

const cwd = vscode.workspace.workspaceFolders[0].uri.path;

function buildMessage(a: Assertion) {
  return a.actual + ' should be ' + a.operator + ' ' + a.expected;
}

function line(n: number) {
  return { range: new vscode.Range(n - 1, 0, n - 1, 100000000000) }
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
  return new Promise<child_process.ChildProcess>((resolve, reject) => {
    sub.once('message', function ready(e) {
      if (e.type === 'ready') {
        sub.removeListener('message', ready);
        console.log('Ready, lets init');
        sub.send({ type: 'init' });
        resolve(sub);
      }
    });
  });
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

  function buildAssertDec(state: string) {
    let color = state === 'fail' ? 'rgba(255,0,0,0.5)' : state === 'success' ? 'rgba(0,255,0,.5)' : 'rgba(255,255,255,.5)';
    return vscode.window.createTextEditorDecorationType({
      isWholeLine: false,
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      borderWidth: '0 0 0 4px',
      borderStyle: 'solid',
      borderColor: color,
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      overviewRulerColor: state === 'fail' ? color : '',
      after: {
        textDecoration: 'none; font-style: italic',
      },
      light: {
        after: { color: 'darkgrey' }
      },
      dark: {
        after: { color: 'gray' }
      }
    });
  }

  function buildImageDec(state: string, size = 'auto') {
    let img = context.asAbsolutePath('images/' + state + '.png');
    return vscode.window.createTextEditorDecorationType({
      isWholeLine: false,
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      gutterIconPath: img,
      gutterIconSize: '40%'
    });
  }

  const DECORATIONS = {
    assert: {
      success: buildAssertDec('success'),
      fail: buildAssertDec('fail'),
      unknown: buildAssertDec('unknown')
    },
    test: {
      success: buildImageDec('success', '40%'),
      fail: buildImageDec('fail', '40%'),
      unknown: buildImageDec('unknown', '40%')
    },
    suite: {
      success: buildImageDec('success'),
      fail: buildImageDec('fail'),
      unknown: buildImageDec('unknown')
    }
  };

  let timeout = null;
  let activeEditor: vscode.TextEditor;
  let sub: child_process.ChildProcess;

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "encore2-test-plugin" is now active!', __dirname + '/success.png');

  async function runTests() {
    if (!activeEditor) {
      return;
    }

    if (!sub) {
      sub = await getWorker();
      sub.on('close', async code => {
        sub = undefined;
      });
    }

    console.log('Running tests', activeEditor.document.fileName)

    try {
      let suites = [];
      sub.send({ type: 'run', file: activeEditor.document.fileName.split(cwd)[1] });
      sub.on('message', function fn(ev) {
        if (ev.phase === 'after' && ev.type === 'suite') {
          suites.push(ev.suite);
        }
        if (ev.type === 'runComplete') {
          sub.removeListener('message', fn);
          onTest(activeEditor, suites);
        }
      });
    } catch (e) {
      console.log(e);
    }
  }

  function onTest(activeEditor: vscode.TextEditor, results: SuiteResult[]) {
    console.log('HEre', results);
    let decorations = [];

    let text = activeEditor.document.getText();
    let index = -1;

    let decs: { [key: string]: { [key: string]: vscode.DecorationOptions[] } } = {
      assert: { fail: [], success: [], unknown: [] },
      test: { fail: [], success: [], unknown: [] },
      suite: { fail: [], success: [], unknown: [] }
    }

    for (let suite of results) {
      for (let test of suite.tests) {
        for (let assertion of test.assertions) {
          if (assertion.error) {
            decs.assert.fail.push({
              ...line(assertion.line),
              renderOptions: {
                after: {
                  textDecoration: 'font-style: italic;',
                  contentText: '    ' + (assertion.message || buildMessage(assertion))
                }
              }
            });
          } else {
            decs.assert.success.push(line(assertion.line));
          }
        }
        decs.test[test.status === 'skip' ? 'unknown' : test.status].push(line(test.line));
      }

      if (suite.fail) {
        decs.suite.fail.push(line(suite.line));
      } else if (suite.success) {
        decs.suite.success.push(line(suite.line));
      } else if (suite.skip) {
        decs.suite.unknown.push(line(suite.line));
      }
    }

    for (let key of Object.keys(decs)) {
      for (let type of Object.keys(decs[key])) {
        activeEditor.setDecorations(DECORATIONS[key][type], decs[key][type]);
      }
    }
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