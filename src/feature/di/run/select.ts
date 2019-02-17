import * as vscode from 'vscode';
import { AppChoice } from './types';

import { ActionStorage } from '../../../core/storage';
import { Workspace } from '../../../core/workspace';
import { ParameterSelector } from '../../../core/parameter';

type PickItem = vscode.QuickPickItem & { target: AppChoice };

export class AppSelector {
  static storage = new ActionStorage<AppChoice>('di.run');

  static async getAppList() {
    const { getCachedAppList } = Workspace.requireLibrary('@travetto/di/bin/travetto-find-apps');

    return getCachedAppList() as Promise<AppChoice[]>;
  }

  static getAppDetail(app: AppChoice) {
    const detail = [];
    detail.push(app.description);
    if (app.watchable) {
      detail.push('{watch}');
    }
    const out = detail.filter(x => !!x).join(' ').trim();
    return out ? `${'\u00A0'.repeat(4)}${out}` : out;
  }

  static getAppParams(choice: AppChoice) {
    const out = choice.params
      .map((x, i) => {
        let val = choice.inputs[i] !== undefined ? choice.inputs[i] : (x.meta && x.meta.choices ? x.meta.choices.join(',') : x.def);
        if (x.subtype === 'file' && val) {
          val = val.replace(Workspace.path, '.');
        }
        return `${x.title || x.name}${val !== undefined ? `=${val}` : ''}`;
      })
      .join(', ');
    return out;
  }

  static buildQuickPickItem(choice: AppChoice): PickItem | undefined {
    try {
      const params = this.getAppParams(choice);
      const detail = choice.key ? undefined : this.getAppDetail(choice);

      return {
        label: `${choice.key ? '' : '$(gear) '}${choice.appRoot ? `${choice.appRoot}/` : ''}${choice.name}`,
        detail,
        description: params,
        target: choice
      };
    } catch (e) {
      if (choice.key) {
        this.storage.set(choice.key);
      } else {
        throw e;
      }
    }
  }

  static async getValidRecent(count: number): Promise<AppChoice[]> {
    const appList = await this.getAppList();

    return this.storage.getRecent(10)
      .map(x => {
        x.key = x.key || x.name;
        return x;
      })
      .filter(x => {
        const res = appList.find(a => a.id === x.id && a.name === x.name);
        if (!res) {
          this.storage.set(x.key!);
        }
        return res;
      })
      .slice(0, count);
  }

  static async select(title: string, choices: AppChoice[]) {
    const items = choices
      .map(x => {
        x.inputs = x.inputs || [];
        x.params = x.params || [];
        return x;
      })
      .map(x => this.buildQuickPickItem(x))
      .filter(x => !!x) as PickItem[];

    const res = await ParameterSelector.showQuickPick(title, items).run();
    return res && res.target;
  }

  static async selectParameters(choice: AppChoice): Promise<string[] | undefined> {
    const all = choice.params;
    const selected = [];

    for (let i = 0; i < all.length; i++) {
      const param = all[i];
      const res = await ParameterSelector.selectParameter({
        param,
        total: all.length,
        step: i + 1,
        input: choice.inputs[i]
      });

      if (res === undefined) {
        if (param.optional) {
          selected.push('');
        } else {
          return undefined;
        }
      } else {
        selected.push(res);
      }
    }

    if (selected.length < all.length) {
      throw new Error(`Missing arguments for ${choice.name}`);
    }

    return selected;
  }
}
