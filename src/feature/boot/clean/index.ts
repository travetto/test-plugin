import * as vscode from 'vscode';
import { ExecUtil } from '@travetto/boot';

import { Workspace } from '../../../core/workspace';
import { Feature } from '../../../core/feature';

/**
 * Clean workspace
 */
@Feature('@travetto/boot', 'clean')
export class CleanFeature {
  private plugin = Workspace.resolve('node_modules', '@travetto/boot', 'bin/travetto-plugin-clean.js');

  module = '@travetto/boot';
  command = 'clean';

  async clean() {
    await ExecUtil.fork(this.plugin);
    vscode.window.showInformationMessage('Successfully deleted');
  }

  /**
   * On initial activation
   */
  activate() {
    vscode.commands.registerCommand('travetto.boot.clean', async () => this.clean());
  }
}