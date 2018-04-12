import * as vscode from 'vscode';
import { TestRunner } from './runner';
import { TestExecution } from './execution';
import { Decorations } from './decoration';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  Decorations.context = context;

  const runner = new TestRunner();
  const isEditor = (o: any): o is vscode.TextEditor => o && 'document' in o;

  function onUpdate(target?: vscode.TextEditor | vscode.TextDocument) {

    const editor = vscode.window.activeTextEditor;

    if (!isEditor(target)) {
      if (!editor || editor.document !== target) {
        return;
      }
    }

    if (editor.document && /@Test\(/.test(editor.document.getText() || '')) {
      runner.run(editor, isEditor(target)).catch(e => console.error(e));
    }
  };

  vscode.window.onDidChangeActiveTextEditor(onUpdate, null, context.subscriptions);
  vscode.workspace.onDidSaveTextDocument(onUpdate, null, context.subscriptions);

  onUpdate();

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "travetto-test-plugin" is now active!', `${__dirname}/success.png`);
}