declare module "json11" {
  export function parse(jsonString: string): unknown;
  export function stringify(value: unknown): string;
}
