import * as vscode from 'vscode';
import * as esp from 'error-stack-parser';
import * as util from 'util';
import { CWD } from './util';
import { Assertion } from './types';

const rgba = (r = 0, g = 0, b = 0, a = 1) => `rgba(${r},${g},${b},${a})`;

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
      let suffix = asrt.message;

      let body: string;
      if ('errors' in asrt.error) {
        title = asrt.error!.message;
        suffix = `*${title}* ${((asrt.error as any).errors).map(x => x.message).join(', ')}`;
        if (suffix.length > 60) {
          suffix = title;
        }
        body = '\t' + ((asrt.error as any).errors).map(x => x.message).join('  \n\t') + '  ';
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
        }

        body = `\tExpected:  \n\t${getVal(asrt.expected)}  \n` +
          `\tActual:  \n\t${getVal(asrt.actual)}  \n`;

      } else {
        title = asrt.error.message;
        suffix = asrt.error.message;

        body = esp.parse(deserializeError(asrt.error))
          .filter(x => !/@travetto\/(test|base|compile|registry|exec)/.test(x.fileName)) // Exclude framework boilerplate
          .reduce(
            (acc, x) => {
              x.fileName = x.fileName.replace(CWD + '/', '').replace('node_modules', 'n_m');
              x.fileName = x.fileName.replace(/n_m\/@travetto\/([^/]+)\/src/g, (a, p) => `@trv/${p}`)
              if (!acc.length || acc[acc.length - 1].fileName !== x.fileName) {
                acc.push(x);
              }
              return acc;
            }, [] as esp.StackFrame[])
          .map(x => {
            const functionName = x.getFunctionName() || '(anonymous)';
            const args = '(' + (x.getArgs() || []).join(', ') + ')';
            const fileName = x.getFileName() ? (`at ${x.getFileName()}`) : '';
            const lineNumber = x.getLineNumber() !== undefined ? (':' + x.getLineNumber()) : '';
            return `\t${functionName + args} ${fileName + lineNumber} `;
          })
          .join('  \n');
      }

      return { suffix, title, markdown: new vscode.MarkdownString(`${title} \n\n${body}`) };
    }
  }

  static line(n: number): vscode.DecorationOptions {
    return { range: new vscode.Range(n - 1, 0, n - 1, 100000000000) }
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
    const img = Decorations.context.asAbsolutePath(`images / ${state}.png`);
    return vscode.window.createTextEditorDecorationType({
      ...Style.IMAGE,
      gutterIconPath: img,
      gutterIconSize: size
    });
  }

  static buildAssertion(assertion: { error?: Error, line: number, message?: string }): vscode.DecorationOptions {
    let out = this.line(assertion.line);
    if (assertion.error) {
      const { suffix, title, markdown } = this.buildHover(assertion);

      out = {
        ...out,
        hoverMessage: markdown,
        renderOptions: {
          after: {
            textDecoration: ITALIC,
            contentText: `    ${suffix}`
          }
        }
      }
    }
    return out;
  }

  static buildSuite(suite: { lines: { start: number } }) {
    return { ...this.line(suite.lines.start) };
  }

  static buildTest(test: { lines: { start: number }, assertions?: Assertion[], error?: Error }) {
    return { ...this.line(test.lines.start), hoverMessage: this.buildHover((test.assertions).find(x => x.status === 'fail') || { error: test.error }) };
  }

  static buildStyle(entity: string, state: string) {
    return (entity === 'assertion') ?
      this.buildAssert(state) :
      this.buildImage(state, entity === 'test' ? Style.SMALL_IMAGE : Style.FULL_IMAGE);
  }
}
