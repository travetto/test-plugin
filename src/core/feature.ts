import * as vscode from 'vscode';
import { FsUtil } from '@travetto/boot';
import { Workspace } from './workspace';
import { ModuleFeature } from './types';

/**
 * Feature manager
 */
export class FeatureManager {

  static features = new Map<string, ModuleFeature>();
  static registry = new Set<{ module: string, command: string, cls: { new(): ModuleFeature } }>();

  static async init() {
    await import('../feature/index');
    for (const { module, command, cls } of this.registry.values()) {
      if (await FsUtil.exists(Workspace.resolve('node_modules', module))) {
        await vscode.commands.executeCommand('setContext', module, true);
        await vscode.commands.executeCommand('setContext', `${module}/${command}`, true);
        try {
          const feat = new cls();
          await this.features.set(`${module}/${command}`, feat);
        } catch { }
      }
    }
  }


  static async activate(ctx: vscode.ExtensionContext) {
    for (const f of this.features.values()) {
      f.activate?.(ctx);
    }
  }

  static async deactivate(ctx?: vscode.ExtensionContext) {
    for (const f of this.features.values()) {
      f.deactivate?.();
    }
  }
}

export function Feature(module: string, command: string) {
  return <T extends ModuleFeature>(cls: { new(): T }) => {
    FeatureManager.registry.add({ module, command, cls });
    return;
  }
}