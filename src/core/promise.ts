import { EventEmitter } from 'events';

/**
 * Standard promise support
 */
export class Promises {
  /**
   * Build one-time promise from an event
   */
  static fromEvent<U = void>() {
    const emitter = new EventEmitter();
    const prom = new Promise<U>((resolve, reject) => {
      emitter.addListener('reject', reject);
      emitter.addListener('resolve', resolve);
    });

    const cancel = () => emitter.emit('reject', new Error('Cancelled'));
    return { stream: emitter, promise: prom, cancel };
  }

  /**
   * Make an extendable timeout
   * @param delay 
   */
  static extendableTimeout(delay: number = 20000) {
    const { stream, promise } = Promises.fromEvent();

    let ref: NodeJS.Timer;
    const extend = (again: boolean = true) => {
      if (ref) {
        clearTimeout(ref);
      }
      if (again) {
        ref = setTimeout(() => {
          const err = new Error('Timeout');
          (err as any).fatal = true;
          stream.emit('reject', err);
        }, delay);
      }
    };
    return { promise, extend: extend.bind(null, true), cancel: extend.bind(null, false) };
  }
}