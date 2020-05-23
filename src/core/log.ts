import * as vscode from 'vscode';
import * as util from 'util';

/**
 * Logging channel for the plugin
 */
export class Logger {
  /**
   * Is logging enabled
   */
  private static debugModeEnabled = false;

  /**
   * Logging output channel
   */
  static channel = vscode.window.createOutputChannel('@travetto');

  /**
   * Send data over the appender
   * @param scope Log level
   * @param message Msesage
   * @param args Additional arguments
   */
  private static _log(scope: string, message: string, ...args: any[]) {
    this.channel.appendLine(`[${scope}] ${message} ${args.map(x => util.inspect(x)).join(' ')}`);
  }

  /**
   * Set logging state
   */
  static set debugMode(val: boolean) {
    if (val) {
      process.env.DEBUG = 'true';
    } else {
      delete process.env.DEBUG;
    }
    this.debugModeEnabled = val;
  }

  /**
   * Get state
   */
  static get debugMode() {
    return this.debugModeEnabled;
  }

  /**
   * Read logging status from workspace configuration
   */
  static activate() {
    this.debugMode = !!vscode.workspace.getConfiguration().get('travetto.debug');
  }

  /**
   * Info level log
   * @param msg Message
   * @param args  Ags
   */
  static info(msg: string, ...args: any[]) {
    this._log('INFO', msg, ...args);
  }

  /**
   * Error level log
   * @param msg Message
   * @param args  Ags
   */
  static error(msg: string, ...args: any[]) {
    this._log('ERROR', msg, ...args);
  }

  /**
   * Warn level log
   * @param msg Message
   * @param args  Ags
   */
  static warn(msg: string, ...args: any[]) {
    this._log('WARN', msg, ...args);
  }

  /**
   * Debug level log
   * @param msg Message
   * @param args  Ags
   */
  static debug(msg: string, ...args: any[]) {
    if (this.debugMode) {
      this._log('DEBUG', msg, ...args);
    }
  }
}