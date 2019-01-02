import { EventEmitter } from 'events';

export class Promises {
  static fromEvent<U = void>() {
    const emitter = new EventEmitter();
    const prom = new Promise<U>((resolve, reject) => {
      emitter.addListener('reject', reject);
      emitter.addListener('resolve', resolve);
    });

    const cancel = () => emitter.emit('reject', new Error('Cancelled'));
    return { stream: emitter, promise: prom, cancel };
  }

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