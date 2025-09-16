#!/usr/bin/env node

import { program } from "./program.js";

try {
  await program.parseAsync();
} catch (e: /*eslint-disable-line @typescript-eslint/no-explicit-any*/ any) {
  console.error(e.message);
  process.exitCode = 1;
}
