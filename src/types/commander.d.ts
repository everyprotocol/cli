import "commander";

declare module "commander" {
  interface Command {
    addKeystoreOptions(): this;
    addWriteOptions(): this;
    addOutputOptions(): this;

    addOptions(options: import("commander").Option[]): this;
    addCommands(commands: import("commander").Command[]): this;
    addArguments(arguments: import("commander").Argument[]): this;
  }
}
