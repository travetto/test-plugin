import * as vscode from 'vscode';
import { AppChoice } from './types';

import { ActionStorage } from '../../../core/storage';
import { Workspace } from '../../../core/workspace';

type PickItem = vscode.QuickPickItem & { target: AppChoice };

export class AppSelector {
  static storage = new ActionStorage<AppChoice>('di.run');

  static async getAppList() {
    const { getCachedAppList } = Workspace.requireLibrary('@travetto/di/bin/travetto-find-apps');

    const apps = (await (getCachedAppList() as Promise<AppChoice[]>))
      .sort((a, b) => {
        const ae2e = a.filename.includes('e2e');
        const be2e = b.filename.includes('e2e');
        return ae2e === be2e ? a.name.localeCompare(b.name) : (ae2e ? 1 : -1);
      });
    return apps;
  }

  static getAppDetail(app: AppChoice) {
    const detail = [];
    detail.push(app.description);
    if (app.watchable) {
      detail.push('{watch}');
    }
    const env = app.filename.includes('e2e') && 'e2e' || 'dev';
    detail.push(`{${env}}`);
    const out = detail.filter(x => !!x).join(' ').trim();
    return out ? `${'\u00A0'.repeat(4)}${out}` : out;
  }

  static getAppParams(choice: AppChoice) {
    const out = choice.params
      .map((x, i) => {
        let val = choice.inputs[i] || x.def;
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
      const detail = this.getAppDetail(choice);

      return {
        label: `${choice.key ? '$(zap)' : '$(gear)'} ${choice.name}`,
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

  static showQuickPick(title: string, items: PickItem[]) {
    const qp = vscode.window.createQuickPick<PickItem>();
    qp.ignoreFocusOut = true;
    qp.placeholder = 'Select ...';
    qp.title = title;
    qp.items = items;

    return {
      input: qp,
      run: () => {
        qp.show();
        return new Promise<AppChoice>((resolve, reject) => {
          qp.onDidAccept(() => resolve(qp.activeItems[0] && qp.activeItems[0].target));
        }).then(x => {
          qp.hide();
          qp.dispose();
          return x;
        });
      }
    };
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

  static async select(title: string) {
    const appList = await this.getAppList();
    const top = await this.getValidRecent(3);

    const items = top.concat(appList)
      .map(x => {
        x.inputs = x.inputs || [];
        x.params = x.params || [];
        return x;
      })
      .map(x => this.buildQuickPickItem(x))
      .filter(x => !!x) as PickItem[];

    return this.showQuickPick(title, items).run();
  }
}