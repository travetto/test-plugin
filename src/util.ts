import * as vscode from 'vscode';
import * as util from 'util';
import * as ts from 'typescript';
import * as path from 'path';

export const CWD = `${vscode.workspace.workspaceFolders[0].uri.path}`.replace(/[\\\/]/g, path.sep).replace(/^[\\\/]([A-Z]:)/i, (a, b) => b);

export const toLocalFile = (p: string) => `${CWD.replace(/[\\]/g, '/')}/node_modules/${p}`;
export const requireLocal = (p: string) => require(toLocalFile(p));

export const channel = vscode.window.createOutputChannel('@travetto/test');

export function log(message: string, ...args: any[]) {
  channel.appendLine(`${message} ${args.map(x => util.inspect(x)).join(' ')}`);
}

export function debug(message: string, ...args: any[]) {
  if (process.env.DEBUG) {
    channel.appendLine(`${message} ${args.map(x => util.inspect(x)).join(' ')}`);
  }
}

export function getCurrentClassMethod(document: vscode.TextDocument, line: number) {
  const sourceFile = ts.createSourceFile('text', document.getText(), ts.ScriptTarget.ES2018);

  function getElementByDecoration<T extends { kind: ts.SyntaxKind }>(
    children: { [key: number]: ts.Node, length: number },
    type: T['kind'],
    decoration: string,
    offset: number = 0
  ) {

    for (let l = 0; l < children.length; l++) {
      const stmt = children[l];
      const locStart = ts.getLineAndCharacterOfPosition(sourceFile, stmt.pos);
      const locEnd = ts.getLineAndCharacterOfPosition(sourceFile, stmt.end);
      const start = locStart.line + 1;
      const end = locEnd.line + 1;
      if (start <= line && end > line) {
        if (stmt.kind === type
          && stmt.decorators
          && stmt.decorators.find(x => ts.isCallExpression(x.expression)
            && ts.isIdentifier(x.expression.expression)
            && x.expression.expression.text === decoration)) {
          return { node: stmt as any as T, start, end };
        }
        break;
      }
    }
    return;
  }
  const out: Partial<{ suite: ts.ClassDeclaration, method: ts.MethodDeclaration }> = {};
  const suiteRes = getElementByDecoration<ts.ClassDeclaration>(sourceFile.statements, ts.SyntaxKind.ClassDeclaration, 'Suite');
  if (suiteRes) {
    out.suite = suiteRes.node;
  }
  const methRes = suiteRes ? getElementByDecoration<ts.MethodDeclaration>(suiteRes.node.members, ts.SyntaxKind.MethodDeclaration, 'Test', suiteRes.start) : undefined;
  if (methRes) {
    out.method = methRes.node;
  }

  return out;
}

export function fork(cmd: string, args: string[] = []) {
  return new Promise<string>((resolve, reject) => {
    let text = [];
    let err = [];
    const proc = require('child_process').fork(cmd, args || [], {
      env: process.env,
      cwd: CWD,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });
    proc.stdout.on('data', v => text.push(v));
    proc.stderr.on('data', v => err.push(v));
    proc.on('exit', v => {
      if (v === 0) {
        resolve(Buffer.concat(text).toString());
      } else {
        reject(Buffer.concat(err).toString());
      }
    });
  });
}