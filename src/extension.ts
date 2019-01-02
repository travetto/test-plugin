import * as vscode from 'vscode';

import { Workspace } from './core/workspace';
import { Logger } from './core/log';
import { FeatureManager } from './core/feature';

export async function activate(context: vscode.ExtensionContext) {
  Workspace.init(context);

  if (!(await FeatureManager.verifyInstalled())) {
    return; // Only setup if something installed
  }

  Logger.init();
  Logger.info('Initializing');

  Workspace.initTravetto();

  await FeatureManager.init();

  FeatureManager.run('activate', context);
}

export function deactivate() {
  FeatureManager.run('deactivate');
}