import * as vscode from 'vscode';
import { ScanFs, FsUtil } from '@travetto/boot';
import { Workspace } from './workspace';

/**
 * Feature manager
 */
export class FeatureManager {

  static async run(x: 'activate' | 'deactivate', ...args: any[]) {
    const features = (await ScanFs.scanDir(
      { testDir: d => /^[a-z]+(\/[a-z]+)?/.test(d) },
      FsUtil.resolveUnix(__dirname, '..', 'feature')
    )).map(x => {
      const [mod, cmd] = x.module.split('/');
      return { mod, cmd, file: x.file };
    });

    for (const { mod, cmd, file } of features) {
      if (await FsUtil.exists(Workspace.resolveLibrary(`@travetto/${mod}`))) {
        await vscode.commands.executeCommand('setContext', `@travetto/${mod}`, x === 'activate');
        try {
          const feature = require(file);
          if (x in feature) {
            await feature[x]!();
          }
          continue;
        } catch { }
      }
      await vscode.commands.executeCommand('setContext', `@travetto/${mod}`, false);
    }
  }
}