import * as vscode from 'vscode';
import { launchTests } from './launch';
import { Workspace } from '../../../core/workspace';
import { TestRunner } from './runner';
import { Activatible } from '../../../core/activation';

/**
 * Test Runner Feature
 */
@Activatible('@travetto/test', 'test')
class TestRunnerFeature {

  static async init() {
    return Workspace.isInstalled('@travetto/test');
  }

  private runner = new TestRunner(vscode.window);

  /**
   * On document update, track for results
   * @param editor 
   * @param line 
   */
  onDocumentUpdate(editor?: vscode.TextEditor | vscode.TextDocument, line?: number) {
    if (!editor) {
      return;
    }

    editor = !Workspace.isEditor(editor) ? Workspace.getEditor(editor) : editor;

    if (!editor) {
      return;
    }

    console.log('Document updated', editor.document.fileName);

    if (editor.document) {
      const results = this.runner.getResults(editor.document);
      results?.addEditor(editor);
    }
  }

  /**
   * On Document close, stop listening
   */
  onDocumentClose(doc: vscode.TextDocument) {
    const gone = vscode.workspace.textDocuments.find(d => d.fileName === doc.fileName);
    if (gone) {
      this.runner.close(gone);
    }
  }

  /**
   * On feature activate
   */
  async activate() {
    vscode.commands.registerCommand('travetto.test.test:all', async config => launchTests());
    vscode.commands.registerCommand('travetto.test.test:line', async config => launchTests(true));
    vscode.commands.registerCommand('travetto.test.test:rerun', async config => this.onDocumentUpdate(vscode.window.activeTextEditor, 0));

    vscode.workspace.onDidOpenTextDocument(x => this.onDocumentUpdate(x, 0), null, Workspace.context.subscriptions);
    vscode.workspace.onDidCloseTextDocument(x => this.onDocumentClose(x), null, Workspace.context.subscriptions);
    vscode.window.onDidChangeActiveTextEditor(x => this.onDocumentUpdate(x), null, Workspace.context.subscriptions);

    // vscode.window.onDidChangeVisibleTextEditors(eds => eds.forEach(x => onDocumentUpdate(x, 0)), null, context.subscriptions);
    setTimeout(() => vscode.window.visibleTextEditors.forEach(x => this.onDocumentUpdate(x, 0)), 1000);

    await this.runner.init();
  }

  /**
   * On feature deactivate
   */
  async deactivate() {
    await this.runner.destroy(false);
  }

  /**
   * Handle reinit
   */
  async reinit() {
    this.runner.reinit();
  }
}