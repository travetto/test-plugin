import * as fs from 'fs';
import * as vscode from 'vscode';

import { Decorations } from './decoration';
import {
  AllState, TestState, ResultState,
  TestEvent, SuiteResult, TestResult, Assertion,
  SuiteState, Level,
  ErrorHoverAssertion,
  StatusUnknown
} from './types';

const diagColl = vscode.languages.createDiagnosticCollection('Travetto');

export class ResultsManager {

  private results: AllState = {
    suite: {},
    test: {}
  };

  private failedAssertions: { [key: number]: Assertion } = {};

  private diagnostics: vscode.Diagnostic[] = [];

  private editors: Set<vscode.TextEditor> = new Set();

  private document: vscode.TextDocument;

  public active = false;

  constructor(private file: string) { }

  addEditor(e: vscode.TextEditor) {
    if (!this.editors.has(e)) {
      const elements = Array.from(this.editors).filter(x => !(x as any)._disposed);
      this.editors = new Set([...elements, e]);
      this.document = e.document;
      this.refresh();
    }
  }

  setStyle(type: vscode.TextEditorDecorationType, decs: vscode.DecorationOptions[]) {
    for (const ed of this.editors) {
      if (!(ed as any)._disposed) {
        ed.setDecorations(type, decs);
      }
    }
  }

  dispose() {
    this.editors.clear();

    for (const l of ['suite', 'test'] as (keyof AllState)[]) {
      Object.values(this.results[l] as { [key: string]: ResultState<any> }).forEach(e => {
        Object.values(e.styles).forEach(x => x.dispose());
        if (l === 'test') {
          Object.values((e as TestState).assertStyles).forEach(x => x.dispose());
        }
      });
    }
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

        const out: { [key: string]: vscode.DecorationOptions[] } = { ok: [], fail: [], unknown: [] };
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
    let document = this.document;

    this.diagnostics = Object.values(this.results.test)
      .filter(x => x.status === 'failed')
      .reduce((acc, ts) => {
        for (const as of ts.assertions) {
          if (as.status !== 'failed' || as.src.classId === 'unknown') {
            continue;
          }
          const { bodyFirst } = Decorations.buildErrorHover(as.src as ErrorHoverAssertion);
          const rng = as.decoration!.range;

          if (!document) {
            const content = fs.readFileSync(this.file, 'utf8');
            const self = {
              lines: content.split(/\n/g),
              lineAt(line: number) {
                return {
                  firstNonWhitespaceCharacterIndex: (self.lines[line].length - self.lines[line].trimLeft().length)
                }
              }
            };
            document = self as any;
          }

          const diagRng = new vscode.Range(
            new vscode.Position(rng.start.line,
              document.lineAt(rng.start.line).firstNonWhitespaceCharacterIndex
            ),
            rng.end
          );
          const diag = new vscode.Diagnostic(diagRng, `${ts.src.classId.split(/[^a-z-/]+/i).pop()}.${ts.src.methodName} - ${bodyFirst}`, vscode.DiagnosticSeverity.Error);
          diag.source = '@travetto/test';
          acc.push(diag);
        }
        return acc;
      }, [] as vscode.Diagnostic[]);
    diagColl.set(vscode.Uri.file(this.file), this.diagnostics);
  }

  store(level: Level, key: string, status: StatusUnknown, decoration: vscode.DecorationOptions, src?: any) {
    switch (level) {
      case 'assertion': {
        const el = this.results.test[key];
        const groups: Record<StatusUnknown, vscode.DecorationOptions[]> = { passed: [], failed: [], unknown: [], skipped: [] };

        el.assertions.push({ status, decoration, src });

        for (const a of el.assertions) {
          groups[a.status].push(a.decoration);
        }

        for (const s of ['passed', 'failed', 'unknown'] as const) {
          this.setStyle(el.assertStyles[s], groups[s]);
        }
        break;
      }
      case 'suite': {
        const el = this.results.suite[key];
        el.src = src;
        el.status = status;
        el.decoration = decoration;

        Object.keys(el.styles).forEach(x => {
          this.setStyle(el.styles[x], x === status ? [decoration] : []);
        });
        break;
      }
      default: {
        const el = this.results.test[key];
        el.src = src;
        el.status = status;
        el.decoration = decoration;
        this.setStyle(el.styles[status], [decoration]);
      }
    }
  }

  genStyles(level: Level) {
    return {
      failed: Decorations.buildStyle(level, 'failed'),
      passed: Decorations.buildStyle(level, 'passed'),
      unknown: Decorations.buildStyle(level, 'unknown')
    };
  }

  reset(level: Exclude<Level, 'assertion'>, key: string) {
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
    switch (level) {
      case 'test': {
        const testBase = (base as TestState);
        testBase.assertions = [];
        testBase.assertStyles = this.genStyles('assertion');
        this.results[level][key] = testBase;
        break;
      }
      case 'suite': {
        const suiteBase = (base as SuiteState);
        this.results[level][key] = suiteBase;
        break;
      }
    }
  }

  onEvent(e: TestEvent) {
    if (e.phase === 'before') {
      switch (e.type) {
        case 'suite': {
          this.reset('suite', e.suite.classId);
          this.store('suite', e.suite.classId, 'unknown', Decorations.buildSuite(e.suite), e.suite);

          for (const test of Object.values(this.results.test).filter(x => x.src.classId === e.suite.classId)) {
            this.reset('test', `${test.src.classId}:${test.src.methodName}`);
          }
          break;
        }
        // Clear diags
        case 'test': {
          const key = `${e.test.classId}:${e.test.methodName}`;
          this.reset('test', key);
          const dec = Decorations.buildTest(e.test);
          this.store('test', key, 'unknown', dec, e.test);
          break;
        }
      }
    } else {
      switch (e.type) {
        case 'suite': this.onSuite(e.suite); break;
        case 'test': this.onTest(e.test); break;
        case 'assertion': this.onAssertion(e.assertion); break;
      }
    }
  }

  onSuite(suite: SuiteResult) {
    const status = suite.skipped ? 'unknown' : (suite.failed ? 'failed' : 'passed');
    this.reset('suite', suite.classId);
    this.store('suite', suite.classId, status, Decorations.buildSuite(suite), suite);
  }

  onTest(test: TestResult) {
    const dec = Decorations.buildTest(test);
    const status = test.status === 'skipped' ? 'unknown' : test.status;
    this.store('test', `${test.classId}:${test.methodName}`, status, dec, test);

    this.refreshDiagnostics();
  }

  onAssertion(assertion: Assertion) {
    const status = assertion.error ? 'failed' : 'passed';
    const key = `${assertion.classId}:${assertion.methodName}`;
    const dec = Decorations.buildAssertion(assertion);
    if (status === 'failed') {
      this.failedAssertions[Decorations.line(assertion.line).range.start.line] = assertion;
    }
    this.store('assertion', key, status, dec, assertion);
  }

  getTotals() {
    const vals = Object.values(this.results.test);
    const total = vals.length;
    let passed = 0;
    let unknown = 0;
    let failed = 0;
    let skipped = 0;

    for (const o of vals) {
      switch (o.status) {
        case 'skipped': skipped += 1;
        case 'failed': failed++; break;
        case 'passed': passed++; break;
        default: unknown++; break;
      }
    }

    return { passed, unknown, skipped, failed, total };
  }
}
