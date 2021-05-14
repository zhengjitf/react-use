import { Dispatch, SetStateAction, useCallback, useState } from 'react';
import useLatest from '../useLatest'
import useUpdateEffect from '../useUpdateEffect'
import { isBrowser, noop } from '../misc/util';

type parserOptions<T> =
  | {
      raw: true;
    }
  | {
      raw: false;
      serializer: (value: T) => string;
      deserializer: (value: string) => T;
    };

const createStorage = (storageFactory: (() => Storage) = () => localStorage) => {
  return <T>(
    key: string,
    initialValue?: T,
    options?: parserOptions<T>
  ): [T | undefined, Dispatch<SetStateAction<T | undefined>>, () => void] => {
    if (!isBrowser) {
      return [initialValue as T, noop, noop];
    }
    if (!key) {
      throw new Error('useLocalStorage key may not be falsy');
    }

    const storage = useState(() => storageFactory())[0]

    const latestKey = useLatest(key)

    const deserializer = options
      ? options.raw
        ? (value: string) => value
        : options.deserializer
      : JSON.parse;

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const initializer = useLatest((key: string) => {
      try {
        const serializer = options ? (options.raw ? String : options.serializer) : JSON.stringify;

        const localStorageValue = localStorage.getItem(key);
        if (localStorageValue !== null) {
          return deserializer(localStorageValue);
        } else {
          initialValue && localStorage.setItem(key, serializer(initialValue));
          return initialValue;
        }
      } catch {
        // If user is in private mode or has storage restriction
        // localStorage can throw. JSON.parse and JSON.stringify
        // can throw, too.
        return initialValue;
      }
    });

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [state, setState] = useState<T | undefined>(() => initializer.current(key));
    const latestState = useLatest(state)

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useUpdateEffect(() => setState(initializer.current(key)), [key]);

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const set: Dispatch<SetStateAction<T | undefined>> = useCallback(
      (valOrFunc) => {
        try {
          const newState =
            typeof valOrFunc === 'function' ? (valOrFunc as Function)(latestState.current) : valOrFunc;
          if (typeof newState === 'undefined') return;
          let value: string;

          if (options)
            if (options.raw)
              if (typeof newState === 'string') value = newState;
              else value = JSON.stringify(newState);
            else if (options.serializer) value = options.serializer(newState);
            else value = JSON.stringify(newState);
          else value = JSON.stringify(newState);

          storage.setItem(latestKey.current, value);
          setState(deserializer(value));
        } catch {
          // If user is in private mode or has storage restriction
          // localStorage can throw. Also JSON.stringify can throw.
        }
      },
      []
    );

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const remove = useCallback(() => {
      try {
        storage.removeItem(latestKey.current);
        setState(undefined);
      } catch {
        // If user is in private mode or has storage restriction
        // localStorage can throw.
      }
    }, []);

    return [state, set, remove];
  }
};

export default createStorage;
