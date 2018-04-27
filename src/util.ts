import * as vscode from 'vscode';
import * as util from 'util';
import * as fs from 'fs';

export const CWD = `${vscode.workspace.workspaceFolders[0].uri.path}`;

export const channel = vscode.window.createOutputChannel('@travetto/test');

export function log(message: string, ...args: any[]) {
  channel.appendLine(`${message} ${args.map(x => util.inspect(x)).join(' ')}`);
}

export function debug(message: string, ...args: any[]) {
  if (process.env.DEBUG) {
    channel.appendLine(`${message} ${args.map(x => util.inspect(x)).join(' ')}`);
  }
}
