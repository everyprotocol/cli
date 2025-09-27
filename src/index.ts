#!/usr/bin/env node

import { program } from "./program.js";

try {
  await program.parseAsync();
} catch (e: any /* eslint-disable-line */) {
  console.error(e);
  process.exitCode = 1;
}
