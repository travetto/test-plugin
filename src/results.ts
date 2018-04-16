import * as vscode from 'vscode';

import { Decorations } from './decoration';
import { log } from './util';
import {
  AllState, TestConfig, TestState, ResultState,
  TestEvent, SuiteResult, TestResult, Assertion,
  SuiteState
} from './types';

export class ResultsManager {
  private results: AllState = {
    suite: {},
    test: {}
  };

  private _editor: vscode.TextEditor;

  setEditor(e: vscode.TextEditor) {
    this._editor = e as any;
    this.resetAll();
  }

  resetAll() {
    for (const l of ['suite', 'test']) {
      Object.values(this.results[l] as { [key: string]: ResultState<any> }).forEach(e => {
        Object.values(e.styles).forEach(x => x.dispose());
        if (l === 'test') {
          Object.values((e as TestState).assertStyles).forEach(x => x.dispose());
        }
      });
    }
    this.results = { suite: {}, test: {} };
  }

  store(level: string, key: string, status: string, decoration: vscode.DecorationOptions, src?: any) {
    log(level, key, status, true);

    if (level === 'assertion') {
      const el = this.results.test[key];
      const groups = { success: [], fail: [], unknown: [] };

      el.assertions.push({ status, decoration, src });

      for (const a of el.assertions) {
        groups[a.status].push(a.decoration);
      }

      for (const s of ['success', 'fail', 'unknown']) {
        this._editor.setDecorations(el.assertStyles[s], groups[s]);
      }

    } else if (level === 'suite') {
      const el = this.results.suite[key];
      el.src = src;
      el.status = status;
      el.decoration = decoration;

      Object.keys(el.styles).forEach(x => {
        this._editor.setDecorations(el.styles[x], x === status ? [decoration] : []);
      })

    } else {
      const el = this.results.test[key];
      el.src = src;
      el.status = status;
      el.decoration = decoration;
      this._editor.setDecorations(el.styles[status], [decoration]);
    }
  }

  genStyles(level: 'suite' | 'test' | 'assertion') {
    return {
      fail: Decorations.buildStyle(level, 'fail'),
      success: Decorations.buildStyle(level, 'success'),
      unknown: Decorations.buildStyle(level, 'unknown')
    };
  }

  reset(level: 'test' | 'suite', key: string) {
    const existing = this.results[level][key];
    const base: ResultState<any> = { styles: this.genStyles(level), src: (existing && existing.src) };

    if (existing) {
      Object.values(existing.styles).forEach(x => x.dispose());
    }

    if (level === 'test') {
      const testBase = (base as TestState);
      testBase.assertions = [];
      testBase.assertStyles = this.genStyles('assertion');

      if (existing) {
        Object.values((existing as TestState).assertStyles).forEach(x => x.dispose());
      }
      this.results[level][key] = testBase;
    } else if (level === 'suite') {
      const suiteBase = (base as SuiteState);
      this.results[level][key] = suiteBase;
    }
  }

  setSuiteViaTest(test: TestConfig, status: string) {
    let line = test.lines.start;
    let suiteLine = 0;
    while (!suiteLine && line > 1) {
      const text = this._editor.document.lineAt(--line);
      if (text.text.includes('@Suite')) {
        suiteLine = line;
      }
    }

    this.store('suite', test.className, status, Decorations.buildSuite({ lines: { start: suiteLine + 1 } }), test);
  }

  onEvent(e: TestEvent, line?: number) {
    if (e.phase === 'before') {
      if (e.type === 'suite') {
        this.reset('suite', e.suite.className);
        this.store('suite', e.suite.className, 'unknown', Decorations.buildSuite(e.suite), e.suite);

        for (let test of Object.values(this.results.test).filter(x => x.src.className === e.suite.className)) {
          this.reset('test', `${test.src.className}:${test.src.methodName}`);
        }

        // Clear diags
      } else if (e.type === 'test') {
        const key = `${e.test.className}:${e.test.methodName}`;
        this.reset('test', key);
        this.store('test', key, 'unknown', Decorations.buildTest(e.test), e.test);

        // IF running a single test        
        if (line) {
          this.setSuiteViaTest(e.test, 'unknown');
        }
      }
    } else {
      if (e.type === 'suite') {
        this.onSuite(e.suite);
      } else if (e.type === 'test') {
        this.onTest(e.test, line);
      } else if (e.type === 'assertion') {
        this.onAssertion(e.assertion);
      }
    }
  }

  onSuite(suite: SuiteResult) {
    const status = suite.skip ? 'unknown' : (suite.fail ? 'fail' : 'success');
    this.store('suite', suite.className, status, Decorations.buildSuite(suite), suite);
  }

  onTest(test: TestResult, line?: number) {
    const dec = Decorations.buildTest(test);
    const status = test.status === 'skip' ? 'unknown' : test.status;
    this.store('test', `${test.className}:${test.methodName}`, status, dec, test);

    // Update Suite if doing a single line
    if (line &&
      line >= test.lines.start &&
      line <= test.lines.end
    ) { // Update suite
      const fail = Object.values(this.results.test).find(x => x.src.className === test.className && x.status === 'fail');
      this.setSuiteViaTest(test, fail ? 'fail' : 'success');
    }
  }

  onAssertion(assertion: Assertion) {
    const status = assertion.error ? 'fail' : 'success';
    const key = `${assertion.className}:${assertion.methodName}`;
    const dec = Decorations.buildAssertion(assertion);
    this.store('assertion', key, status, dec, assertion);
  }

  getTotals() {
    const vals = Object.values(this.results.test);
    const total = vals.length;
    let success = 0;
    let unknown = 0;
    let failed = 0;

    for (const o of vals) {
      switch (o.status) {
        case 'unknown': unknown++; break;
        case 'fail': failed++; break;
        case 'success': success++; break;
      }
    }

    return { success, unknown, failed, total };
  }
}
