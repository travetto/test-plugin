import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { SuiteResult, Assertion, TestResult } from '@travetto/test/src/model';
import { deserialize } from '@travetto/test/src/exec/agent/error';

const cwd = vscode.workspace.workspaceFolders[0].uri.path;

type TestDecs = { [key: string]: { [key: string]: vscode.DecorationOptions[] } };

function line(n: number) {
  return { range: new vscode.Range(n - 1, 0, n - 1, 100000000000) }
}

function getWorker() {
  const sub = child_process.spawn(require.resolve(`${cwd}/node_modules/@travetto/test/bin/worker.js`), [], {
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
    const img = context.asAbsolutePath(`images/${state}.png`);
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
  console.log('Congratulations, your extension "travetto-test-plugin" is now active!', `${__dirname}/success.png`);

  function assertionToDec(assertion: Assertion) {
    let dec;
    if (assertion.error) {
      dec = {
        ...line(assertion.line),
        hoverMessage: {
          language: 'html',
          value: `${assertion.error.stack}`
        },
        renderOptions: {
          after: {
            textDecoration: 'font-style: italic;',
            contentText: `    ${assertion.message}`
          }
        }
      };
    } else {
      dec = line(assertion.line);
    }
    return { dec, status: assertion.error ? 'fail' : 'success' };
  }

  function testToDec(test: TestResult) {
    const hoverMessage = test.error ? {
      language: 'html',
      value: `${test.error.stack}`
    } : ''

    const dec = {
      ...line(test.line),
      hoverMessage
    };

    return { dec, status: test.status === 'skip' ? 'unknown' : test.status };
  }

  function receiveTest(test: TestResult) {
    if (test.error) {
      test.error = deserialize(test.error);
    }
    for (const a of test.assertions) {
      if (a.error) {
        a.error = deserialize(a.error);
      }
    }

    return { test: testToDec(test), assertions: test.assertions.map(assertionToDec) }
  }

  function suiteToDec(suite: SuiteResult) {
    return { dec: line(suite.line), status: suite.skip ? 'unknown' : (suite.fail ? 'fail' : 'success') }
  }

  function receiveSuite(suite: SuiteResult) {
    return { suite: suiteToDec(suite) }
  }

  function setDecorations(decs: TestDecs) {
    for (const key of ['suite', 'test', 'assert']) {
      for (const type of ['fail', 'success', 'unknown']) {
        activeEditor.setDecorations(DECORATIONS[key][type], (decs[key] || {})[type] || []);
      }
    }
  }

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

    const decs: TestDecs = {
      suite: { success: [], fail: [], unknown: [] },
      test: { success: [], fail: [], unknown: [] },
      assert: { success: [], fail: [] }
    }

    try {
      sub.send({ type: 'run', file: activeEditor.document.fileName.split(cwd)[1] });
      sub.on('message', function fn(ev) {

        if (ev.phase === 'after') {
          if (ev.type === 'suite') {
            const { suite } = receiveSuite(ev.suite);
            const { status, dec } = suite;
            decs.suite[status].push(dec);
          } else if (ev.type === 'test') {
            const { test, assertions } = receiveTest(ev.test);
            const { status: tstatus, dec: tdec } = test;
            decs.test[tstatus].push(tdec);
            for (const { status, dec } of assertions) {
              decs.assert[status].push(dec);
            }
          }

          setDecorations(decs);
        }

        if (ev.type === 'runComplete') {
          sub.removeListener('message', fn);
        }
      });
    } catch (e) {
      console.log(e);
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