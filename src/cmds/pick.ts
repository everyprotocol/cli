import fs from "node:fs";
import path from "node:path";
import jp from "jsonpath";
import * as _ from "lodash-es";
import { Command } from "commander";

type PickRule = {
  file: string; // relative to --from
  root: string; // JSONPath to the base object
  field: string; // lodash get() path from the root object
};

const DEFAULT_DIR = "./register";

const STATIC_RULES: Record<string, PickRule> = {
  // contract
  "deploy.addr": {
    file: "deploy.json",
    root: "$",
    field: "deployedTo",
  },
  // kind
  "kind.id": { file: "kind.json", root: "$.events[?(@.name=='KindRegistered')].data", field: "id" },
  "kind.rev": { file: "kind.json", root: "$.events[?(@.name=='KindRegistered')].data.desc", field: "rev" },
  "kind.krev": { file: "kind.json", root: "$.events[?(@.name=='KindRegistered')].data.desc", field: "kindRev" },
  "kind.srev": { file: "kind.json", root: "$.events[?(@.name=='KindRegistered')].data.desc", field: "setRev" },
  // set
  "set.id": { file: "set.json", root: "$.events[?(@.name=='SetRegistered')].data", field: "id" },
  "set.rev": { file: "set.json", root: "$.events[?(@.name=='SetRegistered')].data.desc", field: "rev" },
  "set.krev": { file: "set.json", root: "$.events[?(@.name=='SetRegistered')].data.desc", field: "kindRev" },
  "set.srev": { file: "set.json", root: "$.events[?(@.name=='SetRegistered')].data.desc", field: "setRev" },
  // matter: first entry’s MatterRegistered by default
  "matter.hash": { file: "matter.json", root: "$[0].events[?(@.event=='MatterRegistered')].data", field: "1" },
  "matter.who": { file: "matter.json", root: "$[0].events[?(@.event=='MatterRegistered')].data", field: "0" },
};

function dynamicRule(key: string): PickRule | null {
  const esc = (s: string) => s.replace(/'/g, "\\'");
  // hash=<path>  → hashes.json: find by .path and return .hash
  {
    const m = key.match(/^hash=(.+)$/);
    if (m) {
      const filePath = esc(m[1]);
      return {
        file: "hashes.json",
        root: `$[?(@.path=='${filePath}')]`,
        field: "hash",
      };
    }
  }
  // matter.hash=<path> → matter.json: find entry by .file, then MatterRegistered.data[1]
  {
    const m = key.match(/^matter\.hash=(.+)$/);
    if (m) {
      const filePath = esc(m[1]);
      return {
        file: "matter.json",
        root: `$[?(@.file=='${filePath}')].events[?(@.event=='MatterRegistered')].data`,
        field: "1",
      };
    }
  }
  // matter.who=<path> → matter.json: find entry by .file, then MatterRegistered.data[0]
  {
    const m = key.match(/^matter\.who=(.+)$/);
    if (m) {
      const filePath = esc(m[1]);
      return {
        file: "matter.json",
        root: `$[?(@.file=='${filePath}')].events[?(@.event=='MatterRegistered')].data`,
        field: "0",
      };
    }
  }
  return null;
}

function resolveRule(key: string): PickRule {
  let rule = dynamicRule(key);
  if (rule) return rule;

  rule = STATIC_RULES[key];
  if (!rule) throw new Error(`Unknown key: ${key}`);
  return rule;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickOnce(getData: (rel: string) => any, key: string): string {
  const rule = resolveRule(key);
  const data = getData(rule.file);
  const roots = jp.query(data, rule.root);
  if (roots.length === 0) {
    throw new Error(`Root not found for key "${key}": ${rule.root} in ${rule.file}`);
  }

  // Pick the first matched root
  const obj = roots[0];
  const value = rule.field ? _.get(obj, rule.field) : obj;
  if (value === undefined) {
    throw new Error(`Field not found for key "${key}": ${rule.field} in ${rule.file}`);
  }

  return String(value);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadJson(fullPath: string): any {
  const raw = fs.readFileSync(fullPath, "utf8");
  return JSON.parse(raw);
}

export const pickCmd = new Command("pick")
  .description("Pick values from outputs")
  .argument("<keys...>", "Keys to resolve")
  .option("--from <dir>", "Output directory", DEFAULT_DIR)
  .action(function (keys: string[]) {
    const { from } = this.opts<{ from: string }>();
    const dir = from || DEFAULT_DIR;
    const loadJsonCache = _.memoize((rel: string) => {
      const full = path.join(dir, rel);
      return loadJson(full);
    });
    const outputs = keys.map((key) => pickOnce(loadJsonCache, key));
    console.log(outputs.join(" "));
  });
