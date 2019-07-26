import * as vscode from 'vscode';
import { ParamConfig } from './types';
import { Workspace } from './workspace';

type FullInput = vscode.QuickInput & {
  placeholder?: string;
  value?: string;
  onDidAccept(cb: () => void): void;
};

interface ParamWithMeta {
  param: ParamConfig;
  total: number;
  step: number;
  input?: string;
}

export class ParameterSelector {
  static buildInput<T extends FullInput>(provider: () => T, config: ParamWithMeta): { input: T, run: () => Promise<string> } {
    const qp = provider();
    qp.ignoreFocusOut = true;
    qp.step = config.step;
    qp.totalSteps = config.total;
    qp.value = config.input || (config.param.def !== undefined ? `${config.param.def}` : undefined);
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
    };
  }

  static buildQuickPickList(conf: ParamWithMeta, choices: string[]) {
    const { input: qp, run: subRun } = this.buildInput(vscode.window.createQuickPick, conf);
    qp.title = `Select ${conf.param.title || conf.param.name}`;
    qp.items = choices.map(x => ({ label: x }));
    qp.canSelectMany = false;

    if (qp.value !== undefined && conf.param.type === 'boolean') {
      qp.value = `${qp.value}` === 'true' ? 'yes' : 'no';
    }

    if (qp.value !== undefined) {
      qp.activeItems = qp.items.filter(x => x.label === qp.value);
    }

    qp.value = undefined as any;

    return {
      input: qp,
      run: () => subRun().then(x =>
        x === undefined ? qp.selectedItems[0].label : x)
    };
  }

  static async getFile(conf: ParamWithMeta, root?: string) {
    const res = await vscode.window.showOpenDialog({
      defaultUri: root ? vscode.Uri.file(root) : Workspace.folder.uri,
      openLabel: `Select ${conf.param.title || conf.param.name}`,
      canSelectFiles: true,
      canSelectMany: false
    });
    return res === undefined ? res : res[0].fsPath;
  }

  static async selectParameter(conf: ParamWithMeta) {
    switch (conf.param.type) {
      case 'number': return this.buildInput(vscode.window.createInputBox, conf).run();
      case 'boolean': return this.buildQuickPickList(conf, ['yes', 'no']).run().then(x => `${x === 'yes'}`);

      case 'string':
      default: {
        switch (conf.param.subtype) {
          case 'choice': return this.buildQuickPickList(conf, conf.param.meta.choices).run();
          case 'file': return this.getFile(conf);
          default: return this.buildInput(vscode.window.createInputBox, conf).run();
        }
      }
    }
  }

  static showQuickPick<T extends vscode.QuickPickItem>(title: string, items: T[]) {
    const qp = vscode.window.createQuickPick<T>();
    qp.ignoreFocusOut = true;
    qp.placeholder = 'Select ...';
    qp.title = title;
    qp.items = items;

    return {
      input: qp,
      run: () => {
        qp.show();
        return new Promise<T>((resolve, reject) => {
          qp.onDidAccept(() => resolve(qp.activeItems[0] && qp.activeItems[0]));
        }).then(x => {
          qp.hide();
          qp.dispose();
          return x;
        });
      }
    };
  }
}