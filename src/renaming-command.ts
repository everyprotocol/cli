import { Command, type CommandOptions } from "commander";

export class RenamingCommand extends Command {
  private nameCounts = new Map<string, number>();

  override addCommand(cmd: Command, opts?: CommandOptions): this {
    const originalName = cmd.name();
    const uniqueName = this.getUniqueName(originalName);
    if (originalName !== uniqueName) {
      cmd.name(uniqueName);
    }
    return super.addCommand(cmd, opts);
  }

  addCommands(cmds: Command[]): RenamingCommand {
    cmds.forEach((cmd) => this.addCommand(cmd));
    return this;
  }

  resetCounts(name?: string): void {
    if (name) {
      this.nameCounts.delete(name);
    } else {
      this.nameCounts.clear();
    }
  }

  private getUniqueName(baseName: string): string {
    const count = this.nameCounts.get(baseName) || 0;
    this.nameCounts.set(baseName, count + 1);
    return count === 0 ? baseName : `${baseName}${count + 1}`;
  }
}
