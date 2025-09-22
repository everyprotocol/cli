import "commander";

declare module "commander" {
  interface Command {
    addKeystoreOptions(): this;
    addWriteOptions(): this;
    addOutputOptions(): this;

    addOptions(options: import("commander").Option[]): this;
    addCommands(commands: import("commander").Command[]): this;
    addArguments(arguments: import("commander").Argument[]): this;

    subReadAction(fn: SubReadAction): this;
    subWriteAction(fn: SubWriteAction): this;
  }
}

// eslint-disable-next-line
export type SubReadAction = (this: Command, api: ApiPromise, ...args: any[]) => void | Promise<void>;

export type SubWriteAction = (
  this: Command,
  api: ApiPromise,
  pair: KeyringPair,
  ...args: any[] /* eslint-disable-line */
) => void | Promise<void>;
