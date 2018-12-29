import * as vscode from 'vscode';
import * as util from 'util';
import { requireLocal } from '../../../util';
import { Assertion, TestResult } from './types';

const { Stacktrace } = requireLocal('@travetto/base');
const { ExecUtil } = requireLocal('@travetto/exec');

const rgba = (r = 0, g = 0, b = 0, a = 1) => `rgba(${r},${g},${b},${a})`;

const ITALIC = 'font-style: italic;';
const Style = {
  SMALL_IMAGE: '40%',
  FULL_IMAGE: 'auto',
  COLORS: {
    fail: rgba(255, 0, 0, 0.5),
    success: rgba(0, 255, 0, .5),
    unknown: rgba(255, 255, 255, .5)
  },
  IMAGE: {
    isWholeLine: false,
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  } as Partial<vscode.DecorationRenderOptions>,
  ASSERT: {
    isWholeLine: false,
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    borderWidth: '0 0 0 4px',
    borderStyle: 'solid',
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    after: { textDecoration: `none; ${ITALIC}` },
    light: { after: { color: 'darkgrey' } },
    dark: { after: { color: 'grey' } }
  } as Partial<vscode.DecorationRenderOptions>
};

export class Decorations {

  static context: vscode.ExtensionContext;

  static buildHover(asrt: Partial<Assertion>) {
    if (asrt.error) {
      let title: string;
      let body: string;
      let bodyFirst: string;
      let suffix = asrt.message;

      if ('errors' in asrt.error) {
        title = asrt.error!.message;
        const messages = ((asrt.error as any).errors).map(x => typeof x === 'string' ? x : x.message);
        suffix = `(${title}) ${messages.join(', ')}`;
        if (suffix.length > 60) {
          suffix = title;
        }
        body = `\t${messages.join('  \n\t')}  `;
        bodyFirst = `${title} - ${messages.join(', ')}`;
      } else if (asrt.expected !== undefined && asrt.actual !== undefined) {
        title = asrt.message
          .replace(/^.*should/, 'Should');

        const extra = title.split(/^Should(?:\s+[a-z]+)+/)[1];
        title = title.replace(extra, '');

        if (suffix.length > 50) {
          suffix = title;
        }

        const getVal = str => {
          try {
            return util.inspect(JSON.parse(str), false, 10).replace(/\n/g, '  \n\t');
          } catch (e) {
            return str;
          }
        };

        if (/equal/i.test(asrt.operator)) {
          body = `\tExpected: \n\t${getVal(asrt.expected)} \n\tActual: \n\t${getVal(asrt.actual)} \n`;
        } else {
          body = `\t${asrt.message}`;
        }
        bodyFirst = asrt.message;
      } else {
        title = asrt.error.message;
        suffix = asrt.error.message;

        body = Stacktrace.simplifyStack(ExecUtil.deserializeError(asrt.error));
        bodyFirst = body.split('\n')[0];
      }
      return { suffix, title, bodyFirst, body, markdown: new vscode.MarkdownString(`**${title}** \n\n${body}`) };
    }
  }

  static line(n: number, end: number = 0): vscode.DecorationOptions {
    return { range: new vscode.Range(n - 1, 0, (end || n) - 1, 100000000000) };
  }

  static buildAssert(state: string) {
    const color = Style.COLORS[state];
    return vscode.window.createTextEditorDecorationType({
      ...Style.ASSERT,
      borderColor: color,
      overviewRulerColor: state === 'fail' ? color : '',
    });
  }

  static buildImage(state: string, size = Style.FULL_IMAGE) {
    const img = Decorations.context.asAbsolutePath(`images/${state}.png`);
    return vscode.window.createTextEditorDecorationType({
      ...Style.IMAGE,
      gutterIconPath: img,
      gutterIconSize: size
    });
  }

  static buildAssertion(assertion: { error?: Error, line: number, lineEnd?: number, message?: string }): vscode.DecorationOptions {
    let out = this.line(assertion.line, assertion.lineEnd);
    if (assertion.error) {
      const { suffix, title, markdown } = this.buildHover(assertion);

      out = {
        ...out,
        hoverMessage: markdown,
        renderOptions: {
          after: {
            textDecoration: ITALIC,
            contentText: `    ${suffix} `
          }
        }
      };
    }
    return out;
  }

  static buildSuite(suite: { lines: { start: number } }) {
    return { ...this.line(suite.lines.start) };
  }

  static buildTest(test: { lines: { start: number } }) {
    if ('error' in test) {
      const tt = test as TestResult;
      const hover = this.buildHover((tt.assertions).find(x => x.status === 'fail') || { error: tt.error, message: tt.error.message });
      return {
        ...this.line(tt.lines.start),
        hoverMessage: hover.markdown
      };
    } else {
      return this.line(test.lines.start);
    }
  }

  static buildStyle(entity: string, state: string) {
    return (entity === 'assertion') ?
      this.buildAssert(state) :
      this.buildImage(state, entity === 'test' ? Style.SMALL_IMAGE : Style.FULL_IMAGE);
  }
}
