type Listener = () => void;

let expired = false;
let epoch = 0;
let waiters: Array<() => void> = [];
const listeners = new Set<Listener>();

const emit = () => listeners.forEach((listener) => listener());

export const subscribeSession = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const isSessionExpired = () => expired;

export const authEpoch = () => epoch;

export const markUnauthorized = () => {
  if (expired) return;
  expired = true;
  emit();
};

export const markAuthorized = () => {
  epoch += 1;
  const released = waiters;
  waiters = [];
  if (expired) {
    expired = false;
    emit();
  }
  released.forEach((resolve) => resolve());
};

export const waitForAuthorization = () =>
  new Promise<void>((resolve) => {
    waiters.push(resolve);
  });
