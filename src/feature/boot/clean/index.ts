import * as vscode from 'vscode';
import { ExecUtil } from '@travetto/boot';

import { Workspace } from '../../../core/workspace';
import { Activatible } from '../../../core/activation';

/**
 * Clean workspace
 */
@Activatible('@travetto/boot', 'clean')
export class CleanFeature {

  static async init() {
    return Workspace.isInstalled('@travetto/boot');
  }

  private plugin = Workspace.resolve('node_modules', '@travetto/boot', 'bin/travetto-plugin-clean.js');

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