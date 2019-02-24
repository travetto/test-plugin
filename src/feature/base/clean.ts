import * as vscode from 'vscode';

import { Workspace } from '../../core/workspace';
import { reinitPool } from '../test/test/editor';

const op = Workspace.resolveLibrary('@travetto/base/bin/travetto-plugin-clean.js');

async function clean() {
  await Workspace.fork(op);

  await reinitPool();

  vscode.window.showInformationMessage('Successfully cleaned the travetto cache');
}

vscode.commands.registerCommand('travetto.base.clean', async config => clean());