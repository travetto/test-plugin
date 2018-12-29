import * as path from 'path';
import * as vscode from 'vscode';

import { CWD, requireLocal } from '../../../util';

const { Env } = requireLocal('@travetto/base/src/env');

export async function launchTests(addBreakpoint: boolean = false) {

  const editor = vscode.window.activeTextEditor;

  if (editor.document && /@Test\(/.test(editor.document.getText() || '')) {
    const line = editor.selection.start.line + 1;

    if (addBreakpoint) {
      const uri = editor.document.uri;
      const pos = new vscode.Position(line - 1, 0);
      const loc = new vscode.Location(uri, pos);
      const breakpoint = new vscode.SourceBreakpoint(loc, true);
      vscode.debug.addBreakpoints([breakpoint]);

      const remove = vscode.debug.onDidTerminateDebugSession(e => {
        vscode.debug.removeBreakpoints([breakpoint]);
        remove.dispose();
      });
    }

    const env: { [key: string]: any } = {
      DEBUG: '',
      ENV: 'test',
      DEBUGGER: true
    };

    if (Env.frameworkDev) {
      env.NODE_PRESERVE_SYMLINKS = 1;
    }

    await vscode.debug.startDebugging(vscode.workspace.workspaceFolders[0], {
      type: 'node',
      request: 'launch',
      protocol: 'inspector',
      env,
      cwd: CWD,
      name: 'Debug Travetto',
      // tslint:disable-next-line:no-invalid-template-strings
      program: '${workspaceFolder}/node_modules/@travetto/test/bin/travetto-cli-test',
      stopOnEntry: false,
      sourceMaps: true,
      runtimeArgs: [
        '--nolazy'
      ],
      skipFiles: [
        '<node_internals>/**',
        '**/@travetto/context/**/*',
        '**/@travetto/base/**/stacktrace.*',
        '**/@travetto/compiler/**/proxy.*',
        '**/node_modules/cls-hooked/**/*',
        '**/node_modules/trace/**/*',
        '**/node_modules/stack-chain/**/*'
      ],
      args: [
        `${editor.document.fileName.replace(`${CWD}${path.sep}`, '')}`,
        `${line}`
      ].filter(x => x != ''),
      console: 'internalConsole',
      internalConsoleOptions: 'openOnSessionStart'
    });
  }
}
