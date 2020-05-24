import * as vscode from 'vscode';

import { ActivationTarget } from '../core/types';
import { Workspace } from '../core/workspace';
import { ExecUtil } from '@travetto/boot';

// @ts-ignore
export abstract class BaseFeature implements ActivationTarget {

  static isModule = true;

  constructor(
    private module?: string,
    private command?: string
  ) { }

  resolve(...rel: string[]) {
    return Workspace.resolve('node_modules', this.module!, ...rel);
  }

  resolvePlugin(name: string) {
    return this.resolve('bin', `travetto-plugin-${name}.js`);
  }

  async runPlugin(name: string) {
    const { result } = ExecUtil.fork(this.resolvePlugin(name));
    const output = await result;
    return output.stdout;
  }

  register(task: string, handler: () => any) {
    vscode.commands.registerCommand(`${this.module}.${this.command}${task}`, handler);
  }
}