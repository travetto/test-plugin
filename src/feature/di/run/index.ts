import * as vscode from 'vscode';

import { AppSelector } from './select';
import { AppChoice } from './types';
import { Workspace } from '../../../core/workspace';

async function getChoice(title: string, choices: AppChoice[] | AppChoice) {
  const choice = Array.isArray(choices) ? (await AppSelector.select(title, choices)) : choices;

  if (!choice) {
    return;
  }

  if (!choice.key && choice.params) {
    const inputs = await AppSelector.selectParameters(choice);

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
      ...(process.env.TRV_FRAMEWORK_DEV ? {
        // tslint:disable-next-line:no-invalid-template-strings
        __dirname: '${workspaceFolder}/node_modules/@travetto/di/bin',
        NODE_PRESERVE_SYMLINKS: '1'
      } : {}),
      FORCE_COLOR: 'true'
    }
  });
}

async function exportLaunchConfig() {
  try {
    const choice = await getChoice('Export Application Launch', await AppSelector.getValidRecent(10));

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

async function runApplication(title: string, apps: AppChoice[] | AppChoice) {
  try {
    const choice = await getChoice(title, apps);

    if (!choice) {
      return;
    }

    await vscode.debug.startDebugging(Workspace.folder, getLaunchConfig(choice));
  } catch (e) {
    vscode.window.showErrorMessage(e.message);
  }
}

vscode.commands.registerCommand('travetto.di.run:new', async config =>
  runApplication('Run New Application', await AppSelector.getAppList()));
vscode.commands.registerCommand('travetto.di.run:recent', async config =>
  runApplication('Run Recent Application', await AppSelector.getValidRecent(10)));
vscode.commands.registerCommand('travetto.di.run:mostRecent', async config =>
  runApplication('Run Most Recent Application', (await AppSelector.getValidRecent(1))[0]));
vscode.commands.registerCommand('travetto.di.run:export', async config => exportLaunchConfig());