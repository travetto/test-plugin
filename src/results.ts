import * as vscode from 'vscode';

import { Assertion, TestResult, SuiteResult, TestConfig, SuiteConfig, TestEvent, EventEntity } from '@travetto/test/src/model';

import { Entity, EntityPhase, State } from './types';
import { Decorations } from './decoration';
import { log } from './util';

type SMap<v> = { [key: string]: v };

type Decs<T> = SMap<SMap<T>>;

interface ResultStsyles {
  [key: string]: vscode.TextEditorDecorationType;
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

  private _test: TestConfig;
  private _editor: vscode.TextEditor;

  setEditor(e: vscode.TextEditor) {
    this._editor = e as any;
    this.resetAll();
  }

  resetAll() {
    for (const l of [Entity.SUITE, Entity.TEST]) {
      Object.values(this.results[l] as { [key: string]: ResultState }).forEach(e => {
        Object.values(e.styles).forEach(x => x.dispose());
        if (l === Entity.TEST) {
          Object.values((e as TestState).assertStyles).forEach(x => x.dispose());
        }
      });
    }
    this.results = { suite: {}, test: {} };
  }

  store(level: string, key: string, status: string, val: vscode.DecorationOptions, extra: any = {}) {
    log(level, key, status, true);

    if (level === Entity.ASSERTION) {
      const tkey = `${this._test.suiteName}:${this._test.method}`;
      const el = this.results.test[tkey];
      const groups = { success: [], fail: [], unknown: [] };

      el.assertions.push({ state: status, decoration: val });

      for (const a of el.assertions) {
        groups[a.state].push(a.decoration);
      }

      for (const s of [State.SUCCESS, State.FAIL, State.UNKNOWN]) {
        this._editor.setDecorations(el.assertStyles[s], groups[s]);
      }

    } else if (level === Entity.SUITE) {
      const el = this.results.suite[key];
      el.state = status;
      el.decoration = val;

      Object.keys(el.styles).forEach(x => {
        this._editor.setDecorations(el.styles[x], x === status ? [val] : []);
      })

    } else {
      const el = this.results.test[key];
      el.state = status;
      el.decoration = val;
      el.suite = extra.suite;
      this._editor.setDecorations(el.styles[status], [val]);
    }
  }

  genStyles(level: EventEntity) {
    return {
      fail: Decorations.buildStyle(level, State.FAIL),
      success: Decorations.buildStyle(level, State.SUCCESS),
      unknown: Decorations.buildStyle(level, State.UNKNOWN)
    };
  }

  reset(level: typeof Entity.TEST | typeof Entity.SUITE, key: string) {
    const base: ResultState = { styles: this.genStyles(level) };

    const existing = this.results[level][key];

    if (existing) {
      Object.values(existing.styles).forEach(x => x.dispose());
    }

    if (level === Entity.TEST) {
      const testBase = (base as TestState);
      testBase.assertions = [];
      testBase.assertStyles = this.genStyles(Entity.ASSERTION)

      if (existing) {
        Object.values((existing as TestState).assertStyles).forEach(x => x.dispose());
      }
    }
    this.results[level][key] = base;
  }

  setSuiteViaTest(test: { line: number, suiteName: string }, state: string) {
    let line = test.line;
    let suiteLine = 0;
    while (!suiteLine && line > 1) {
      const text = this._editor.document.lineAt(--line);
      if (text.text.includes('@Suite')) {
        suiteLine = line;
      }
    }
    this.store(Entity.SUITE, test.suiteName, state, Decorations.buildSuite({ line: suiteLine + 1 }));
  }

  onEvent(e: TestEvent, line?: number) {
    if (e.phase === EntityPhase.BEFORE) {
      if (e.type === Entity.SUITE) {
        this.reset(Entity.SUITE, e.suite.name);
        this.store(Entity.SUITE, e.suite.name, State.UNKNOWN, Decorations.buildSuite(e.suite));
      } else if (e.type === Entity.TEST) {
        const key = `${e.test.suiteName}:${e.test.method}`;
        this.reset(Entity.TEST, key);
        this.store(Entity.TEST, key, State.UNKNOWN, Decorations.buildTest(e.test));
        if (line) {
          this.setSuiteViaTest(e.test, State.UNKNOWN);
        }
        this._test = e.test;
      }
    } else {
      if (e.type === Entity.SUITE) {
        this.onSuite(e.suite);
      } else if (e.type === Entity.TEST) {
        this.onTest(e.test, line);
        delete this._test;
      } else if (e.type === Entity.ASSERTION) {
        this.onAssertion(e.assertion);
      }
    }
  }

  onSuite(suite: SuiteResult) {
    const status = suite.skip ? State.UNKNOWN : (suite.fail ? State.FAIL : State.SUCCESS);
    this.store(Entity.SUITE, suite.name, status, Decorations.buildSuite(suite));
  }

  onTest(test: TestResult, line?: number) {
    const dec = Decorations.buildTest(test);
    const status = test.status === State.SKIP ? State.UNKNOWN : test.status;
    this.store(Entity.TEST, `${this._test.suiteName}:${test.method}`, status, dec, { suite: this._test.suiteName });

    // Update Suite if doing a single line
    if (line &&
      line >= this._test.line &&
      line <= this._test.lineEnd
    ) { // Update suite
      const fail = Object.values(this.results.test).find(x => x.suite === test.suiteName && x.state === State.FAIL);
      this.setSuiteViaTest(test, fail ? State.FAIL : State.SUCCESS);
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
      switch (o.state) {
        case State.UNKNOWN: unknown++; break;
        case State.FAIL: failed++; break;
        case State.SUCCESS: success++; break;
      }
    }

    return { success, unknown, failed, total };
  }
}
