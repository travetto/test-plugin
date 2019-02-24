import * as ts from 'typescript';
import * as vscode from 'vscode';
import { Workspace } from '../../../core/workspace';

export class TestUtil {
  static TRV_TEST_BASE = `${Workspace.path}/node_modules/@travetto/test`;

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
}