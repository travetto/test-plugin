import * as vscode from 'vscode';
import * as util from 'util';
import * as ts from 'typescript';
import * as path from 'path';

export class Util {
  static CWD = `${vscode.workspace.workspaceFolders[0].uri.path}`.replace(/[\\\/]/g, path.sep).replace(/^[\\\/]([A-Z]:)/i, (a, b) => b);

  static toLocalFile = (p: string) => `${Util.CWD.replace(/[\\]/g, '/')}/node_modules/${p}`;
  static requireLocal = (p: string) => require(Util.toLocalFile(p));

  static channel = vscode.window.createOutputChannel('@travetto');

  static log(message: string, ...args: any[]) {
    Util.channel.appendLine(`${message} ${args.map(x => util.inspect(x)).join(' ')}`);
  }

  static debug(message: string, ...args: any[]) {
    if (process.env.DEBUG) {
      Util.channel.appendLine(`${message} ${args.map(x => util.inspect(x)).join(' ')}`);
    }
  }

  static getCurrentClassMethod(document: vscode.TextDocument, line: number) {
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

  static fork(cmd: string, args: string[] = []) {
    return new Promise<string>((resolve, reject) => {
      let text = [];
      let err = [];
      const proc = require('child_process').fork(cmd, args || [], {
        env: process.env,
        cwd: Util.CWD,
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

  static debugSession(config: { name: string, program: string } & Partial<vscode.DebugConfiguration>) {
    return vscode.debug.startDebugging(vscode.workspace.workspaceFolders[0], {
      type: 'node',
      request: 'launch',
      protocol: 'inspector',
      cwd: Util.CWD,
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
      console: 'internalConsole',
      internalConsoleOptions: 'openOnSessionStart',
      ...config
    });
  }

  static hash(t: string) {
    var hash = 0;
    if (t.length == 0) {
      return hash;
    }
    for (var i = 0; i < t.length; i++) {
      var char = t.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }
}