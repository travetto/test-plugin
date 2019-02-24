import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as util from 'util';
import { Util } from './util';

export class Workspace {
  static context: vscode.ExtensionContext;
  static folder: vscode.WorkspaceFolder;
  static cacheDir: string;

  static get path() {
    return this.folder.uri.fsPath;
  }

  static init(context: vscode.ExtensionContext) {
    Workspace.context = context;
    Workspace.folder = vscode.workspace.workspaceFolders![0];

    this.cacheDir = [
      os.tmpdir(),
      'travetto-plugin',
      `${Util.hash(Workspace.path)}`
    ].reduce((acc, v) => {
      const out = path.resolve(acc, v);
      if (!fs.existsSync(out)) {
        fs.mkdirSync(out);
      }
      return out;
    }, '');
  }

  static initTravetto() {
    process.chdir(Workspace.path);

    // Allow for workspace requires of ts files
    require('util.promisify').shim();
    Workspace.requireLibrary('@travetto/base/bin/bootstrap');
  }

  static getAbsoluteResource(rel: string) {
    return this.context.asAbsolutePath(rel);
  }

  static resolve = (...p: string[]) => path.resolve(Workspace.path, ...p);
  static require = (...p: string[]) => require(Workspace.resolve(...p));

  // tslint:disable:member-ordering
  static resolveLibrary = Workspace.resolve.bind(null, 'node_modules');
  static requireLibrary = Workspace.require.bind(null, 'node_modules');
  // tslint:enable:member-ordering

  static generateLaunchConfig(config: { name: string, program: string } & Partial<vscode.DebugConfiguration>) {
    config.program = config.program.replace(Workspace.path, `\${workspaceFolder}`);
    return {
      type: 'node',
      request: 'launch',
      protocol: 'inspector',
      // tslint:disable-next-line:no-invalid-template-strings
      cwd: '${workspaceFolder}',
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
      console: 'internalConsole',
      internalConsoleOptions: 'openOnSessionStart',
      ...config
    };
  }

  static fork(cmd: string, args: string[] = []) {
    return new Promise<string>((resolve, reject) => {
      const text: Buffer[] = [];
      const err: Buffer[] = [];
      const proc = require('child_process').spawn(process.argv0, [cmd, ...(args || [])], {
        env: process.env,
        cwd: Workspace.path,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
      });
      proc.stdout.on('data', (v: Buffer) => text.push(v));
      proc.stderr.on('data', (v: Buffer) => err.push(v));
      proc.on('exit', (v: number) => {
        if (v === 0) {
          resolve(Buffer.concat(text).toString());
        } else {
          reject(Buffer.concat(err).toString());
        }
      });
    });
  }

  static async readFolder(...paths: string[]) {
    const entries = util.promisify(fs.readdir)(Workspace.resolve(...paths));
    return entries;
  }
}