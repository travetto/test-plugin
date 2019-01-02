import * as vscode from 'vscode';
import * as util from 'util';

export class Logger {
  private static _debugMode = false;
  static channel = vscode.window.createOutputChannel('@travetto');
  static set debugMode(val: boolean) {
    if (val) {
      process.env.DEBUG = 'true';
    } else {
      delete process.env.DEBUG;
    }
    Logger._debugMode = val;
  }

  static get debugMode() {
    return Logger._debugMode;
  }

  private static _log(scope: string, message: string, ...args: any[]) {
    Logger.channel.appendLine(`[${scope}] ${message} ${args.map(x => util.inspect(x)).join(' ')}`);
  }

  static setLoggingFromConfig() {
    Logger.debugMode = !!vscode.workspace.getConfiguration().get('travetto.debug');
  }

  static init() {
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('travetto.debug')) {
        Logger.setLoggingFromConfig();
      }
    });

    Logger.setLoggingFromConfig();
  }

  static info(msg: string, ...args: any[]) {
    Logger._log('INFO', msg, ...args);
  }
  static error(msg: string, ...args: any[]) {
    Logger._log('ERROR', msg, ...args);
  }
  static warn(msg: string, ...args: any[]) {
    Logger._log('WARN', msg, ...args);
  }
  static debug = (msg: string, ...args: any[]) => {
    if (Logger.debugMode) {
      Logger._log('DEBUG', msg, ...args);
    }
  }
}