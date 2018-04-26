import * as vscode from 'vscode';
import * as util from 'util';
import * as fs from 'fs';
import { dirname } from 'path';

export const CWD = `${vscode.workspace.workspaceFolders[0].uri.path}/`;

export const channel = vscode.window.createOutputChannel('@travetto/test');

export function log(message: string, ...args: any[]) {
  if (channel) {
    channel.appendLine(`${message} ${args.map(x => util.inspect(x)).join(' ')}`);
  }
}

export const ROOT = fs.statSync(`${CWD}/node_modules/.bin/travetto-test`) ?
  CWD :
  dirname(dirname(dirname(require.resolve('@travetto/test'))));