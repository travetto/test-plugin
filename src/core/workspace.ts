import * as vscode from 'vscode';
import { FsUtil } from '@travetto/boot';

/**
 * Standard set of workspace utilities
 */
export class Workspace {

  static context: vscode.ExtensionContext;
  static folder: vscode.WorkspaceFolder;
  static cacheDir: string;

  /**
   * Get workspace path
   */
  static get path() {
    return this.folder.uri.fsPath;
  }

  /**
   * Determine if in framework dev mode
   */
  static get frameworkDev() {
    return /travetto.*\/module\//.test(this.path);
  }

  /**
   * Read default environment data for executions
   * @param extra Additional env vars to add
   */
  static getDefaultEnv(extra: Record<string, string> = {}) {
    return {
      FORCE_COLOR: 'true',
      ...(this.frameworkDev ? {
        TRV_DEV: '1',
        NODE_PRESERVE_SYMLINKS: '1'
      } : {}),
      ...extra
    };
  }

  /**
   * Initialize extension context
   * @param context 
   */
  static init(context: vscode.ExtensionContext) {
    this.context = context;
    this.folder = vscode.workspace.workspaceFolders![0];
  }

  /**
   * Initialize framework
   */
  static initTravetto() {
    process.chdir(this.path);
    // Allow for workspace requires of ts files
    this.requireLibrary('@travetto/boot/bin/init');
  }

  /**
   * Re-initialize framework
   */
  static reinitTravetto() {
    // @ts-ignore
    global.trvInit && global.trvInit.deinit();
    this.initTravetto();
  }

  /**
   * Find full path for a resource
   * @param rel 
   */
  static getAbsoluteResource(rel: string) {
    return this.context.asAbsolutePath(rel);
  }

  /**
   * Resolve worskapce path
   */
  static resolve(...p: string[]) {
    return FsUtil.resolveUnix(this.path, ...p);
  }
  /**
   * Require via the workspace
   */
  static require(...p: string[]) {
    return require(this.resolve(...p));
  }

  /**
   * Resolve framework file
   */
  static resolveLibrary(...p: string[]) {
    return this.resolve('node_modules', ...p);
  }

  /**
   * Require framework file
   */
  static requireLibrary(...p: string[]) {
    return this.require('node_modules', ...p);
  }

  /**
   * Generate execution launch config
   * @param config 
   */
  static generateLaunchConfig(config: { name: string, program: string } & Partial<vscode.DebugConfiguration>) {
    config.program = config.program.replace(this.path, `\${workspaceFolder}`);
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
        '**/@travetto/context/**/*'
      ],
      console: 'internalConsole',
      internalConsoleOptions: 'openOnSessionStart',
      ...config
    };
  }
}