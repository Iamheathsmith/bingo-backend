export const log = (...args) =>
  process.env.DEBUG === 'true' ? console.log(...args) : null;

export const logError = (...args) =>
  process.env.DEBUG === 'true' ? console.error(...args) : null;
