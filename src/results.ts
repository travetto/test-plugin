import * as vscode from 'vscode';

import { Assertion, TestResult, SuiteResult, TestConfig, SuiteConfig, TestEvent } from '@travetto/test/src/model';

import { Entity, EntityPhase, State } from './types';
import { Decorations } from './decoration';

type SMap<v> = { [key: string]: v };

type Decs<T> = SMap<SMap<T>>;

function build<T>(x: (a: string, b: string) => T, sub: boolean = true): Decs<T> {
  const s = (l) => sub ? ({ fail: x(l, 'fail'), success: x(l, 'success'), unknown: x(l, 'unknown') }) : {};
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
    this.mapping = build((a, b) => [], false);
    if (!this.decStyles) {
      this.decStyles = build((e, s) => Decorations.buildStyle(e, s));
    }
  }

  store(level: string, key: string, status: string, val: vscode.DecorationOptions, extra?: any) {
    this.mapping[level][key].push({ state: status, dec: val, ...(extra || {}) });
    this.decs[level][status].push(val);
    console.debug(level, key, status, true);
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
        console.debug(level, key, el.state, p, false);
      }
    }
    this.mapping[level][key] = [];
  }

  onEvent(e: TestEvent, editor: vscode.TextEditor, line?: number) {
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
        this.store(Entity.TEST, `${this._test.suiteName}:${e.test.method}`, status, dec, { suite: this._test.suiteName });

        if (line &&
          e.phase === EntityPhase.AFTER &&
          e.type === Entity.TEST &&
          line >= this._test.line &&
          line <= this._test.lineEnd
        ) { // Update suite
          const fail = Object.values(this.mapping.test).find(x => x.length && x[0]['suite'] === e.test.suiteName && x[0].state === State.FAIL);
          this.reset(Entity.SUITE, e.test.suiteName);
          let suiteLine = 0;
          while (!suiteLine && line > 1) {
            const text = editor.document.lineAt(--line);
            if (text.text.includes('@Suite')) {
              suiteLine = line;
            }
          }

          delete this._test;

          this.store(Entity.SUITE, e.test.suiteName, fail ? State.FAIL : State.SUCCESS, Decorations.buildSuite({ line: suiteLine + 1 } as any));
        }
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

  getTotals() {
    const vals = Object.values(this.mapping.test);
    const total = vals.length;
    let success = 0;
    let unknown = 0;
    let failed = 0;

    for (const o of vals) {
      switch (o[0].state) {
        case State.UNKNOWN: unknown++; break;
        case State.FAIL: failed++; break;
        case State.SUCCESS: success++; break;
      }
    }

    return { success, unknown, failed, total };
  }
}
