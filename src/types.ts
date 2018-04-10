import * as vscode from 'vscode';

export const CWD = `${vscode.workspace.workspaceFolders[0].uri.path}/`;

export const Entity = {
  TEST: 'test',
  SUITE: 'suite',
  ASSERTION: 'assertion'
}

export const EntityPhase = {
  AFTER: 'after',
  BEFORE: 'before'
}
