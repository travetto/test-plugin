import * as vscode from 'vscode';
import * as child_process from 'child_process';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {


  function buildDec(state: string) {
    return vscode.window.createTextEditorDecorationType({
      isWholeLine: false,
      gutterIconPath: context.asAbsolutePath('../images/' + state + '.png'),
      gutterIconSize: 'auto',
      textDecoration: 'font-style: italic;',
      light: {
        // this color will be used in light color themes
        after: {
          color: 'darkgrey'
        }
      },
      dark: {
        // this color will be used in dark color themes
        after: {
          color: 'lightgray'
        }
      }
    });
  }

  const DECORATIONS = {
    success: buildDec('success'),
    fail: buildDec('fail'),
    unknown: buildDec('unknown')
  };

  let sub = child_process.spawn(require.resolve('@encore2/test/bin/worker.js'), [], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc']
  });
  sub.send({ type: 'init ' });
  sub.on('message', e => {
    console.log('Done');
    console.log(e);
  });
  sub.on('error', err => {
    console.log('Error', err);
  });
  sub.on('close', (code) => {
    console.log('Closed', code);
  });

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "encore2-test-plugin" is now active!', __dirname + '/success.png');

  let timeout = null;
  let activeEditor = vscode.window.activeTextEditor;

  function runTests() {
    if (!activeEditor) {
      return;
    }
    try {
      sub.send({ type: 'run', file: activeEditor.document.fileName });
    } catch (e) {
      console.log(e);
    }
  }

  function onTest(activeEditor: vscode.TextEditor, results: any) {
    let decorations = [];

    let text = activeEditor.document.getText();
    let index = -1;

    while ((index = text.indexOf('@Test(', index + 1)) >= 0) {
      let pos = activeEditor.document.positionAt(index);
      decorations.push({
        range: new vscode.Range(pos.line, 0, pos.line, 100000000000),
        renderOptions: {
          after: {
            contentText: '  Woah ' + Math.random()
          }
        }
      })
    }

    activeEditor.setDecorations(DECORATIONS.unknown, decorations);
  }

  function triggerRunTests() {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(runTests, 500);
  }

  if (activeEditor) {
    triggerRunTests();
  }

  vscode.window.onDidChangeActiveTextEditor(editor => {
    activeEditor = editor;
    if (editor) {
      triggerRunTests();
    }
  }, null, context.subscriptions);

  vscode.workspace.onDidSaveTextDocument(event => {
    if (activeEditor.document === event) {
      triggerRunTests();
    }
  }, null, context.subscriptions);
}