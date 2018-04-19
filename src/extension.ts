import * as vscode from 'vscode';
import * as diff from 'diff';

import { TestRunner } from './runner';
import { TestExecution } from './execution';
import { Decorations } from './decoration';
import { CWD } from './util';

const runner = new TestRunner(vscode.window);

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  Decorations.context = context;

  let prevEditor: vscode.TextEditor;

  try {
    let oldText = '';

    function onUpdate(target?: vscode.TextDocument, line?: number) {

      const editor = vscode.window.activeTextEditor;

      if (!editor || (target && editor.document !== target)) {
        return;
      }

      if (editor.document && /@Test\(/.test(editor.document.getText() || '')) {
        prevEditor = editor;

        const newText = editor.document.getText();
        const lines = [];

        if (!lines.length && oldText) {
          const changes = diff.structuredPatch('a', 'b', oldText, newText, 'a', 'b', { context: 0 });
          const newLines = changes.hunks.map(x => x.newStart || x.oldStart);
          if (newLines.length < 5) {
            lines.push(...newLines);
          }
        }

        if (!lines.length) {
          lines.push(line || 1);
        }

        runner.run(editor, lines).catch(e => console.error(e));

        oldText = newText;
      } else {
        runner.setStatus('');
      }
    };

    vscode.window.onDidChangeActiveTextEditor(() => {
      if (vscode.window.activeTextEditor) {
        const sameAsPrev =
          prevEditor &&
          prevEditor.document &&
          vscode.window.activeTextEditor.document &&
          vscode.window.activeTextEditor.document.fileName === prevEditor.document.fileName;

        if (!prevEditor || !sameAsPrev) {
          oldText = '';
          onUpdate(undefined, 1);
        } else if (sameAsPrev) {
          runner.setEditor(vscode.window.activeTextEditor, true);
        }
      }
    }, null, context.subscriptions);
    vscode.workspace.onDidSaveTextDocument(
      x => onUpdate(x, vscode.window.activeTextEditor.selection.start.line),
      null, context.subscriptions);

    onUpdate();

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "travetto-test-plugin" is now active!', `${__dirname}/success.png`);
  } catch (e) {
    console.error('WOAH', e);
  }
}

async function deactivate() {
  await runner.shutdown();
}

async function debug(addBreakpoint: boolean = false) {
  const editor = vscode.window.activeTextEditor;

  if (editor.document && /@Test\(/.test(editor.document.getText() || '')) {
    const line = editor.selection.start.line + 1;

    if (addBreakpoint) {
      const uri = editor.document.uri;
      const pos = new vscode.Position(line - 1, 0);
      const loc = new vscode.Location(uri, pos);
      let breakpoint = new vscode.SourceBreakpoint(loc, true);
      vscode.debug.addBreakpoints([breakpoint]);

      const remove = vscode.debug.onDidTerminateDebugSession(e => {
        vscode.debug.removeBreakpoints([breakpoint]);
        remove.dispose();
      });
    }

    await vscode.debug.startDebugging(vscode.workspace.workspaceFolders[0], {
      type: 'node',
      request: 'launch',
      protocol: 'inspector',
      env: {
        DEBUG: '',
        DEBUGGER: true
      },
      cwd: CWD,
      name: 'Debug Travetto',
      program: '${workspaceFolder}/node_modules/.bin/travetto-test',
      stopOnEntry: false,
      sourceMaps: true,
      runtimeArgs: [
        "--nolazy"
      ],
      skipFiles: [
        '<node_internals>/**',
        '**/@travetto/base/**/stacktrace.**',
        '**/node_modules/cls-hooked/**/*',
        '**/node_modules/trace/**/*',
        '**/node_modules/stack-chain/**/*'
      ],
      args: [
        '-m',
        'single',
        '--',
        `${editor.document.fileName}`,
        `${line}`
      ],
      console: 'internalConsole',
      internalConsoleOptions: 'openOnSessionStart'
    });
  }
}

vscode.commands.registerCommand('extension.triggerDebug', async config => debug());
vscode.commands.registerCommand('extension.triggerDebugKey', async config => debug(true));