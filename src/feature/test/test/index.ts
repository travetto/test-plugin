import * as vscode from 'vscode';
import * as path from 'path';

import { Workspace } from '../../../core/workspace';
import { TestRunner } from './runner';
import { Activatible } from '../../../core/activation';
import { BaseFeature } from '../../base';

/**
 * Test Runner Feature
 */
@Activatible('@travetto/test', 'test')
class TestRunnerFeature extends BaseFeature {

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
   * Launch a test from the current location
   * @param addBreakpoint 
   */
  async launchTests(addBreakpoint: boolean = false) {

    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      throw new Error('No editor for tests');
    }

    if (editor.document && /@Test\(/.test(editor.document.getText() || '')) {
      const line = editor.selection.start.line + 1;

      if (addBreakpoint) {
        const uri = editor.document.uri;
        const pos = new vscode.Position(line - 1, 0);
        const loc = new vscode.Location(uri, pos);
        const breakpoint = new vscode.SourceBreakpoint(loc, true);
        vscode.debug.addBreakpoints([breakpoint]);

        const remove = vscode.debug.onDidTerminateDebugSession(e => {
          vscode.debug.removeBreakpoints([breakpoint]);
          remove.dispose();
        });
      }

      const env: { [key: string]: any } = {
        ...Workspace.getDefaultEnv({ DEBUG: '1' })
      };

      return await vscode.debug.startDebugging(Workspace.folder, Workspace.generateLaunchConfig({
        name: 'Debug Travetto',
        program: this.resolvePlugin('test'),
        args: [
          `${editor.document.fileName.replace(`${Workspace.path}${path.sep}`, '')}`,
          `${line}`
        ].filter(x => x !== ''),
        env
      }));
    }
  }

  /**
   * On feature activate
   */
  async activate(context: vscode.ExtensionContext) {
    this.register('all', () => this.launchTests());
    this.register('line', () => this.launchTests(true));
    this.register('rerun', () => this.onDocumentUpdate(vscode.window.activeTextEditor, 0));

    vscode.workspace.onDidOpenTextDocument(x => this.onDocumentUpdate(x, 0), null, context.subscriptions);
    vscode.workspace.onDidCloseTextDocument(x => this.onDocumentClose(x), null, context.subscriptions);
    vscode.window.onDidChangeActiveTextEditor(x => this.onDocumentUpdate(x), null, context.subscriptions);

    setTimeout(() => vscode.window.visibleTextEditors.forEach(x => this.onDocumentUpdate(x, 0)), 1000);

    await this.runner.init();
  }

  /**
   * On feature deactivate
   */
  async deactivate() {
    await this.runner.destroy(false);
  }
}