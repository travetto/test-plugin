import * as vscode from 'vscode';

import { Workspace } from './core/workspace';
import { Logger } from './core/log';
import { FeatureManager } from './core/feature';

export async function activate(context: vscode.ExtensionContext) {
  Workspace.init(context);

  Logger.init();
  Logger.info('Initializing');

  Workspace.initTravetto();

  await FeatureManager.run('activate', context);
}

export async function deactivate() {
  await FeatureManager.run('deactivate');
}