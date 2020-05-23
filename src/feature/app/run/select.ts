import { AppChoice } from './types';

import { ActionStorage } from '../../../core/storage';
import { Workspace } from '../../../core/workspace';
import { AppSelectorUtil } from './util';

/**
 * Application selector
 */
export class AppSelector {

  storage = new ActionStorage<AppChoice>('app.run');

  constructor(private libPath: string) { }

  /**
   * Get list of applications
   */
  async getAppList() {
    const { getAppList } = require(this.libPath);

    return getAppList(false) as Promise<AppChoice[]>;
  }

  /**
   * Find list of recent choices, that are valid
   * @param count 
   */
  async getValidRecent(count: number): Promise<AppChoice[]> {
    const appList = await this.getAppList();

    return this.storage.getRecentAndFilterState(count * 2, x =>
      appList.some(a => a.id === x.id && a.name === x.name)
    ).slice(0, count);
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
}
