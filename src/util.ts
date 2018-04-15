import * as vscode from 'vscode';

export const CWD = `${vscode.workspace.workspaceFolders[0].uri.path}/`;

export function log(...args: any[]) {
  if (console.debug) {
    console.debug(...args);
  }
}