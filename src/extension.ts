import * as vscode from 'vscode';

import { Workspace } from './core/workspace';
import { Logger } from './core/log';
import { FeatureManager } from './core/feature';

export async function activate(context: vscode.ExtensionContext) {
  Workspace.init(context);
  await FeatureManager.init();

  vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('travetto.debug')) {
      Logger.activate();
    }
  });

  Logger.activate();
  Logger.info('Initializing');

  Workspace.initTravetto();

  await FeatureManager.activate(context);
}

export async function deactivate() {
  await FeatureManager.deactivate();
}