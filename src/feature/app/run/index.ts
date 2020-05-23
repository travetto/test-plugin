import * as vscode from 'vscode';
import { ExecUtil } from '@travetto/boot';

import { Workspace } from '../../../core/workspace';
import { Activatible } from '../../../core/activation';
import { ActionStorage } from '../../../core/storage';

import { AppChoice } from './types';
import { AppSelectorUtil } from './util';

/**
 * App run feature
 */
@Activatible('@travetto/app', 'run')
export class AppRunFeature {

  static async init() {
    return Workspace.isInstalled('@travetto/app');
  }

  private listPluginPath = Workspace.resolve('node_modules', `@travetto/app/bin/travetto-plugin-list.js`)
  private runPluginPath = Workspace.resolve('node_modules', '@travetto/app/bin/travetto-plugin-run.js');
  private storage = new ActionStorage<AppChoice>('app.run', Workspace.path);

  /**
   * Get list of applications
   */
  async getAppList() {
    const { result } = ExecUtil.fork(this.listPluginPath);
    const output = await result;
    return JSON.parse(output.stdout) as AppChoice[];
  }

  /**
   * Find list of recent choices, that are valid
   * @param count 
   */
  async getValidRecent(count: number): Promise<AppChoice[]> {
    const appList = await this.getAppList();

    return this.storage.getRecentAndFilterState(count * 2, x =>
      appList.some(a => a.id === x.id && a.name === x.name)
    )
      .map(x => x.data)
      .slice(0, count);
  }

  /**
   * Handle application choices
   * @param title 
   * @param choices 
   */
  async resolveChoices(title: string, choices: AppChoice[] | AppChoice) {
    const choice = await AppSelectorUtil.resolveChoices(title, choices);
    if (choice) {
      const key = `${choice.id}#${choice.name}:${choice.inputs.join(',')}`;
      this.storage.set(key, { ...choice, time: Date.now(), key });
      return choice;
    }
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
      program: this.runPluginPath,
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
      const choice = await this.resolveChoices('Export Application Launch', await this.getValidRecent(10));

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
      const choice = await this.resolveChoices(title, apps);

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
    const reg = vscode.commands.registerCommand.bind(vscode.commands);
    reg(`travetto.app.run:new`, async () => this.runApplication('Run New Application', await this.getAppList()));
    reg(`travetto.app.run:recent`, async () => this.runApplication('Run Recent Application', await this.getValidRecent(10)));
    reg(`travetto.app.run:mostRecent`, async () => this.runApplication('Run Most Recent Application', (await this.getValidRecent(1))[0]));
    reg(`travetto.app.run:export`, async () => this.exportLaunchConfig());
  }
}