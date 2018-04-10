import * as vscode from 'vscode';

export const CWD = `${vscode.workspace.workspaceFolders[0].uri.path}/`;

export const Entity = new (class {
  public readonly TEST = 'test';
  public readonly SUITE = 'suite';
  public readonly ASSERTION = 'assertion';
})()

export const EntityPhase = new (class {
  public readonly AFTER = 'after';
  public readonly BEFORE = 'before';
})();
