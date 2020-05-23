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
 * Input type
 */
export type FullInput = vscode.QuickInput & {
  placeholder?: string;
  value?: string;
  onDidAccept(cb: () => void): void;
};

/**
 * Input parameter with metadata
 */
export interface ParamWithMeta {
  param: ParamConfig;
  total: number;
  step: number;
  input?: string;
}

export type ParameterUI<T, V = string> = {
  input: T;
  run: () => Promise<V>
};


export type InstallMap = Record<string, boolean>;

/**
 * Shape of a module feature
 */
export interface ModuleFeature {
  activate?(ctx: vscode.ExtensionContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}