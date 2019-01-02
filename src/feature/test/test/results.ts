import * as vscode from 'vscode';

import { Decorations } from './decoration';
import {
  AllState, TestConfig, TestState, ResultState,
  TestEvent, SuiteResult, TestResult, Assertion,
  SuiteState,
  ErrorHoverAssertion
} from './types';
import { Logger } from '../../../core/log';

const diagColl = vscode.languages.createDiagnosticCollection('Travetto');

export class ResultsManager {

  private results: AllState = {
    suite: {},
    test: {}
  };

  private failedAssertions: { [key: number]: Assertion };

  private diagnostics: vscode.Diagnostic[] = [];

  private _editors: Set<vscode.TextEditor> = new Set();

  public active = false;

  constructor(private _document: vscode.TextDocument) { }

  addEditor(e: vscode.TextEditor) {
    const elements = Array.from(this._editors).filter(x => !(x as any)._disposed);
    this._editors = new Set([...elements, e]);
    this.refresh();
  }

  removeEditors() {
    this._editors.clear();
  }

  setStyle(type: vscode.TextEditorDecorationType, decs: vscode.DecorationOptions[]) {
    for (const ed of this._editors) {
      ed.setDecorations(type, decs);
    }
  }

  resetAll() {
    for (const l of ['suite', 'test'] as (keyof AllState)[]) {
      Object.values(this.results[l] as { [key: string]: ResultState<any> }).forEach(e => {
        Object.values(e.styles).forEach(x => x.dispose());
        if (l === 'test') {
          Object.values((e as TestState).assertStyles).forEach(x => x.dispose());
        }
      });
    }
    this.failedAssertions = {};
    this.results = { suite: {}, test: {} };
  }

  refresh() {
    for (const suite of Object.values(this.results.suite)) {
      if (suite.decoration && suite.status) {
        this.setStyle(suite.styles[suite.status], [suite.decoration]);
      }
    }
    for (const test of Object.values(this.results.test)) {
      if (test.decoration && test.status) {
        this.setStyle(test.styles[test.status], [test.decoration]);

        const out: { [key: string]: vscode.DecorationOptions[] } = { success: [], fail: [], unknown: [] };
        for (const asrt of test.assertions) {
          out[asrt.status].push(asrt.decoration);
        }
        for (const k of Object.keys(out)) {
          this.setStyle(test.assertStyles[k], out[k]);
        }
      }
    }
  }

  refreshDiagnostics() {
    this.diagnostics = Object.values(this.results.test)
      .filter(x => x.status === 'fail')
      .reduce((acc, ts) => {
        for (const as of ts.assertions) {
          if (as.status !== 'fail' || as.src.className === 'unknown') {
            continue;
          }
          const { bodyFirst } = Decorations.buildErrorHover(as.src as ErrorHoverAssertion);
          const rng = as.decoration!.range;

          const diagRng = new vscode.Range(
            new vscode.Position(rng.start.line, this._document.lineAt(rng.start.line).firstNonWhitespaceCharacterIndex),
            rng.end
          );
          const diag = new vscode.Diagnostic(diagRng, `${ts.src.className.split('.').pop()}.${ts.src.methodName} - ${bodyFirst}`, vscode.DiagnosticSeverity.Error);
          acc.push(diag);
        }
        return acc;
      }, [] as vscode.Diagnostic[]);
    diagColl.set(this._document.uri, this.diagnostics);
  }

  store(level: string, key: string, status: string, decoration: vscode.DecorationOptions, src?: any) {
    if (level === 'assertion') {
      const el = this.results.test[key];
      const groups: { [key: string]: vscode.DecorationOptions[] } = { success: [], fail: [], unknown: [] };

      el.assertions.push({ status, decoration, src });

      for (const a of el.assertions) {
        groups[a.status].push(a.decoration);
      }

      for (const s of ['success', 'fail', 'unknown']) {
        this.setStyle(el.assertStyles[s], groups[s]);
      }

    } else if (level === 'suite') {
      const el = this.results.suite[key];
      el.src = src;
      el.status = status;
      el.decoration = decoration;

      Object.keys(el.styles).forEach(x => {
        this.setStyle(el.styles[x], x === status ? [decoration] : []);
      });

    } else {
      const el = this.results.test[key];
      el.src = src;
      el.status = status;
      el.decoration = decoration;
      this.setStyle(el.styles[status], [decoration]);
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
    const base: ResultState<any> = {
      status: 'unknown',
      styles: this.genStyles(level),
      src: (existing && existing.src)
    };

    if (existing) {
      Object.values(existing.styles).forEach(x => x.dispose());
      if (level === 'test') {
        Object.values((existing as TestState).assertStyles).forEach(x => x.dispose());
      }
    }

    if (level === 'test') {
      const testBase = (base as TestState);
      testBase.assertions = [];
      testBase.assertStyles = this.genStyles('assertion');
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
      const text = this._document.lineAt(--line);
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

        for (const test of Object.values(this.results.test).filter(x => x.src.className === e.suite.className)) {
          this.reset('test', `${test.src.className}:${test.src.methodName}`);
        }

        // Clear diags
      } else if (e.type === 'test') {
        const key = `${e.test.className}:${e.test.methodName}`;
        this.reset('test', key);
        const dec = Decorations.buildTest(e.test);
        this.store('test', key, 'unknown', dec, e.test);

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

    this.refreshDiagnostics();

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
    if (status === 'fail') {
      this.failedAssertions[Decorations.line(assertion.line).range.start.line] = assertion;
    }
    this.store('assertion', key, status, dec, assertion);
  }

  hasTotalError() {
    return !!this.results.test['unknown:unknown'];
  }

  setTotalError(error: Error) {
    const assertion: Assertion = {
      status: 'fail',
      className: 'unknown',
      methodName: 'unknown',
      error,
      line: 1,
      message: 'Total Error',
      lineEnd: this._document.lineCount + 1
    };

    const t: TestResult = {
      status: 'fail',
      assertions: [assertion],
      className: 'unknown',
      methodName: 'unknown',
      file: this._document.fileName,
      error,
      lines: { start: 1, end: this._document.lineCount + 1 }
    };
    this.onEvent({ type: 'test', phase: 'before', test: t });
    this.onEvent({ type: 'assertion', phase: 'after', assertion });
    this.onEvent({ type: 'test', phase: 'after', test: t });
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
