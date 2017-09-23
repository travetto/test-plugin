'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "encore2-test-plugin" is now active!');

  let timeout = null;
  let activeEditor = vscode.window.activeTextEditor;
  let dec = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    overviewRulerColor: 'rgba(255, 0, 0, .6)',
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    light: {
      // this color will be used in light color themes
      after: {
        color: 'darkgrey'
      }
    },
    dark: {
      // this color will be used in dark color themes
      after: {
        color: 'lightgray'
      }
    },
    after: {
      textDecoration: 'font-style: italics;',
      contentText: ' After the row'
    }
  });

  function updateDecorations() {
    if (!activeEditor) {
      return;
    }
    activeEditor.setDecorations(dec, [new vscode.Range(activeEditor.selection.start.line, 0, activeEditor.selection.start.line, 100000000000)]);
  }

  function triggerUpdateDecorations() {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(updateDecorations, 500);
  }

  if (activeEditor) {
    triggerUpdateDecorations();
  }

  vscode.window.onDidChangeActiveTextEditor(editor => {
    activeEditor = editor;
    if (editor) {
      triggerUpdateDecorations();
    }
  }, null, context.subscriptions);

  vscode.workspace.onDidChangeTextDocument(event => {
    if (activeEditor && event.document === activeEditor.document) {
      triggerUpdateDecorations();
    }
  }, null, context.subscriptions);
}