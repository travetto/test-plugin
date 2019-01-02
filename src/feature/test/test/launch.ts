import * as path from 'path';
import * as vscode from 'vscode';

import { Workspace } from '../../../core/workspace';

const { Env } = Workspace.requireLibrary('@travetto/base/src/env');

export async function launchTests(addBreakpoint: boolean = false) {

  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    throw new Error('No editor for tests');
  }

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

    return await vscode.debug.startDebugging(Workspace.folder, Workspace.generateLaunchConfig({
      name: 'Debug Travetto',
      // tslint:disable-next-line:no-invalid-template-strings
      program: '${workspaceFolder}/node_modules/@travetto/test/bin/travetto-cli-test',
      args: [
        `${editor.document.fileName.replace(`${Workspace.path}${path.sep}`, '')}`,
        `${line}`
      ].filter(x => x !== ''),
      env
    }));
  }
}
