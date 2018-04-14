import * as vscode from 'vscode';

import { Assertion, TestResult, SuiteResult, TestConfig, SuiteConfig, TestEvent, EventEntity } from '@travetto/test/src/model';

import { Entity, EntityPhase, State } from './types';
import { Decorations } from './decoration';
import { log } from './util';

type SMap<v> = { [key: string]: v };

type Decs<T> = SMap<SMap<T>>;

function build<T>(x: (a: string, b: string) => T, sub: boolean = true): Decs<T> {
  const s = (l) => sub ? ({ fail: x(l, 'fail'), success: x(l, 'success'), unknown: x(l, 'unknown') }) : {};
  return { test: s('test'), assertion: s('assertion'), suite: s('suite') };
}

interface ResultStsyles {
  success: vscode.TextEditorDecorationType,
  fail: vscode.TextEditorDecorationType,
  unknown: vscode.TextEditorDecorationType
}

interface Result {
  state: string;
  decoration: vscode.DecorationOptions;
}

interface ResultState extends Partial<Result> {
  styles: ResultStsyles;
}

interface TestState extends ResultState {
  assertStyles: ResultStsyles;
  assertions: Result[];
  suite: string
}

interface AllState {
  suite: { [key: string]: ResultState };
  test: { [key: string]: TestState };
}

export class ResultsManager {
  private results: AllState = {
    suite: {},
    test: {}
  };

  private _suite: SuiteConfig;
  private _test: TestConfig;
  private _editor: vscode.TextEditor;

  init() {
    this.results = { test: {}, suite: {} };
  }

  setEditor(e: vscode.TextEditor) {
    this._editor = e;
    this.resetAll();
  }

  resetAll() {
    for (const l of ['suite', 'test']) {
      for (const key of Object.keys(this.results[l])) {
        for (const s of ['success', 'fail', 'unknown']) {
          this._editor.setDecorations(this.results.suite[key].styles[s], null);
          if (l === 'test') {
            this._editor.setDecorations(this.results.test[key].assertStyles[s], null);
          }
        }
      }
    }
  }

  store(level: string, key: string, status: string, val: vscode.DecorationOptions, extra?: any) {
    log(level, key, status, true);

    if (level === Entity.ASSERTION) {
      const tkey = `${this._test.suiteName}:${this._test.method}`;
      const el = this.results.test[tkey];
      const groups = { success: [], fail: [], unknown: [] };

      el.assertions.push({ state: status, decoration: val });

      for (const a of el.assertions) {
        groups[a.state].push(a.decoration);
      }

      for (const s of ['success', 'fail', 'unknown']) {
        this._editor.setDecorations(el.assertStyles[s], groups[s].length ? groups[s] : null);
      }

    } else {
      const el = this.results[level as ('suite' | 'test')][key];
      el.state = status;
      el.decoration = val;
      this._editor.setDecorations(el.styles[status], [val]);
    }
  }

  genStyles(level: EventEntity) {
    return {
      fail: Decorations.buildStyle(level, 'fail'),
      success: Decorations.buildStyle(level, 'success'),
      unknown: Decorations.buildStyle(level, 'unknown')
    };
  }

  reset(level: 'suite' | 'test', key: string) {
    const base: ResultState = { styles: this.genStyles(level) };

    const existing = this.results[level][key];

    if (existing) {
      for (const s of ['state', 'fail', 'unknown']) {
        this._editor.setDecorations(existing.styles[s], null);
      }
    }

    if (level === 'test') {
      const testBase = (base as TestState);
      testBase.assertions = [];
      testBase.assertStyles = this.genStyles('assertion')

      for (const s of ['state', 'fail', 'unknown']) {
        this._editor.setDecorations((existing as TestState).assertStyles[s], null);
      }
    }
    this.results[level][key] = base;
  }

  onEvent(e: TestEvent, line?: number) {
    if (e.phase === EntityPhase.BEFORE) {
      if (e.type === Entity.SUITE) {
        this.reset(Entity.SUITE, e.suite.name);
      } else if (e.type === Entity.TEST) {
        const key = `${e.test.suiteName}:${e.test.method}`;
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
          const fail = Object.values(this.results.test).find(x => x.suite === e.test.suiteName && x.state === State.FAIL);
          this.reset(Entity.SUITE, e.test.suiteName);

          let suiteLine = 0;
          while (!suiteLine && line > 1) {
            const text = this._editor.document.lineAt(--line);
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

  getTotals() {
    const vals = Object.values(this.results.test);
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
