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
   * See if module is installed
   * @param module 
   */
  static async isInstalled(module: string) {
    return !!(await FsUtil.exists(this.resolve('node_modules', module)));
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


  /**
   * See if an entity is an editor
   * @param o 
   */
  static isEditor(o: any): o is vscode.TextEditor {
    return 'document' in o;
  }

  /**
   * Get the editor for a doc
   * @param doc 
   */
  static getEditor(doc: vscode.TextDocument) {
    for (const e of vscode.window.visibleTextEditors) {
      if (e.document === doc) {
        return e;
      }
    }
  }
}