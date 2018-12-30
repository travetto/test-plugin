import * as vscode from 'vscode';
import { ApplicationArgument, AppChoice } from './types';

type FullInput = vscode.QuickInput & {
  placeholder: string;
  value: string,
  onDidAccept(cb: () => void): void
}
interface ArgumentConfig {
  arg: ApplicationArgument;
  total: number;
  step: number;
  prev?: string;
}

export class ArgumentSelector {
  static buildInput<T extends FullInput>(provider: () => T, config: ArgumentConfig): { input: T, run: () => Promise<string> } {
    const qp = provider();
    qp.ignoreFocusOut = true;
    qp.step = config.step;
    qp.totalSteps = config.total;
    qp.value = config.prev || config.arg.def;
    qp.placeholder = qp.title;
    qp.title = `Enter value for ${config.arg.name}`;

    return {
      input: qp,
      run: () => {
        qp.show();
        return new Promise<string>((resolve, reject) => {
          qp.onDidAccept(() => resolve(qp.value));
        }).then(x => {
          qp.hide();
          qp.dispose();
          return x;
        });
      }
    }
  }

  static async selectArgument(conf: ArgumentConfig) {
    switch (conf.arg.type) {
      case 'choice': {
        const { input: qp, run } = this.buildInput(vscode.window.createQuickPick, conf);
        qp.title = `Select ${conf.arg.name}`;
        qp.items = conf.arg.meta.map(x => ({ label: x }));
        qp.canSelectMany = false;

        if (qp.value) {
          qp.activeItems = qp.items.filter(x => x.label === qp.value);
        }

        qp.value = undefined;

        return run().then(x => {
          if (x === undefined) {
            return qp.selectedItems[0].label;
          }
        });
      }
      case 'number':
      case 'int':
      case 'long': {
        const { input: ib, run } = this.buildInput(vscode.window.createInputBox, conf);
        return run();
      }
      case 'file': {
        const res = await vscode.window.showOpenDialog({
          defaultUri: vscode.workspace.workspaceFolders[0].uri,
          openLabel: `Find file for ${conf.arg.name}`,
          canSelectFiles: true,
          canSelectMany: false
        });
        return res[0].fsPath;
      }
      case 'string':
      case 'text':
      default: {
        const { input: ib, run } = this.buildInput(vscode.window.createInputBox, conf);
        return run();
      }
    }
  }

  static async select(choice: AppChoice): Promise<string[] | undefined> {
    const all = (choice.arguments || []);
    const selected = [];

    for (let i = 0; i < all.length; i++) {
      const arg = all[i];
      const res = await this.selectArgument({
        arg,
        total: all.length,
        step: i + 1,
        prev: (choice.args || [])[i]
      });

      if (res === undefined) {
        return undefined;
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