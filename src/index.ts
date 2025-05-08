#!/usr/bin/env bun
import { Command } from 'commander';
import { configureCommandsFromAbi } from './autocmd';
import path from 'path';

// Create the main program
const program = new Command()
  .name('every-cli')
  .description('CLI for interacting with Every Protocol contracts')
  .version('0.1.0');

// Example of configuring commands from an ABI file
// You would replace this with actual ABI paths
const abiDir = path.resolve(process.cwd(), 'abis');
const abiFiles = [
  'IElementRegistry.json',
  'IRemoteMintable.json',
  'IObjectMinter.json',
  'IOmniRegistry.json',
  'ISetRegistry.json',
  'IKindRegistry.json'
];

// Configure commands from each ABI file
abiFiles.forEach(abiFile => {
  const abiPath = path.join(abiDir, abiFile);
  configureCommandsFromAbi(program, abiPath);
});

// Parse command line arguments
program.parse();

// If no arguments provided, show help
if (process.argv.length <= 2) {
  program.help();
}
