import * as vscode from 'vscode';

export const CWD = vscode.workspace.workspaceFolders[0].uri.path;

export const Entity = {
  TEST: 'test',
  SUITE: 'suite',
  ASSERT: 'assert'
}

export const EntityPhase = {
  AFTER: 'after'
}
