import * as vscode from 'vscode';
import { ActivationTarget, ActivationFactory } from './types';
import { Workspace } from './workspace';

/**
 * Activation manager
 */
export class ActivationManager {

  static tracked = new Map<string, ActivationTarget>();
  static registry = new Set<{ namespace: string, sub?: string, cls: ActivationFactory }>();

  static async init() {
    for (const { namespace, sub, cls } of this.registry.values()) {
      if (!('init' in cls) || (await cls.init!())) {
        if (sub) {
          await vscode.commands.executeCommand('setContext', namespace, true);
        }

        const key = sub ? `${namespace}/${sub}` : namespace;
        await vscode.commands.executeCommand('setContext', key, true);
        this.tracked.set(key, new cls());
      }
    }
  }


  static async activate(ctx: vscode.ExtensionContext) {
    for (const f of this.tracked.values()) {
      f.activate?.(ctx);
    }
  }

  static async deactivate() {
    for (const f of this.tracked.values()) {
      f.deactivate?.();
    }
  }
}

export function Activatible(namespace: string, sub?: string) {
  return (cls: ActivationFactory) => {
    ActivationManager.registry.add({ namespace, sub, cls });
    return;
  }
}