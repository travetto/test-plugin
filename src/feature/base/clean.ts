import * as vscode from 'vscode';

import { toLocalFile, fork } from '../../util';

const op = toLocalFile('@travetto/base/bin/travetto-cli-clean.js');

async function clean() {
  await fork(op);
  vscode.window.showInformationMessage('Successfully cleaned the travetto cache');
}

vscode.commands.registerCommand('travetto.base.clean', async config => clean());