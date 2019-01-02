import * as vscode from 'vscode';

import { Workspace } from '../../core/workspace';

const op = Workspace.resolveLibrary('@travetto/base/bin/travetto-cli-clean.js');

async function clean() {
  await Workspace.fork(op);

  const { AppCache } = Workspace.requireLibrary('@travetto/base/src/cache');
  AppCache.cache = {};

  vscode.window.showInformationMessage('Successfully cleaned the travetto cache');
}

vscode.commands.registerCommand('travetto.base.clean', async config => clean());