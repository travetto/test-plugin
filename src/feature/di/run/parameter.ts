import * as vscode from 'vscode';
import { ApplicationParam, AppChoice } from './types';

type FullInput = vscode.QuickInput & {
  placeholder: string;
  value: string,
  onDidAccept(cb: () => void): void
}
interface ParamConfig {
  param: ApplicationParam;
  total: number;
  step: number;
  input?: string;
}

export class ParameterSelector {
  static buildInput<T extends FullInput>(provider: () => T, config: ParamConfig): { input: T, run: () => Promise<string> } {
    const qp = provider();
    qp.ignoreFocusOut = true;
    qp.step = config.step;
    qp.totalSteps = config.total;
    qp.value = config.input || config.param.def;
    qp.placeholder = qp.title;
    qp.title = `Enter value for ${config.param.title || config.param.name}`;

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

  static buildQuickPickList(conf: ParamConfig, choices: string[]) {
    const { input: qp, run: subRun } = this.buildInput(vscode.window.createQuickPick, conf);
    qp.title = `Select ${conf.param.title || conf.param.name}`;
    qp.items = choices.map(x => ({ label: x }));
    qp.canSelectMany = false;

    if (qp.value) {
      qp.activeItems = qp.items.filter(x => x.label === qp.value);
    }

    qp.value = undefined;

    return {
      input: qp,
      run: () => subRun().then(x =>
        x === undefined ? qp.selectedItems[0].label : x)
    }
  }

  static async getFile(conf: ParamConfig, root?: string) {
    const res = await vscode.window.showOpenDialog({
      defaultUri: root ? vscode.Uri.file(root) : vscode.workspace.workspaceFolders[0].uri,
      openLabel: `Select ${conf.param.title || conf.param.name}`,
      canSelectFiles: true,
      canSelectMany: false
    });
    return res === undefined ? res : res[0].fsPath;
  }

  static async selectParameter(conf: ParamConfig) {
    switch (conf.param.type) {
      case 'number': return this.buildInput(vscode.window.createInputBox, conf).run();
      case 'boolean': return this.buildQuickPickList(conf, ['yes', 'no']).run().then(x => x === 'yes');

      case 'string':
      default: {
        switch (conf.param.subtype) {
          case 'choice': return this.buildQuickPickList(conf, conf.param.meta.choices).run()
          case 'file': return this.getFile(conf);
          default: return this.buildInput(vscode.window.createInputBox, conf).run();
        }
      }
    }
  }

  static async select(choice: AppChoice): Promise<string[] | undefined> {
    const all = choice.params;
    const selected = [];

    for (let i = 0; i < all.length; i++) {
      const param = all[i];
      const res = await this.selectParameter({
        param,
        total: all.length,
        step: i + 1,
        input: choice.inputs[i]
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