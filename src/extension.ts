import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { SuiteResult, Assertion } from '@travetto/test/src/model';

const cwd = vscode.workspace.workspaceFolders[0].uri.path;

function line(n: number) {
  return { range: new vscode.Range(n - 1, 0, n - 1, 100000000000) }
}

function getWorker() {
  const sub = child_process.spawn(require.resolve(cwd + '/node_modules/@travetto/test/bin/worker.js'), [], {
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
    sub.on('message', function ready(e) {
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
    const color = state === 'fail' ? 'rgba(255,0,0,0.5)' : state === 'success' ? 'rgba(0,255,0,.5)' : 'rgba(255,255,255,.5)';
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
    const img = context.asAbsolutePath('images/' + state + '.png');
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

  let activeEditor: vscode.TextEditor;
  let sub: child_process.ChildProcess;

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "travetto-test-plugin" is now active!', __dirname + '/success.png');

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
      const suites = [];
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

  function onTest(editor: vscode.TextEditor, results: SuiteResult[]) {
    console.log('HEre', results);
    const decorations = [];

    const text = editor.document.getText();

    const decs: { [key: string]: { [key: string]: vscode.DecorationOptions[] } } = {
      assert: { fail: [], success: [], unknown: [] },
      test: { fail: [], success: [], unknown: [] },
      suite: { fail: [], success: [], unknown: [] }
    }

    for (const suite of results) {
      for (const test of suite.tests) {
        for (const assertion of test.assertions) {
          if (assertion.error) {
            decs.assert.fail.push({
              ...line(assertion.line),
              renderOptions: {
                after: {
                  textDecoration: 'font-style: italic;',
                  contentText: '    ' + assertion.message
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

    for (const key of Object.keys(decs)) {
      for (const type of Object.keys(decs[key])) {
        editor.setDecorations(DECORATIONS[key][type], decs[key][type]);
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