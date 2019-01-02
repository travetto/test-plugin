export class Util {
  // tslint:disable:no-bitwise
  static hash(t: string) { // Hash taken from a stack overflow post
    let hash = 0;
    for (let i = 0; i < t.length; i++) {
      const char = t.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }
  // tslint:enable:no-bitwise
}