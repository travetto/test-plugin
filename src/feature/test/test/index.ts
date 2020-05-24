import * as vscode from 'vscode';
import * as path from 'path';

import { Workspace } from '../../../core/workspace';
import { TestConsumer } from './consumer';
import { Activatible } from '../../../core/activation';
import { BaseFeature } from '../../base';
import { FsUtil, ExecutionState, ExecUtil } from '@travetto/boot';

/**
 * Test Runner Feature
 */
@Activatible('@travetto/test', 'test')
class TestRunnerFeature extends BaseFeature {

  private consumer = new TestConsumer(vscode.window);
  private runner: ExecutionState;
  private running = true;
  private cacheDir = `${Workspace.path}/.trv_cache_test`;

  /**
   * On document update, track for results
   * @param editor 
   * @param line 
   */
  onDocumentUpdate(editor?: vscode.TextEditor | vscode.TextDocument, line?: number) {
    editor = Workspace.getDocumentEditor(editor);
    if (editor) {
      const results = this.consumer.getResults(editor.document);
      results?.addEditor(editor);
    }
  }

  /**
   * On Document close, stop listening
   */
  onDocumentClose(doc: vscode.TextDocument) {
    const closing = vscode.workspace.textDocuments.find(d => d.fileName === doc.fileName);
    if (closing) {
      this.consumer.close(closing);
    }
  }

  /**
   * Launch a test from the current location
   * @param addBreakpoint 
   */
  async launchTestDebugger(addBreakpoint: boolean = false) {

    const editor = Workspace.getDocumentEditor(vscode.window.activeTextEditor);

    if (editor && /@Test\(/.test(editor.document.getText() || '')) {
      const line = editor.selection.start.line + 1;

      if (addBreakpoint) {
        Workspace.addBreakpoint(editor, line);
      }

      return await vscode.debug.startDebugging(Workspace.folder, Workspace.generateLaunchConfig({
        name: 'Debug Travetto',
        program: this.resolvePlugin('test'),
        args: [
          `${editor.document.fileName.replace(`${Workspace.path}${path.sep}`, '')}`,
          `${line}`
        ].filter(x => x !== ''),
        env: Workspace.getDefaultEnv({ DEBUG: '1' })
      }));
    }
  }

  async launchTestServer() {
    FsUtil.copyRecursiveSync(`${Workspace.path}/.trv_cache`, this.cacheDir, true);

    this.runner = ExecUtil.fork(this.resolvePlugin('watch-test'), ['exec'], {
      env: { TRV_CACHE: this.cacheDir, },
      cwd: Workspace.path
    });

    this.runner.process.stdout?.pipe(process.stdout);
    this.runner.process.stderr?.pipe(process.stderr);

    this.runner.result.finally(() => {
      if (this.running) { // If still running, reinit
        this.killTestServer(true);
        FsUtil.unlinkRecursiveSync(this.cacheDir);
        this.launchTestServer();
      }
    });

    this.runner.process.addListener('message', ev => this.consumer.onEvent(ev as any));
  }

  /**
   * Stop runner
   */
  async killTestServer(running: boolean) {
    console.debug('Test', 'Shutting down');
    this.running = running;
    if (this.runner && this.runner.process && !this.runner.process.killed) {
      this.runner.process.kill();
    }
    // Remove all state
    this.consumer.dispose();
  }


  /**
   * On feature activate
   */
  async activate(context: vscode.ExtensionContext) {
    this.register('all', () => this.launchTestDebugger());
    this.register('line', () => this.launchTestDebugger(true));
    this.register('rerun', () => this.onDocumentUpdate(vscode.window.activeTextEditor, 0));

    vscode.workspace.onDidOpenTextDocument(x => this.onDocumentUpdate(x, 0), null, context.subscriptions);
    vscode.workspace.onDidCloseTextDocument(x => this.onDocumentClose(x), null, context.subscriptions);
    vscode.window.onDidChangeActiveTextEditor(x => this.onDocumentUpdate(x), null, context.subscriptions);

    setTimeout(() => vscode.window.visibleTextEditors.forEach(x => this.onDocumentUpdate(x, 0)), 1000);

    await this.launchTestServer();
  }

  /**
   * On feature deactivate
   */
  async deactivate() {
    await this.killTestServer(false);
  }
}