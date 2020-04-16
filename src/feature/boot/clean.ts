import * as vscode from 'vscode';

import { Workspace } from '../../core/workspace';
import { reinit } from '../test/test/editor';

const op = Workspace.resolveLibrary('@travetto/boot/bin/travetto-plugin-clean.js');

async function clean() {
  const res = await Workspace.fork(op);

  await Workspace.reinitTravetto();

  await reinit();

  vscode.window.showInformationMessage('Successfully deleted');
}

vscode.commands.registerCommand('travetto.boot.clean', async config => clean());