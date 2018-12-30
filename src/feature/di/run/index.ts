import * as vscode from 'vscode';

import { Util } from '../../../util';
import { AppSelector } from './select';
import { ParameterSelector } from './parameter';

const { Env } = Util.requireLocal('@travetto/base/src/env');

async function getChoice() {
  const choice = await AppSelector.select();

  if (!choice) {
    return;
  }

  if (!choice.key && choice.params) {
    const inputs = await ParameterSelector.select(choice);

    if (inputs === undefined) {
      return;
    }

    choice.inputs = inputs;
    const key = `${choice.id}#${choice.name}:${choice.inputs.join(',')}`;
    AppSelector.storage.set(key, { ...choice, time: Date.now(), key });
  }

  return choice;
}


async function runApplication() {

  try {
    const choice = await getChoice();

    if (!choice) {
      return;
    }

    await Util.debugSession({
      name: `Debug Travetto Application: ${choice.name}`,
      program: '${workspaceFolder}/node_modules/@travetto/di/bin/travetto-cli-run.js',
      args: [choice.name, ...choice.inputs].map(x => `${x}`),
      env: {
        NODE_PRESERVE_SYMLINKS: Env.frameworkDev ? 1 : 0,
        ENV: choice.filename.includes('e2e') ? 'e2e' : '',
        WATCH: choice.watchable,
        FORCE_COLOR: true
      }
    });
  } catch (e) {
    vscode.window.showErrorMessage(e.message);
  }
}

vscode.commands.registerCommand('travetto.di.run', async config => runApplication());