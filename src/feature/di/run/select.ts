import * as vscode from 'vscode';
import { AppChoice, Application } from './types';

import { ActionStorage } from '../../../storage';
import { Util } from '../../../util';

type PickItem = vscode.QuickPickItem & { target: AppChoice };

export class AppSelector {
  static storage = new ActionStorage<AppChoice>('di.run');

  static async getAppList() {
    const { getCachedAppList } = Util.requireLocal('@travetto/di/bin/travetto-find-apps');

    const apps: Application[] = (await getCachedAppList())
      .sort((a, b) => {
        let ae2e = a.filename.includes('e2e');
        let be2e = b.filename.includes('e2e');
        return ae2e === be2e ? a.name.localeCompare(b.name) : (ae2e ? 1 : -1);
      });
    return apps;
  }

  static getAppDetail(app: AppChoice) {
    let detail = [];
    detail.push(app.description);
    if (app.watchable) {
      detail.push('{watch}');
    }
    const env = app.filename.includes('e2e') && 'e2e' || 'dev';
    detail.push(`{${env}}`);
    return detail.filter(x => !!x).join(' ').trim();
  }

  static getAppArgs(choice: AppChoice) {
    let out = (choice.arguments || [])
      .map((x, i) => {
        let val = (choice.args || [])[i] || x.def;
        if (x.type === 'file' && val) {
          val = val.replace(vscode.workspace.workspaceFolders[0].uri.fsPath, '.')
        }
        return val ? `${x.name}=${val}` : x.name;
      })
      .join(', ');
    return out;
  }

  static buildQuickPickItem(choice: AppChoice): PickItem {
    try {
      const args = this.getAppArgs(choice);
      const detail = this.getAppDetail(choice);

      return {
        label: choice.key ? `[R] ${choice.name}` : `${choice.name}`,
        detail: detail,
        description: args,
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

  static async select() {
    const appList = await this.getAppList();

    const top: AppChoice[] = this.storage.getRecent(10)
      .map(x => (x.key = x.key || x.name) && x)
      .filter(x => {
        const res = appList.find(a => a.id === x.id && a.name === x.name);
        if (!res) {
          this.storage.set(x.key);
        }
        return res;
      })
      .slice(0, 3);

    const items = top.concat(appList)
      .map(x => this.buildQuickPickItem(x)).filter(x => !!x)

    const app = await vscode.window.showQuickPick(items, {
      placeHolder: 'Run application...'
    });

    return app && app.target;
  }
}
