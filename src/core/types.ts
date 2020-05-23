import * as vscode from 'vscode';

/**
 * Parameter configuration
 */
export interface ParamConfig {
  name: string;
  title?: string;
  type?: string;
  subtype?: string;
  def?: string | boolean | number;
  optional?: boolean;
  meta?: any;
}

/**
 * Input parameter with metadata
 */
export interface ParamWithMeta {
  param: ParamConfig;
  total: number;
  step: number;
  input?: string;
}

/**
 * Shape of an activation target
 */
export interface ActivationTarget {
  activate?(ctx: vscode.ExtensionContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}

/**
 * Activation factory
 */
export interface ActivationFactory<T extends ActivationTarget = ActivationTarget> {
  init?(): Promise<boolean> | boolean;
  new(): T;
}