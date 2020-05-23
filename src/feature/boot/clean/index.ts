import * as vscode from 'vscode';
import { ExecUtil } from '@travetto/boot';

import { Workspace } from '../../../core/workspace';
import { reinit } from '../../test/test/editor';

async function clean() {
  const op = Workspace.resolveLibrary('@travetto/boot/bin/travetto-plugin-clean.js');
  await ExecUtil.fork(op);

  await Workspace.reinitTravetto();
  await reinit();

  vscode.window.showInformationMessage('Successfully deleted');
}

vscode.commands.registerCommand('travetto.boot.clean', async config => clean());