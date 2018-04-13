export function log(...args: any[]) {
  if (console.debug) {
    console.debug(...args);
  }
}