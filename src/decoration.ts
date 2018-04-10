import * as vscode from 'vscode';
import { State } from './types';
import { Assertion, SuiteResult, TestResult } from '@travetto/test/src/model';

const rgba = (r = 0, g = 0, b = 0, a = 1) => `rgba(${r},${g},${b},${a})`;
const buildHover = (err?: Error) => (err ? { language: 'html', value: `${deserializeError(err).stack}` } : undefined);
const line = (n: number) => ({ range: new vscode.Range(n - 1, 0, n - 1, 100000000000) });

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

export class Decorations {
  static buildAssert(state: string) {
    const color = Style.COLORS[state];
    return vscode.window.createTextEditorDecorationType({
      ...Style.ASSERT,
      borderColor: color,
      overviewRulerColor: state === State.FAIL ? color : '',
    });
  }

  static buildImage(context: vscode.ExtensionContext, state: string, size = Style.FULL_IMAGE) {
    const img = context.asAbsolutePath(`images/${state}.png`);
    return vscode.window.createTextEditorDecorationType({
      ...Style.IMAGE,
      gutterIconPath: img,
      gutterIconSize: size
    });
  }

  static buildAssertion(assertion: Assertion) {
    return assertion.error ? {
      ...line(assertion.line),
      hoverMessage: buildHover(assertion.error),
      renderOptions: {
        after: {
          textDecoration: ITALIC,
          contentText: `    ${assertion.message}`
        }
      }
    } : line(assertion.line);
  }

  static buildSuite(suite: SuiteResult) {
    return { ...line(suite.line) };
  }

  static buildTest(test: TestResult) {
    return { ...line(test.line), hoverMessage: buildHover(test.error) };
  }
}
