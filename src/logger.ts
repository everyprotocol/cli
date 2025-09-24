import * as fs from "fs";
import { stringify as j11 } from "json11";
import path from "path";

export class Logger {
  private quiet: boolean;
  private json: string | boolean;

  constructor(opts: { quiet?: boolean; json?: string | boolean } = {}) {
    this.quiet = opts.quiet ?? !!opts.json;
    this.json = opts.json ?? false;
  }

  log(...args: unknown[]) {
    if (!this.quiet) console.error(...args);
  }

  warn(...args: unknown[]) {
    if (!this.quiet) console.error("[warn]", ...args);
  }

  error(...args: unknown[]) {
    console.error("[error]", ...args);
  }

  result(data: unknown) {
    const opts = {
      quote: `"`,
      quoteNames: true,
      withBigInt: false,
    };

    if (this.json) {
      if (typeof this.json === "string") {
        const dir = path.dirname(this.json);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(this.json, j11(data, opts));
      } else {
        console.log(j11(data, opts)); // stdout
      }
    }
  }
}
