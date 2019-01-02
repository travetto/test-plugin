import * as vscode from 'vscode';
import * as util from 'util';
import * as path from 'path';
import * as fs from 'fs';

import { Workspace } from './workspace';
import { Logger } from './log';

type InstallMap = { [key: string]: boolean };

interface ModuleFeature {
  activate?(): void;
  deactivate?(): void;
}

export class FeatureManager {

  private static _installed: InstallMap;
  private static _features: ModuleFeature[];

  private static async getInstalledLibraries() {
    const modules = await Workspace.readFolder('node_modules', '@travetto'); // All active @travetto module names
    const state = modules.reduce((acc, k) => { // All active @travetto modules in node_modules
      acc[k] = true;
      return acc;
    }, {} as { [key: string]: boolean });

    await Promise.all([vscode.workspace.getConfiguration()
      .update('travetto.modules', state)])
      .catch(err => Logger.error(err));

    return state;
  }

  private static async readFolderModules(...paths: string[]) {
    const entries = await util.promisify(fs.readdir)(path.resolve(__dirname, ...paths));
    return entries
      .filter(x => !x.endsWith('.map'))
      .map(x => x.replace(/[.](j|t)s$/, ''));
  }

  static async verifyInstalled() {
    this._installed = await FeatureManager.getInstalledLibraries();
    return Object.keys(this._installed).length > 0;
  }

  static async init() {
    const featureNames = await FeatureManager.readFolderModules('..', 'feature'); // All matching @travetto plugin features

    const installed = await this._installed;

    const featureList: ModuleFeature[] = []; // All load plugin features
    for (const key of featureNames) {
      if (key in installed) {
        for (const sub of await FeatureManager.readFolderModules('..', 'feature', key)) {
          const res = require(`../feature/${key}/${sub}`);
          if (res) {
            featureList.push(res);
          }
        }
      }
    }
    this._features = featureList;
  }

  static async run(x: 'activate' | 'deactivate', ...args: any[]) {
    if (this._features) {
      this._features
        .filter(mod => !!mod[x])
        .forEach(mod => mod[x]!());
    }
  }
}