import * as vscode from 'vscode';
import { Workspace } from '../../../core/workspace';
import { AppChoice } from './types';
import { AppSelector } from './select';
import { Activatible } from '../../../core/activation';

/**
 * App run feature
 */
@Activatible('@travetto/app', 'run')
export class AppRunFeature {

  static async init() {
    return Workspace.isInstalled('@travetto/app');
  }

  private selector = new AppSelector(`@travetto/app/bin/lib`)
  private pluginPath = `${Workspace.path}/node_modules/@travetto/app/bin/travetto-plugin-run.js`;

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
      const choice = await this.selector.resolveChoices('Export Application Launch', await this.selector.getValidRecent(10));

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
      const choice = await this.selector.resolveChoices(title, apps);

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
  activate() {
    vscode.commands.registerCommand(`travetto.app.run:new`, async config =>
      this.runApplication('Run New Application', await this.selector.getAppList()));
    vscode.commands.registerCommand(`travetto.app.run:recent`, async config =>
      this.runApplication('Run Recent Application', await this.selector.getValidRecent(10)));
    vscode.commands.registerCommand(`travetto.app.run:mostRecent`, async config =>
      this.runApplication('Run Most Recent Application', (await this.selector.getValidRecent(1))[0]));
    vscode.commands.registerCommand(`travetto.app.run:export`, async config => this.exportLaunchConfig());
  }
}