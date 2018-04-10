import * as vscode from 'vscode';
import { TestRunner } from './runner';
import { TestExecution } from './execution';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

  let activeEditor: vscode.TextEditor = vscode.window.activeTextEditor;
  const runner = new TestRunner(context);

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "travetto-test-plugin" is now active!', `${__dirname}/success.png`);

  const onUpdate = async (ed?: vscode.TextEditor, firstLoad: boolean = false) => {

    if (ed) {
      activeEditor = ed;
    }

    if (activeEditor === vscode.window.activeTextEditor) {
      try {
        await runner.run(activeEditor, firstLoad);
      } catch (e) {
        console.error(e);
      }
    }
  };

  vscode.window.onDidChangeActiveTextEditor((editor) => onUpdate(editor, true), null, context.subscriptions);
  vscode.workspace.onDidSaveTextDocument(doc => {
    if (doc === activeEditor.document) {
      onUpdate();
    }
  }, null, context.subscriptions);

  onUpdate();
}