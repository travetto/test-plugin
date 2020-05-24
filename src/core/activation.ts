import * as vscode from 'vscode';
import { ActivationTarget } from './types';


interface ActivationFactory<T extends ActivationTarget = ActivationTarget> {
  init?(namespace: string, sub?: string): Promise<boolean> | boolean;
  new(): T;
}

/**
 * Activation manager
 */
export class ActivationManager {

  static registry = new Set<{ namespace: string, sub?: string, cls: ActivationFactory, instance?: ActivationTarget }>();

  static async init() {
    for (const entry of this.registry.values()) {
      const { namespace, sub, cls } = entry;
      if (!('init' in cls) || (await cls.init!(namespace, sub))) {
        if (sub) {
          await vscode.commands.executeCommand('setContext', namespace, true);
        }

        const key = sub ? `${namespace}/${sub}` : namespace;
        await vscode.commands.executeCommand('setContext', key, true);
        entry.instance = new cls();
      }
    }
  }


  static async activate(ctx: vscode.ExtensionContext) {
    for (const { sub, namespace, instance } of this.registry.values()) {
      instance!.activate?.(ctx);
    }
  }

  static async deactivate() {
    for (const { instance } of this.registry.values()) {
      instance!.deactivate?.();
    }
  }
}

export function Activatible(namespace: string, sub?: string) {
  return (cls: ActivationFactory) => {
    ActivationManager.registry.add({ namespace, sub, cls });
    return;
  }
}