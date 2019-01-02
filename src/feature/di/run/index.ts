import * as vscode from 'vscode';

import { AppSelector } from './select';
import { ParameterSelector } from './parameter';
import { AppChoice } from './types';
import { Workspace } from '../../../core/workspace';

const { Env } = Workspace.requireLibrary('@travetto/base/src/env');

async function getChoice(title: string) {
  const choice = await AppSelector.select(title);

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

function getLaunchConfig(choice: AppChoice) {
  const args = choice.inputs.map(x => `${x}`.replace(Workspace.path, '.')).join(', ');
  return Workspace.generateLaunchConfig({
    name: `[Travetto] ${choice.name}${args ? `: ${args}` : ''}`,
    // tslint:disable-next-line:no-invalid-template-strings
    program: '${workspaceFolder}/node_modules/@travetto/di/bin/travetto-cli-run.js',
    args: [choice.name, ...choice.inputs].map(x => `${x}`),
    env: {
      NODE_PRESERVE_SYMLINKS: `${Env.frameworkDev ? 1 : 0}`,
      ENV: choice.filename.includes('e2e') ? 'e2e' : '',
      WATCH: `${choice.watchable}`,
      FORCE_COLOR: 'true'
    }
  });
}

async function exportLaunchConfig() {
  try {
    const choice = await getChoice('Export Application Launch');

    if (!choice) {
      return;
    }

    const config = getLaunchConfig(choice);

    const launchConfig = vscode.workspace.getConfiguration('launch');
    const configurations = launchConfig['configurations'];
    configurations.push(config);
    await launchConfig.update('configurations', configurations, false);

    vscode.window.showInformationMessage('Added new configuration to launch.json!');
  } catch (e) {
    vscode.window.showErrorMessage(e.message);
  }
}

async function runApplication() {
  try {
    const choice = await getChoice('Run Application');

    if (!choice) {
      return;
    }

    await vscode.debug.startDebugging(Workspace.folder, getLaunchConfig(choice));
  } catch (e) {
    vscode.window.showErrorMessage(e.message);
  }
}

vscode.commands.registerCommand('travetto.di.run', async config => runApplication());
vscode.commands.registerCommand('travetto.di.run:export', async config => exportLaunchConfig());