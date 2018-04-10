import * as vscode from 'vscode';

import { Assertion, TestResult, SuiteResult, TestConfig, SuiteConfig, TestEvent } from '@travetto/test/src/model';

import { Entity, EntityPhase } from './types';

type SMap<v> = { [key: string]: v };

type Decs<T> = SMap<SMap<T>>;

function deserializeError(e: any) {
  if (e && e.$) {
    const err = new Error();
    for (const k of Object.keys(e)) {
      (err as any)[k] = e[k];
    }
    err.message = e.message;
    err.stack = e.stack;
    err.name = e.name;
    return err;
  } else if (e) {
    return e;
  }
}

const line = (n: number) => ({ range: new vscode.Range(n - 1, 0, n - 1, 100000000000) });
const rgba = (r = 0, g = 0, b = 0, a = 1) => `rgba(${r},${g},${b},${a})`;
const buildHover = (err?: Error) => (err ? { language: 'html', value: `${deserializeError(err).stack}` } : undefined)
const mapObj = (keys: string[], fn: (key: string) => any) => keys.reduce((acc, v) => { acc[v] = fn(v); return acc; }, {})

const State = {
  FAIL: 'fail',
  SKIP: 'skip',
  UNKNOWN: 'unknown',
  SUCCESS: 'success',
}

const ITALIC = 'font-style: italic;';
const Style = {
  SMALL_IMAGE: '40%',
  FULL_IMAGE: 'auto',
  COLORS: {
    [State.FAIL]: rgba(255, 0, 0, 0.5),
    [State.SUCCESS]: rgba(0, 255, 0, .5),
    [State.UNKNOWN]: rgba(255, 255, 255, .5)
  },
  IMAGE: {
    isWholeLine: false,
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
  },
  ASSERT: {
    isWholeLine: false,
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    borderWidth: '0 0 0 4px',
    borderStyle: 'solid',
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    after: { textDecoration: `none; ${ITALIC}` },
    light: { after: { color: 'darkgrey' } },
    dark: { after: { color: 'grey' } }
  }
};

function build<T>(x: (a: string, b: string) => T): Decs<T> {
  const s = (l) => ({ fail: x(l, 'fail'), success: x(l, 'success'), unknown: x(l, 'unknown') });
  return { test: s('test'), assertion: s('assertion'), suite: s('suite') };
}

export class DecorationManager {
  private decStyles: Decs<vscode.TextEditorDecorationType>;
  private decs: Decs<Set<vscode.DecorationOptions>>;
  private mapping: Decs<vscode.DecorationOptions[]> = {};

  private _suite: SuiteConfig;
  private _test: TestConfig;

  constructor(private context: vscode.ExtensionContext) { }

  init() {
    this.decs = build((a, b) => new Set());
    this.mapping = build((a, b) => []);
    if (!this.decStyles) {
      this.decStyles = build((k, s) => (k === Entity.ASSERTION) ?
        this.buildAssert(s) :
        this.buildImage(s, k === Entity.TEST ? Style.SMALL_IMAGE : Style.FULL_IMAGE))
    }
  }

  buildAssert(state: string) {
    const color = Style.COLORS[state];
    return vscode.window.createTextEditorDecorationType({
      ...Style.ASSERT,
      borderColor: color,
      overviewRulerColor: state === State.FAIL ? color : '',
    });
  }

  buildImage(state: string, size = Style.FULL_IMAGE) {
    const img = this.context.asAbsolutePath(`images/${state}.png`);
    return vscode.window.createTextEditorDecorationType({
      ...Style.IMAGE,
      gutterIconPath: img,
      gutterIconSize: size
    });
  }

  store(level: string, key: string, status: string, val: vscode.DecorationOptions) {
    this.mapping[level][key].push(val);
    this.decs[level][status].add(val);
  }

  reset(level: string, key: string) {
    if (!this.mapping[level]) {
      this.mapping[level] = {};
    }
    if (!this.mapping[level[key]]) {
      this.mapping[level][key] = [];
    }
    if (this.mapping[level][key]) {
      const toRemove = this.mapping[level][key];
      for (const el of toRemove) {
        for (const k of [State.SKIP, State.FAIL, State.SUCCESS]) {
          this.decs[level][k].delete(el);
        }
      }
      this.mapping[level][key] = [];
    }
  }

  onEvent(e: TestEvent) {
    if (e.phase === EntityPhase.BEFORE) {
      if (e.type === Entity.SUITE) {
        this.reset(Entity.SUITE, e.suite.name);
        this._suite = e.suite;
      } else {
        const key = `${this._suite.name}:${e.test.method}`;
        this.reset(Entity.ASSERTION, key);
        this.reset(Entity.TEST, key);
        this._test = e.test;
      }
    } else {
      if (e.type === Entity.SUITE) {
        const status = e.suite.skip ? State.UNKNOWN : (e.suite.fail ? State.FAIL : State.SUCCESS);
        this.store(Entity.SUITE, e.suite.name, status, { ...line(e.suite.line) });
        delete this._suite;
      } else if (e.type === Entity.TEST) {
        const dec = { ...line(e.test.line), hoverMessage: buildHover(e.test.error) };
        const status = e.test.status === State.SKIP ? State.UNKNOWN : e.test.status;
        this.store(Entity.TEST, `${this._suite.name}:${e.test.method}`, status, dec);
        delete this._test;
      } else {
        this.onAssertion(e.assertion);
      }
    }
  }

  onAssertion(assertion: Assertion) {
    const status = assertion.error ? State.FAIL : State.SUCCESS;
    const key = `${this._suite.name}:${this._test.method}`;

    let dec;
    if (assertion.error) {
      dec = {
        ...line(assertion.line),
        hoverMessage: buildHover(assertion.error),
        renderOptions: {
          after: {
            textDecoration: ITALIC,
            contentText: `    ${assertion.message}`
          }
        }
      };
    } else {
      dec = line(assertion.line);
    }

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
