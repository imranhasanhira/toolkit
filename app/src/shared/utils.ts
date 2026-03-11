/**
 * Used purely to help compiler check for exhaustiveness in switch statements,
 * will never execute. See https://stackoverflow.com/a/39419171.
 */
export function assertUnreachable(_: never): never {
  throw Error("This code should be unreachable");
}

/**
 * Allows for throttling a function call while still allowing the last invocation to be executed after the throttle delay ends.
 */
export function throttleWithTrailingInvocation(
  fn: () => void,
  delayInMilliseconds: number,
): ((...args: any[]) => void) & { cancel: () => void } {
  let fnLastCallTime: number | null = null;
  let trailingInvocationTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let isTrailingInvocationPending = false;

  const callFn = () => {
    fnLastCallTime = Date.now();
    fn();
  };

  const throttledFn = () => {
    const currentTime = Date.now();
    const timeSinceLastExecution = fnLastCallTime
      ? currentTime - fnLastCallTime
      : 0;

    const shouldCallImmediately =
      fnLastCallTime === null || timeSinceLastExecution >= delayInMilliseconds;

    if (shouldCallImmediately) {
      callFn();
      return;
    }

    if (!isTrailingInvocationPending) {
      isTrailingInvocationPending = true;
      const remainingDelayTime = Math.max(
        delayInMilliseconds - timeSinceLastExecution,
        0,
      );

      trailingInvocationTimeoutId = setTimeout(() => {
        callFn();
        isTrailingInvocationPending = false;
      }, remainingDelayTime);
    }
  };

  throttledFn.cancel = () => {
    if (trailingInvocationTimeoutId) {
      clearTimeout(trailingInvocationTimeoutId);
      trailingInvocationTimeoutId = null;
    }
    isTrailingInvocationPending = false;
  };

  return throttledFn as typeof throttledFn & { cancel: () => void };
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return `${ms}ms`;
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const minutes = Math.floor(sec / 60);
  const remainingSec = Math.round(sec % 60);
  if (minutes < 60) return `${minutes}m ${remainingSec}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;
  return `${hours}h ${remainingMin}m ${remainingSec}s`;
}
