import { CWD, requireLocal, NEW_CLI } from './util';
process.chdir(CWD);

require('util.promisify').shim();

if (NEW_CLI) {
  requireLocal('@travetto/base/bin/bootstrap');
} else {
  requireLocal('@travetto/base/bin/travetto');
}

if (!console.debug) { console.debug = () => { }; }

export { activate, deactivate } from './feature/editor';
import './feature/debug';