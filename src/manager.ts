import * as vscode from 'vscode';

import { deserialize } from '@travetto/test/src/exec/agent/error';
import { Assertion, TestResult, SuiteResult } from '@travetto/test/src/model';

import { Entity } from './types';

type Decs<T> = { [key: string]: { [key: string]: T[] } };

const line = (n: number) => ({ range: new vscode.Range(n - 1, 0, n - 1, 100000000000) });
const rgba = (r = 0, g = 0, b = 0, a = 1) => `rgba(${r},${g},${b},${a})`;
const buildHover = (err?: Error) => (err ? { language: 'html', value: `${deserialize(err).stack}` } : undefined)
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
  private decs: Decs<vscode.DecorationOptions>;

  constructor(private context: vscode.ExtensionContext) { }

  init() {
    if (!this.decStyles) {
      this.decStyles = mapObj(Object.keys(Entity), k =>
        mapObj(Object.keys(State), s =>
          (k === Entity.ASSERT) ?
            this.buildAssert(s) :
            this.buildImage(s, k === Entity.TEST ? Style.SMALL_IMAGE : Style.FULL_IMAGE)
        )
      );
    }
    this.decs = mapObj(Object.keys(Entity), () => ({ [State.SUCCESS]: [], [State.FAIL]: [], [State.UNKNOWN]: [] }));
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
    this.decs.assert[status].push(dec);
  }

  onTest(test: TestResult) {
    // Prep errors
    const dec = { ...line(test.line), hoverMessage: buildHover(test.error) };

    const status = test.status === State.SKIP ? State.UNKNOWN : test.status;
    this.decs.test[status].push(dec);
  }

  onSuite(suite: SuiteResult) {
    const status = suite.skip ? State.UNKNOWN : (suite.fail ? State.FAIL : State.SUCCESS);
    this.decs.suite[status].push(line(suite.line));
  }

  applyDecorations(editor: vscode.TextEditor) {
    for (const key of [Entity.SUITE, Entity.TEST, Entity.ASSERT]) {
      for (const type of [State.FAIL, State.SUCCESS, State.UNKNOWN]) {
        editor.setDecorations(this.decStyles[key][type], (this.decs[key] || {})[type] || []);
      }
    }
  }
}
