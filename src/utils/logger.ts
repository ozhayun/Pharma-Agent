const IS_DEBUG = process.env.IS_DEBUG === 'true';
const DEBUG_COLOR = '\x1b[36m';
const RESET_COLOR = '\x1b[0m';

interface Logger {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

const logger: Logger = {
  log: (...args: unknown[]) => {
    console.log(...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
  debug: (...args: unknown[]) => {
    if (IS_DEBUG) {
      console.log(DEBUG_COLOR, ...args, RESET_COLOR);
    }
  },
};

export default logger;
