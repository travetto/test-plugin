import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Util } from './util';
process.chdir(Util.CWD);

require('util.promisify').shim();
Util.requireLocal('@travetto/base/bin/bootstrap');

if (!console.debug) { console.debug = () => { }; }

console.log('Initializing');

function readFolder(...paths: string[]) {
  return fs.readdirSync(path.join(__dirname, ...paths))
    .filter(x => !x.endsWith('.map'))
    .map(x => x.replace(/[.](j|t)s$/, ''))
}

const modules = fs.readdirSync(Util.toLocalFile('@travetto')); // All active @travetto module names
const moduleFeatureNames = readFolder('feature'); // All matching @travetto plugin features
const moduleState = modules.reduce((acc, k) => { // All active @travetto modules in node_modules
  acc[k] = true;
  return acc;
}, {});


const moduleFeatures = []; // All load plugin features
for (const key of moduleFeatureNames) {
  if (key in moduleState) {
    for (const sub of readFolder('feature', key)) {
      const res = require(`./feature/${key}/${sub}`);
      if (res) {
        moduleFeatures.push(res);
      }
    }
  }
}

const configSetter = Promise.all([vscode.workspace.getConfiguration()
  .update('travetto.modules', moduleState)])
  .catch(err => {
    console.log(err);
  });

export async function activate(context: vscode.ExtensionContext) {
  moduleFeatures.forEach(mod => mod.activate && mod.activate(context));
}

export function deactivate() {
  moduleFeatures.forEach(mod => mod.deactivate && mod.deactivate());
}