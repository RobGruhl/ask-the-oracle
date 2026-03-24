#!/usr/bin/env node

/**
 * Ask the Oracle - CLI Entry Point
 *
 * Presentation layer only: argument parsing, JSON envelopes, human output.
 * Business logic lives in oracle-service.js.
 */

import { createInterface } from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import {
  Oracle,
  OracleError,
  buildEnvelope,
  buildErrorEnvelope,
} from './oracle-service.js';
import { CostCalculator } from './cost-calculator.js';

const VERSION = '1.4.0';
const COMMANDS = ['estimate', 'submit', 'status', 'retrieve', 'cancel', 'ask', 'list', 'cleanup'];

function parseArgs(argv) {
  const flags = { json: false, yes: false, help: false, version: false, cancelOnTimeout: false };
  const positional = [];
  let artifact = null;
  let contextHash = null;
  let continueFrom = null;
  let sourceDir = null;
  const extraContext = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') flags.json = true;
    else if (arg === '--yes') flags.yes = true;
    else if (arg === '--help' || arg === '-h') flags.help = true;
    else if (arg === '--version' || arg === '-v') flags.version = true;
    else if (arg === '--cancel-on-timeout') flags.cancelOnTimeout = true;
    else if (arg.startsWith('--artifact=')) artifact = arg.slice('--artifact='.length);
    else if (arg.startsWith('--context-hash=')) contextHash = arg.slice('--context-hash='.length);
    else if (arg.startsWith('--continue=')) continueFrom = arg.slice('--continue='.length);
    else if (arg.startsWith('--source-dir=')) sourceDir = arg.slice('--source-dir='.length);
    else if (arg.startsWith('--extra-context=')) extraContext.push(arg.slice('--extra-context='.length));
    else positional.push(arg);
  }

  let command = 'ask';
  if (positional.length > 0 && COMMANDS.includes(positional[0])) {
    command = positional.shift();
  }

  const sepIndex = positional.indexOf('--');
  let patterns = [];
  let question = '';
  let requestId = null;

  if (['status', 'retrieve', 'cancel'].includes(command)) {
    requestId = positional[0] || null;
  } else if (sepIndex >= 0) {
    patterns = positional.slice(0, sepIndex);
    question = positional.slice(sepIndex + 1).join(' ');
  } else {
    patterns = positional;
  }

  return { command, flags, patterns, question, requestId, artifact, contextHash, continueFrom, sourceDir, extraContext };
}

function jsonOut(command, data) {
  console.log(JSON.stringify(buildEnvelope(command, data), null, 2));
}

function jsonError(command, error) {
  console.log(JSON.stringify(buildErrorEnvelope(command, error), null, 2));
}

async function confirmPrompt(message) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

function timeSince(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function showHelp() {
  console.log(chalk.bold('\nAsk the Oracle - Deep code analysis with GPT-5.4 Pro\n'));
  console.log('Commands:');
  console.log('  estimate  <patterns>              Pack files and show cost estimate');
  console.log('  submit    <patterns> -- <question> Submit and return request ID immediately');
  console.log('  status    <requestId>              Check request status');
  console.log('  retrieve  <requestId>              Get completed response');
  console.log('  cancel    <requestId>              Cancel a running request');
  console.log('  ask       <patterns> -- <question> Submit, wait, and show response (default)');
  console.log('  list                               List recent request manifests');
  console.log('  cleanup                            Remove stale artifact files from /tmp');
  console.log('\nFlags:');
  console.log('  --json                     Machine-readable JSON output (versioned envelope)');
  console.log('  --yes                      Skip cost confirmation prompt');
  console.log('  --artifact=<path>          Reuse packed artifact from estimate (submit only)');
  console.log('  --context-hash=<hash>      Validate cached artifact (submit only)');
  console.log('  --continue=<requestId>     Continue conversation from a previous response');
  console.log('  --source-dir=<path>        Pack files from a different directory (default: cwd)');
  console.log('  --extra-context=<file>     Include extra context file (repeatable, prepended to code)');
  console.log('  --cancel-on-timeout        Cancel request on timeout instead of detaching (ask only)');
  console.log('  --help                     Show this help');
  console.log('  --version                  Show version');
  console.log('\nExamples:');
  console.log('  node oracle.js estimate "src/**/*.js"');
  console.log('  node oracle.js submit --yes "src/**/*.js" -- "Review this code"');
  console.log('  node oracle.js submit --yes --continue=resp_abc123 -- "Follow up question"');
  console.log('  node oracle.js status resp_abc123');
  console.log('  node oracle.js retrieve resp_abc123');
  console.log('  node oracle.js ask --yes "src/**/*.js" -- "How can I improve this?"');
  console.log('\n  Cross-repo with extra context:');
  console.log('  node oracle.js ask --yes --source-dir=~/other-project \\');
  console.log('    --extra-context=./docs/design.md --extra-context=./notes.md \\');
  console.log('    "src/**/*.ts" -- "Analyze this architecture"\n');
}

function showSensitiveWarning(files) {
  if (files.length === 0) return;
  console.log(chalk.red.bold('\n\u26a0\ufe0f  Sensitive files detected \u2014 these will be sent to the provider:'));
  files.forEach(f => console.log(chalk.red(`  - ${f.path}`)));
  console.log();
}

async function main() {
  const { command, flags, patterns, question, requestId, artifact, contextHash, continueFrom, sourceDir, extraContext } = parseArgs(process.argv.slice(2));

  if (flags.version) {
    console.log(VERSION);
    return;
  }

  if (flags.help || (command === 'ask' && patterns.length === 0 && extraContext.length === 0 && !requestId)) {
    showHelp();
    return;
  }

  try {
    const oracle = await new Oracle().init();

    // Show config warnings in human mode
    if (!flags.json) {
      const warnings = oracle.getWarnings();
      if (warnings.length > 0) {
        console.log(chalk.yellow('\n\u26a0\ufe0f  Configuration warnings:'));
        warnings.forEach(w => console.log(chalk.yellow(`  - ${w}`)));
        console.log();
      }
    }

    switch (command) {

      // -- estimate --------------------------------------------------------
      case 'estimate': {
        const spinnerLabel = patterns.length > 0 ? 'Packing code with Repomix...' : 'Preparing context...';
        const spinner = !flags.json ? ora(spinnerLabel).start() : null;
        const result = await oracle.estimate({ patterns, sourceDir, extraContext });
        spinner?.succeed(`Packed ${result.fileCount} files (${result.tokenCount.toLocaleString()} tokens)`);

        if (flags.json) {
          jsonOut(command, result);
        } else {
          console.log(CostCalculator.formatEstimate(result.estimate, oracle.config.limits, oracle.provider));
          if (result.tokenCheck && !result.tokenCheck.withinLimit) {
            console.log(chalk.red.bold(`  Context too large: ${result.tokenCheck.message}`));
          } else if (result.tokenCheck) {
            console.log(chalk.gray(`  Token headroom: ${result.tokenCheck.headroom.toLocaleString()} tokens remaining`));
          }
          showSensitiveWarning(result.sensitiveFiles);
        }
        break;
      }

      // -- submit ----------------------------------------------------------
      case 'submit': {
        // Skip estimate/confirm for continuations — no packing involved
        if (!continueFrom && !flags.yes && !flags.json) {
          const spinnerLabel = patterns.length > 0 ? 'Packing code with Repomix...' : 'Preparing context...';
          const spinner = ora(spinnerLabel).start();
          const est = await oracle.estimate({ patterns, sourceDir, extraContext });
          spinner.succeed(`Packed ${est.fileCount} files (${est.tokenCount.toLocaleString()} tokens)`);
          console.log(CostCalculator.formatEstimate(est.estimate, oracle.config.limits, oracle.provider));
          showSensitiveWarning(est.sensitiveFiles);

          if (!est.limitCheck.withinLimit) {
            throw new OracleError('COST_LIMIT_EXCEEDED', `Cost limit exceeded: ${est.limitCheck.message}`);
          }
          if (est.limitCheck.warning) {
            console.log(chalk.yellow.bold(`\u26a0\ufe0f  ${est.limitCheck.message}`));
          }

          const confirmed = await confirmPrompt(
            chalk.cyan.bold(`\ud83d\udcb0 Proceed with consultation (est. $${est.estimate.estimatedCost.toFixed(2)})? (y/N): `)
          );
          if (!confirmed) {
            console.log(chalk.yellow('\nCancelled.\n'));
            return;
          }
        }

        if (!flags.json) {
          if (continueFrom) {
            console.log(chalk.bold(`\nContinuing conversation from ${continueFrom.slice(0, 20)}...`));
          } else {
            console.log(chalk.bold(`\nSubmitting to ${oracle.provider.getDisplayName()}...`));
          }
        }

        const result = await oracle.submit({ patterns, question, artifactPath: artifact, contextHash, continueFrom, sourceDir, extraContext });

        if (flags.json) {
          jsonOut(command, result);
        } else {
          console.log(chalk.green(`\u2713 Submitted (Request ID: ${result.requestId})`));
          if (result.historyFile) console.log(chalk.gray(`History: ${result.historyFile}`));
          console.log(chalk.cyan(`\nCheck status:  node oracle.js status ${result.requestId}`));
          console.log(chalk.cyan(`Get response:  node oracle.js retrieve ${result.requestId}`));
          console.log(chalk.cyan(`Cancel:        node oracle.js cancel ${result.requestId}\n`));
        }
        break;
      }

      // -- status ----------------------------------------------------------
      case 'status': {
        if (!requestId) {
          throw new OracleError('VALIDATION_ERROR', 'No request ID specified. Usage: oracle.js status <requestId>');
        }

        const response = await oracle.status(requestId);

        if (flags.json) {
          jsonOut(command, { requestId, status: response.status, usage: response.usage, cost: response.cost });
        } else {
          const color = response.status === 'completed' ? chalk.green :
                        response.status === 'failed' ? chalk.red : chalk.yellow;
          console.log(`Status: ${color(response.status)}`);
          if (response.usage?.inputTokens > 0) {
            console.log(`Tokens: ${response.usage.inputTokens} in / ${response.usage.outputTokens} out`);
          }
          if (response.status === 'completed') {
            console.log(chalk.cyan(`\nRetrieve with: node oracle.js retrieve ${requestId}\n`));
          }
        }
        break;
      }

      // -- retrieve --------------------------------------------------------
      case 'retrieve': {
        if (!requestId) {
          throw new OracleError('VALIDATION_ERROR', 'No request ID specified. Usage: oracle.js retrieve <requestId>');
        }

        const response = await oracle.retrieve(requestId);

        if (flags.json) {
          jsonOut(command, {
            requestId, status: response.status, output: response.output,
            usage: response.usage, cost: response.cost
          });
        } else if (response.status !== 'completed') {
          console.log(chalk.yellow(`Request not yet completed (status: ${response.status})`));
          console.log(chalk.cyan(`Try again later: node oracle.js retrieve ${requestId}\n`));
        } else {
          console.log(chalk.bold.cyan('\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557'));
          console.log(chalk.bold.cyan('\u2551         ORACLE RESPONSE READY         \u2551'));
          console.log(chalk.bold.cyan('\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d\n'));

          const actual = CostCalculator.calculateActual(response, oracle.provider);
          console.log(CostCalculator.formatActual(actual));
          console.log(chalk.gray('\u2501'.repeat(80)));
          console.log(response.output);
          console.log(chalk.gray('\u2501'.repeat(80)));
        }
        break;
      }

      // -- cancel ----------------------------------------------------------
      case 'cancel': {
        if (!requestId) {
          throw new OracleError('VALIDATION_ERROR', 'No request ID specified. Usage: oracle.js cancel <requestId>');
        }

        const success = await oracle.cancel(requestId);

        if (flags.json) {
          jsonOut(command, { requestId, cancelled: success });
        } else if (success) {
          console.log(chalk.green(`\u2713 Request ${requestId} cancelled`));
        } else {
          console.log(chalk.yellow(`Could not cancel request ${requestId}`));
        }
        break;
      }

      // -- ask (default: submit + wait + present) -------------------------
      case 'ask': {
        if (patterns.length === 0 && extraContext.length === 0) {
          throw new OracleError('VALIDATION_ERROR', 'No file patterns or extra-context specified');
        }
        if (!question) {
          throw new OracleError('VALIDATION_ERROR', 'No question specified (use -- to separate patterns from question)');
        }

        // Phase 1: Estimate
        if (!flags.json) {
          console.log(chalk.bold.cyan('\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557'));
          console.log(chalk.bold.cyan('\u2551      CONSULTING THE ORACLE...         \u2551'));
          console.log(chalk.bold.cyan('\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d\n'));
        }

        const askSpinnerLabel = patterns.length > 0 ? 'Packing code with Repomix...' : 'Preparing context...';
        const spinner = !flags.json ? ora(askSpinnerLabel).start() : null;
        const est = await oracle.estimate({ patterns, sourceDir, extraContext });
        spinner?.succeed(`Packed ${est.fileCount} files (${est.tokenCount.toLocaleString()} tokens)`);

        if (!flags.json) {
          console.log(CostCalculator.formatEstimate(est.estimate, oracle.config.limits, oracle.provider));
          showSensitiveWarning(est.sensitiveFiles);
        }

        if (!est.limitCheck.withinLimit) {
          throw new OracleError('COST_LIMIT_EXCEEDED', `Cost limit exceeded: ${est.limitCheck.message}`);
        }

        // Phase 2: Confirm
        if (!flags.yes && !flags.json) {
          if (est.limitCheck.warning) {
            console.log(chalk.yellow.bold(`\u26a0\ufe0f  ${est.limitCheck.message}`));
          }
          const confirmed = await confirmPrompt(
            chalk.cyan.bold(`\ud83d\udcb0 Proceed (est. $${est.estimate.estimatedCost.toFixed(2)})? (y/N): `)
          );
          if (!confirmed) {
            console.log(chalk.yellow('\nCancelled.\n'));
            return;
          }
        }

        // Phase 3: Submit (reuse artifact from estimate)
        if (!flags.json) console.log(chalk.bold(`\nSubmitting to ${oracle.provider.getDisplayName()}...`));

        const submitResult = await oracle.submit({
          patterns,
          question,
          artifactPath: est.artifactPath,
          contextHash: est.contextHash,
          sourceDir,
          extraContext,
        });

        if (!flags.json) {
          console.log(chalk.green(`\u2713 Submitted (Request ID: ${submitResult.requestId})`));
          if (submitResult.historyFile) console.log(chalk.gray(`History: ${submitResult.historyFile}`));
        }

        // SIGINT handler — detach instead of cancel
        const sigintHandler = () => {
          console.log(chalk.yellow('\n\nDetaching from Oracle request (still running in background).'));
          console.log(chalk.cyan(`  Check status:  node oracle.js status ${submitResult.requestId}`));
          console.log(chalk.cyan(`  Get response:  node oracle.js retrieve ${submitResult.requestId}`));
          console.log(chalk.cyan(`  Cancel:        node oracle.js cancel ${submitResult.requestId}\n`));
          process.exit(130);
        };
        process.on('SIGINT', sigintHandler);

        // Phase 4: Wait
        let waitSpinner;
        if (!flags.json) {
          const maxMin = oracle.config.providers[oracle.provider.getName()]?.maxWaitMinutes || 25;
          console.log(chalk.gray(`\n\u23f3 Oracle is thinking... (may take up to ${maxMin} minutes)\n`));
          waitSpinner = ora('Polling for response...').start();
        }

        try {
          const completed = await oracle.waitForCompletion(submitResult.requestId, {
            cancelOnTimeout: flags.cancelOnTimeout,
            onStatus: ({ status, elapsed, backoffMs }) => {
              if (!waitSpinner) return;
              if (backoffMs) {
                waitSpinner.text = `Rate limited, backing off ${(backoffMs / 1000).toFixed(0)}s...`;
              } else if (elapsed > 60000) {
                waitSpinner.text = `Status: ${status} (${(elapsed / 60000).toFixed(1)} min elapsed)`;
              }
            }
          });

          // Handle detach-on-timeout
          if (completed.status === 'detached') {
            if (waitSpinner) {
              waitSpinner.info('Timeout reached — detaching (request still running in background).');
            }
            if (flags.json) {
              jsonOut(command, {
                requestId: submitResult.requestId,
                status: 'detached',
                provider: submitResult.provider,
              });
            } else {
              console.log(chalk.cyan(`\n  Check status:  node oracle.js status ${submitResult.requestId}`));
              console.log(chalk.cyan(`  Get response:  node oracle.js retrieve ${submitResult.requestId}`));
              console.log(chalk.cyan(`  Cancel:        node oracle.js cancel ${submitResult.requestId}\n`));
            }
            break;
          }

          if (waitSpinner) {
            const elapsed = (completed.metadata.elapsed / 60000).toFixed(1);
            waitSpinner.succeed(`Response received after ${chalk.yellow(elapsed + ' minutes')}!`);
          }

          // Save final history
          await oracle.saveToHistory(completed, {
            question, patterns,
            packedMetadata: { fileCount: est.fileCount, tokenCount: est.tokenCount }
          });

          // Phase 5: Present
          if (flags.json) {
            jsonOut(command, {
              requestId: submitResult.requestId,
              status: 'completed',
              output: completed.output,
              usage: completed.usage,
              cost: completed.cost,
              elapsed: completed.metadata.elapsed,
              provider: submitResult.provider
            });
          } else {
            console.log(chalk.bold.cyan('\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557'));
            console.log(chalk.bold.cyan('\u2551         ORACLE RESPONSE READY         \u2551'));
            console.log(chalk.bold.cyan('\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d\n'));

            console.log(chalk.bold('Provider:'), chalk.cyan(completed.metadata.provider));
            console.log(chalk.bold('Model:'), chalk.cyan(completed.metadata.model));
            console.log(chalk.bold('Time elapsed:'), chalk.yellow(
              (completed.metadata.elapsed / 60000).toFixed(1) + ' minutes'
            ));

            const actual = CostCalculator.calculateActual(completed, oracle.provider);
            console.log(CostCalculator.formatActual(actual));

            console.log(chalk.gray('\u2501'.repeat(80)));
            console.log(completed.output);
            console.log(chalk.gray('\u2501'.repeat(80)));
          }
        } finally {
          process.removeListener('SIGINT', sigintHandler);
        }
        break;
      }
      // -- list ------------------------------------------------------------
      case 'list': {
        const manifests = await oracle.listManifests();

        if (flags.json) {
          jsonOut(command, { requests: manifests });
        } else if (manifests.length === 0) {
          console.log(chalk.gray('\nNo request manifests found.\n'));
        } else {
          console.log(chalk.bold('\nRecent Oracle Requests:\n'));
          for (const m of manifests) {
            const statusColor = m.status === 'completed' ? chalk.green :
                                m.status === 'failed' ? chalk.red :
                                m.status === 'cancelled' ? chalk.gray : chalk.yellow;
            const shortId = m.requestId.length > 20 ? m.requestId.slice(0, 20) + '...' : m.requestId;
            const ago = m.submittedAt ? timeSince(m.submittedAt) : 'unknown';
            const preview = (m.question || '').slice(0, 50) + ((m.question || '').length > 50 ? '...' : '');
            console.log(`  ${statusColor(m.status.padEnd(12))} ${chalk.cyan(shortId.padEnd(24))} ${chalk.gray(ago.padEnd(10))} ${preview}`);
          }
          console.log();
        }
        break;
      }

      // -- cleanup ---------------------------------------------------------
      case 'cleanup': {
        const cleaned = await oracle.cleanupStaleArtifacts();

        if (flags.json) {
          jsonOut(command, { cleanedCount: cleaned });
        } else {
          console.log(chalk.green(`\nCleaned ${cleaned} stale artifact file(s) from /tmp.\n`));
        }
        break;
      }
    }
  } catch (error) {
    const exitCode = error instanceof OracleError ? error.exitCode : 1;
    if (flags.json) {
      jsonError(command, error);
    } else {
      console.error(chalk.red(`\n\u274c Error: ${error.message}`));
    }
    process.exit(exitCode);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { parseArgs };
