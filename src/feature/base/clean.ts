import * as vscode from 'vscode';

import { Util } from '../../util';

const op = Util.toLocalFile('@travetto/base/bin/travetto-cli-clean.js');

async function clean() {
  await Util.fork(op);
  vscode.window.showInformationMessage('Successfully cleaned the travetto cache');
}

vscode.commands.registerCommand('travetto.base.clean', async config => clean());