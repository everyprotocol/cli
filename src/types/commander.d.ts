import "commander";

declare module "commander" {
  interface Command {
    /** RPC/url + network context */
    // networkOptions(): this;
    /** keys, accounts, derivation, etc. */
    accountOptions(): this;
    writeContractOptions(): this;
    /** logging/verbosity/etc. */
    // commonOptions(): this;

    /** generic: apply any set of Option[] with chaining */
    useOptions(options: import("commander").Option[]): this;
  }
}
