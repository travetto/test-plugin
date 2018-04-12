import * as vscode from 'vscode';

import { Assertion, TestResult, SuiteResult, TestConfig, SuiteConfig, TestEvent } from '@travetto/test/src/model';

import { Entity, EntityPhase, State } from './types';
import { Decorations } from './decoration';

type SMap<v> = { [key: string]: v };

type Decs<T> = SMap<SMap<T>>;

function build<T>(x: (a: string, b: string) => T): Decs<T> {
  const s = (l) => ({ fail: x(l, 'fail'), success: x(l, 'success'), unknown: x(l, 'unknown') });
  return { test: s('test'), assertion: s('assertion'), suite: s('suite') };
}

export class ResultsManager {
  private decStyles: Decs<vscode.TextEditorDecorationType>;
  private decs: Decs<vscode.DecorationOptions[]>;
  private mapping: Decs<{ state: string, dec: vscode.DecorationOptions }[]> = {};

  private _suite: SuiteConfig;
  private _test: TestConfig;

  init() {
    this.decs = build((a, b) => []);
    this.mapping = build((a, b) => []);
    if (!this.decStyles) {
      this.decStyles = build((e, s) => Decorations.buildStyle(e, s));
    }
  }

  store(level: string, key: string, status: string, val: vscode.DecorationOptions) {
    this.mapping[level][key].push({ state: status, dec: val });
    this.decs[level][status].push(val);
    console.log(level, key, status, true);
  }

  reset(level: string, key: string) {
    if (!this.mapping[level][key]) {
      this.mapping[level][key] = [];
    }

    const toRemove = this.mapping[level][key];
    for (const el of toRemove) {
      const p = this.decs[level][el.state].indexOf(el.dec);
      if (p >= 0) {
        this.decs[level][el.state].splice(p, 1);
        console.log(level, key, el.state, p, false);
      }
    }
    this.mapping[level][key] = [];
  }

  onEvent(e: TestEvent) {
    if (e.phase === EntityPhase.BEFORE) {
      if (e.type === Entity.SUITE) {
        this.reset(Entity.SUITE, e.suite.name);
      } else if (e.type === Entity.TEST) {
        const key = `${e.test.suiteName}:${e.test.method}`;
        this.reset(Entity.ASSERTION, key);
        this.reset(Entity.TEST, key);
        this._test = e.test;
      }
    } else {
      if (e.type === Entity.SUITE) {
        const status = e.suite.skip ? State.UNKNOWN : (e.suite.fail ? State.FAIL : State.SUCCESS);
        this.store(Entity.SUITE, e.suite.name, status, Decorations.buildSuite(e.suite));
        delete this._suite;
      } else if (e.type === Entity.TEST) {
        const dec = Decorations.buildTest(e.test);
        const status = e.test.status === State.SKIP ? State.UNKNOWN : e.test.status;
        this.store(Entity.TEST, `${this._test.suiteName}:${e.test.method}`, status, dec);
        delete this._test;
      } else if (e.type === Entity.ASSERTION) {
        this.onAssertion(e.assertion);
      }
    }
  }

  onAssertion(assertion: Assertion) {
    const status = assertion.error ? State.FAIL : State.SUCCESS;
    const key = `${this._test.suiteName}:${this._test.method}`;
    const dec = Decorations.buildAssertion(assertion);
    this.store(Entity.ASSERTION, key, status, dec);
  }

  applyDecorations(editor: vscode.TextEditor, data: any = undefined) {
    data = data || this.decs;
    for (const key of [Entity.SUITE, Entity.TEST, Entity.ASSERTION]) {
      for (const type of [State.FAIL, State.SUCCESS, State.UNKNOWN]) {
        editor.setDecorations(this.decStyles[key][type], (data[key] || {})[type] || []);
      }
    }
  }
}
