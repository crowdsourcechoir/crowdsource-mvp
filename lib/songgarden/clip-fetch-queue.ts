/**
 * Limit concurrent Song Garden clip downloads so a full canvas
 * (50–80 clips) does not stampede /api/songgarden/.../audio + Postgres bytea.
 */
const MAX_CONCURRENT = 4;

let active = 0;
const waiters: Array<() => void> = [];

function pump() {
  while (active < MAX_CONCURRENT && waiters.length > 0) {
    const next = waiters.shift();
    if (next) next();
  }
}

export function enqueueClipFetch<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      active += 1;
      task().then(resolve, reject).finally(() => {
        active -= 1;
        pump();
      });
    };
    if (active < MAX_CONCURRENT) start();
    else waiters.push(start);
  });
}
