import * as vscode from 'vscode';

import { Assertion, TestResult, SuiteResult } from '@travetto/test/src/model';

import { Entity } from './types';

type Decs<T> = { [key: string]: { [key: string]: T } };

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

const Style = {
  SMALL_IMAGE: '40%',
  FULL_IMAGE: 'auto',
  ITALIC: 'font-style: italic;',
  LEFT_BORDER: '0 0 0 4px',
  BORDER_TYPE: 'solid',
  LIGHT_COLOR: 'darkgrey',
  DARK_COLOR: 'gray',
  COLORS: {
    [State.FAIL]: rgba(255, 0, 0, 0.5),
    [State.SUCCESS]: rgba(0, 255, 0, .5),
    [State.UNKNOWN]: rgba(255, 255, 255, .5)
  }
};

export class DecorationManager {
  private decStyles: Decs<vscode.TextEditorDecorationType>;
  private decs: Decs<vscode.DecorationOptions[]>;

  constructor(private context: vscode.ExtensionContext) { }

  init() {
    this.decStyles = mapObj(Object.values(Entity), k =>
      mapObj(Object.values(State), s =>
        (k === Entity.ASSERTION) ?
          this.buildAssert(s) :
          this.buildImage(s, k === Entity.TEST ? Style.SMALL_IMAGE : Style.FULL_IMAGE)
      )
    );
  }

  resetDecorations(data: Decs<vscode.DecorationOptions[]> = undefined) {
    this.decs = data || mapObj(Object.values(Entity), () => mapObj(Object.values(State), () => []));
  }

  buildAssert(state: string) {
    const color = Style.COLORS[state];
    return vscode.window.createTextEditorDecorationType({
      isWholeLine: false,
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      borderWidth: Style.LEFT_BORDER,
      borderStyle: Style.BORDER_TYPE,
      borderColor: color,
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      overviewRulerColor: state === State.FAIL ? color : '',
      after: { textDecoration: `none; ${Style.ITALIC}` },
      light: { after: { color: Style.LIGHT_COLOR } },
      dark: { after: { color: Style.DARK_COLOR } }
    });
  }

  buildImage(state: string, size = Style.FULL_IMAGE) {
    const img = this.context.asAbsolutePath(`images/${state}.png`);
    return vscode.window.createTextEditorDecorationType({
      isWholeLine: false,
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      gutterIconPath: img,
      gutterIconSize: Style.SMALL_IMAGE
    });
  }

  onAssertion(assertion: Assertion) {
    let dec;
    if (assertion.error) {
      dec = {
        ...line(assertion.line),
        hoverMessage: buildHover(assertion.error),
        renderOptions: {
          after: {
            textDecoration: Style.ITALIC,
            contentText: `    ${assertion.message}`
          }
        }
      };
    } else {
      dec = line(assertion.line);
    }

    const status = assertion.error ? State.FAIL : State.SUCCESS;
    this.decs[Entity.ASSERTION][status].push(dec);
  }

  onTest(test: TestResult) {
    // Prep errors
    const dec = { ...line(test.line), hoverMessage: buildHover(test.error) };

    const status = test.status === State.SKIP ? State.UNKNOWN : test.status;
    this.decs[Entity.TEST][status].push(dec);
  }

  onSuite(suite: SuiteResult) {
    const status = suite.skip ? State.UNKNOWN : (suite.fail ? State.FAIL : State.SUCCESS);
    this.decs[Entity.SUITE][status].push(line(suite.line));
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
