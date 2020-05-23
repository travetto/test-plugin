import * as vscode from 'vscode';
import { AppChoice } from './types';
import { Workspace } from '../../../core/workspace';
import { ParameterSelector } from '../../../core/parameter';

type PickItem = vscode.QuickPickItem & { target: AppChoice };

export class AppSelectorUtil {

  /**
   * Get application details
   * @param app 
   */
  static getAppDetail(app: AppChoice) {
    const detail = [];
    detail.push(app.description);
    if (app.watchable) {
      detail.push('{watch}');
    }
    const out = detail.filter(x => !!x).join(' ').trim();
    return out ? `${'\u00A0'.repeat(4)}${out}` : out;
  }


  /**
   * Get application parameters
   * @param choice 
   */
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

  /**
  * Build quick pick item
  * @param choice 
  */
  static buildQuickPickItem(choice: AppChoice): PickItem | undefined {
    const params = this.getAppParams(choice);
    const detail = choice.key ? undefined : this.getAppDetail(choice);

    return {
      label: `${choice.key ? '' : '$(gear) '}${choice.appRoot && choice.appRoot !== '.' ? `${choice.appRoot}/` : ''}${choice.name}`,
      detail,
      description: params,
      target: choice
    };
  }

  /**
  * Select an app
  * @param title 
  * @param choices 
  */
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



  /**
   * Select application parameters
   * @param choice 
   */
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


  /**
   * Handle application choices
   * @param title 
   * @param choices 
   */
  static async resolveChoices(title: string, choices: AppChoice[] | AppChoice) {
    const choice = Array.isArray(choices) ? (await this.select(title, choices)) : choices;

    if (!choice) {
      return;
    }

    if (!choice.key && choice.params) {
      const inputs = await this.selectParameters(choice);

      if (inputs === undefined) {
        return;
      }

      choice.inputs = inputs;

      return choice;
    }
  }
}