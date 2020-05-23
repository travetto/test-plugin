import * as vscode from 'vscode';

import { AppSelector } from './select';
import { AppChoice } from './types';
import { Workspace } from '../../../core/workspace';

/**
 * Application launcher
 */
export class AppLauncher {

  constructor(
    private mod: string,
    private pluginPath: string = `${Workspace.path}/node_modules/@travetto/${mod}/bin/travetto-plugin-run.js`,
    private selector: AppSelector = new AppSelector(`@travetto/${mod}/bin/lib`)
  ) {

  }

  /**
   * Handle application choices
   * @param title 
   * @param choices 
   */
  async getChoice(title: string, choices: AppChoice[] | AppChoice) {
    const choice = Array.isArray(choices) ? (await this.selector.select(title, choices)) : choices;

    if (!choice) {
      return;
    }

    if (!choice.key && choice.params) {
      const inputs = await this.selector.selectParameters(choice);

      if (inputs === undefined) {
        return;
      }

      choice.inputs = inputs;
      const key = `${choice.id}#${choice.name}:${choice.inputs.join(',')}`;
      this.selector.storage.set(key, { ...choice, time: Date.now(), key });
    }

    return choice;
  }

  /**
   * Get full launch config
   * @param choice 
   */
  getLaunchConfig(choice: AppChoice) {
    const args = choice.inputs.map(x => `${x}`.replace(Workspace.path, '.')).join(', ');
    const env = Workspace.getDefaultEnv({});

    return Workspace.generateLaunchConfig({
      name: `[Travetto] ${choice.name}${args ? `: ${args}` : ''}`,
      program: this.pluginPath,
      args: [choice.name, ...choice.inputs].map(x => `${x}`),
      env,
      cwd: Workspace.path
    });
  }

  /**
   * Persist config
   */
  async exportLaunchConfig() {
    try {
      const choice = await this.getChoice('Export Application Launch', await this.selector.getValidRecent(10));

      if (!choice) {
        return;
      }

      const config = this.getLaunchConfig(choice);

      const launchConfig = vscode.workspace.getConfiguration('launch');
      const configurations = launchConfig['configurations'];
      configurations.push(config);
      await launchConfig.update('configurations', configurations, false);

      vscode.window.showInformationMessage('Added new configuration to launch.json!');
    } catch (e) {
      vscode.window.showErrorMessage(e.message);
    }
  }

  /**
   * Run the application with the given choices
   * @param title 
   * @param apps 
   */
  async runApplication(title: string, apps: AppChoice[] | AppChoice) {
    try {
      const choice = await this.getChoice(title, apps);

      if (!choice) {
        return;
      }

      await vscode.debug.startDebugging(Workspace.folder, this.getLaunchConfig(choice));
    } catch (e) {
      vscode.window.showErrorMessage(e.message);
    }
  }

  /**
   * Register command handlers
   */
  register() {
    vscode.commands.registerCommand(`travetto.${this.mod}.run:new`, async config =>
      this.runApplication('Run New Application', await this.selector.getAppList()));
    vscode.commands.registerCommand(`travetto.${this.mod}.run:recent`, async config =>
      this.runApplication('Run Recent Application', await this.selector.getValidRecent(10)));
    vscode.commands.registerCommand(`travetto.${this.mod}.run:mostRecent`, async config =>
      this.runApplication('Run Most Recent Application', (await this.selector.getValidRecent(1))[0]));
    vscode.commands.registerCommand(`travetto.${this.mod}.run:export`, async config => this.exportLaunchConfig());
  }
}
