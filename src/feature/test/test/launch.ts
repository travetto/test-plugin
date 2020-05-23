import * as path from 'path';
import * as vscode from 'vscode';

import { Workspace } from '../../../core/workspace';

/**
 * Launch a test from the current location
 * @param addBreakpoint 
 */
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
      ...Workspace.getDefaultEnv({ DEBUG: '1' })
    };

    return await vscode.debug.startDebugging(Workspace.folder, Workspace.generateLaunchConfig({
      name: 'Debug Travetto',
      program: `${Workspace.path}/node_modules/@travetto/test/bin/travetto-plugin-test`,
      args: [
        `${editor.document.fileName.replace(`${Workspace.path}${path.sep}`, '')}`,
        `${line}`
      ].filter(x => x !== ''),
      env
    }));
  }
}
