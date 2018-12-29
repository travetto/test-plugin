import * as vscode from 'vscode';

import { CWD, requireLocal } from '../../util';

const { Env } = requireLocal('@travetto/base/src/env');

interface Application {
  name: string;
  filename: string;
  id: string;
  description?: string;
  watchable?: boolean;
  env: string;
}

async function selectApp(): Promise<Application> {
  try {
    const { getCachedAppList } = requireLocal('@travetto/di/bin/travetto-find-apps');

    const appList = await getCachedAppList();
    const app = await vscode.window.showQuickPick<{ label: string, target: Application }>(
      appList.map(app => {
        let detail = [];
        if (app.watchable) {
          detail.push('Watchable');
        }
        const env = app.filename.includes('e2e') && 'e2e' || 'dev';
        detail.push(`Environment: ${env}`);

        return {
          label: app.name,
          detail: detail.join(', ').trim(),
          description: app.description,
          target: app
        };
      }),
      {
        placeHolder: 'Run application...',
      }
    );
    return app && app.target;
  } catch (e) {
    vscode.window.showErrorMessage(e.message);
    throw e;
  }
}

async function runApplication() {

  const app = await selectApp();

  if (!app) {
    return;
  }

  const env: { [key: string]: any } = {};

  if (Env.frameworkDev) {
    env.NODE_PRESERVE_SYMLINKS = 1;
  }

  if (app.filename.includes('e2e')) {
    env.ENV = 'e2e';
  }

  await vscode.debug.startDebugging(vscode.workspace.workspaceFolders[0], {
    type: 'node',
    request: 'launch',
    protocol: 'inspector',
    env,
    cwd: CWD,
    name: `Debug Travetto Application: ${app.name}`,
    // tslint:disable-next-line:no-invalid-template-strings
    program: '${workspaceFolder}/node_modules/@travetto/di/bin/travetto-cli-run.js',
    stopOnEntry: false,
    sourceMaps: true,
    runtimeArgs: [
      '--nolazy'
    ],
    skipFiles: [
      '<node_internals>/**',
      '**/@travetto/context/**/*',
      '**/@travetto/base/**/stacktrace.*',
      '**/@travetto/compiler/**/proxy.*',
      '**/node_modules/cls-hooked/**/*',
      '**/node_modules/trace/**/*',
      '**/node_modules/stack-chain/**/*'
    ],
    args: [app.name],
    console: 'internalConsole',
    internalConsoleOptions: 'openOnSessionStart'
  });
}

vscode.commands.registerCommand('travetto.di.run', async config => runApplication());