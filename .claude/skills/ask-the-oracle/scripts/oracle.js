#!/usr/bin/env node

/**
 * Ask the Oracle - Main Orchestrator
 *
 * Consults premium AI models for deep code analysis.
 * Inspired by Andrej Karpathy's approach of using GPT-5 Pro as an "Oracle".
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { registry } from './providers/registry.js';
import { RepomixWrapper } from './repomix-wrapper.js';
import { CostCalculator } from './cost-calculator.js';

class Oracle {
  constructor(configPath = '.oraclerc') {
    this.configPath = configPath;
    this.config = null;
    this.provider = null;
  }

  /**
   * Initialize Oracle by loading configuration
   */
  async init() {
    this.config = await this.loadConfig();
    this.provider = registry.getDefault(this.config);

    if (!this.provider) {
      throw new Error(
        'No Oracle providers configured. Please set up .oraclerc with your API keys.\n' +
        'See .oraclerc.example for template.'
      );
    }

    return this;
  }

  /**
   * Load configuration from .oraclerc
   */
  async loadConfig() {
    const configPath = join(process.cwd(), this.configPath);

    if (!existsSync(configPath)) {
      throw new Error(
        `.oraclerc not found. Please create ${configPath}\n` +
        'See .oraclerc.example for template.'
      );
    }

    try {
      const content = await readFile(configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load .oraclerc: ${error.message}`);
    }
  }

  /**
   * Main method: Ask the Oracle a question about code
   * @param {Object} options
   * @param {string[]} options.patterns - File patterns to include
   * @param {string} options.question - Question to ask
   * @param {boolean} options.skipConfirmation - Skip cost confirmation
   * @returns {Promise<Object>} Oracle response
   */
  async ask({ patterns, question, skipConfirmation = false }) {
    console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║      CONSULTING THE ORACLE...         ║'));
    console.log(chalk.bold.cyan('╚═══════════════════════════════════════╝\n'));

    // Phase 1: Pack code with Repomix
    const spinner = ora('Packing code with Repomix...').start();

    const repomix = new RepomixWrapper(this.config.repomix);
    let packedResult;

    try {
      packedResult = await repomix.packAndRead(patterns);
      spinner.succeed(
        `Packed ${chalk.yellow(packedResult.metadata.fileCount)} files ` +
        `(${chalk.yellow(packedResult.metadata.tokenCount.toLocaleString())} tokens)`
      );
    } catch (error) {
      spinner.fail(`Failed to pack code: ${error.message}`);
      throw error;
    }

    // Phase 2: Estimate cost
    const estimate = CostCalculator.estimateCost(
      this.provider,
      packedResult.metadata.tokenCount,
      8000 // Default expected output
    );

    console.log(CostCalculator.formatEstimate(estimate, this.config.limits));

    // Check limits
    const limitCheck = CostCalculator.checkLimits(
      estimate.estimatedCost,
      this.config.limits
    );

    if (!limitCheck.withinLimit) {
      console.log(chalk.red.bold(`\n❌ ${limitCheck.message}`));
      throw new Error('Cost limit exceeded');
    }

    if (limitCheck.warning) {
      console.log(chalk.yellow.bold(`\n⚠️  ${limitCheck.message}`));
    }

    // Confirmation (can be skipped for automation)
    if (!skipConfirmation) {
      // For MVP, we'll skip interactive confirmation
      // In full version, use inquirer here
      console.log(chalk.gray('\n(Skipping confirmation for MVP)\n'));
    }

    // Phase 3: Submit to Oracle
    console.log(chalk.bold(`\nSubmitting to ${this.provider.getDisplayName()}...`));

    let response;
    const startTime = Date.now();

    try {
      response = await this.provider.submit(
        packedResult.context,
        question,
        {
          temperature: this.config.providers[this.provider.getName()]?.temperature
        }
      );

      console.log(chalk.green(`✓ Submitted (Request ID: ${response.id})`));
    } catch (error) {
      console.log(chalk.red(`✗ Submission failed: ${error.message}`));
      throw error;
    }

    // Phase 4: Poll for completion
    response = await this.pollForCompletion(response.id, startTime);

    // Phase 5: Save to history
    await this.saveToHistory(response, {
      question,
      patterns,
      packedMetadata: packedResult.metadata
    });

    return response;
  }

  /**
   * Poll for Oracle response completion
   * @param {string} requestId - Request ID
   * @param {number} startTime - Request start time
   * @returns {Promise<Object>} Completed response
   */
  async pollForCompletion(requestId, startTime) {
    const maxWaitMinutes = this.config.providers[this.provider.getName()]?.maxWaitMinutes || 25;
    const maxWaitMs = maxWaitMinutes * 60 * 1000;
    const pollInterval = 3000; // 3 seconds

    console.log(chalk.gray(`\n⏳ Oracle is thinking... (may take up to ${maxWaitMinutes} minutes)\n`));

    const spinner = ora('Polling for response...').start();
    let lastUpdateTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      let response;
      try {
        response = await this.provider.poll(requestId);
      } catch (error) {
        spinner.fail(`Polling error: ${error.message}`);
        throw error;
      }

      // Update spinner text every minute
      if (Date.now() - lastUpdateTime > 60000) {
        const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
        spinner.text = `Status: ${response.status} (${elapsed} min elapsed)`;
        lastUpdateTime = Date.now();
      }

      // Check terminal states
      if (response.status === 'completed') {
        const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
        spinner.succeed(`Response received after ${chalk.yellow(elapsed + ' minutes')}!`);
        response.metadata.elapsed = Date.now() - startTime;
        return response;
      } else if (response.status === 'failed') {
        spinner.fail('Oracle request failed');
        throw new Error(`Oracle failed: ${response.error || 'Unknown error'}`);
      } else if (response.status === 'cancelled') {
        spinner.fail('Oracle request was cancelled');
        throw new Error('Request cancelled');
      }

      // Status is queued or in_progress, continue polling
    }

    spinner.fail(`Timeout: exceeded ${maxWaitMinutes} minutes`);
    throw new Error(`Oracle request timeout after ${maxWaitMinutes} minutes`);
  }

  /**
   * Save Oracle consultation to history
   * @param {Object} response - Oracle response
   * @param {Object} metadata - Additional metadata
   */
  async saveToHistory(response, metadata) {
    if (!this.config.ui?.saveHistory) {
      return;
    }

    const historyDir = join(
      process.cwd(),
      this.config.ui.historyPath || '.claude/oracle-history'
    );

    // Create history directory if it doesn't exist
    try {
      await mkdir(historyDir, { recursive: true });
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not create history directory: ${error.message}`));
      return;
    }

    // Create history entry
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const historyFile = join(historyDir, `oracle-${timestamp}.json`);

    const historyEntry = {
      timestamp: new Date().toISOString(),
      question: metadata.question,
      patterns: metadata.patterns,
      packedFiles: metadata.packedMetadata.fileCount,
      inputTokens: response.usage.inputTokens,
      provider: response.metadata.provider,
      model: response.metadata.model,
      cost: response.cost,
      elapsed: response.metadata.elapsed,
      requestId: response.id,
      response: response.output,
      usage: response.usage
    };

    try {
      await writeFile(historyFile, JSON.stringify(historyEntry, null, 2));
      console.log(chalk.gray(`\nHistory saved to: ${historyFile}`));
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not save history: ${error.message}`));
    }
  }

  /**
   * Present Oracle response to user
   * @param {Object} response - Oracle response
   */
  presentResponse(response) {
    console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║         ORACLE RESPONSE READY         ║'));
    console.log(chalk.bold.cyan('╚═══════════════════════════════════════╝\n'));

    console.log(chalk.bold('Provider:'), chalk.cyan(response.metadata.provider));
    console.log(chalk.bold('Model:'), chalk.cyan(response.metadata.model));
    console.log(chalk.bold('Time elapsed:'), chalk.yellow(
      (response.metadata.elapsed / 60000).toFixed(1) + ' minutes'
    ));

    // Cost breakdown
    const actual = CostCalculator.calculateActual(response);
    console.log(CostCalculator.formatActual(actual));

    console.log(chalk.bold('\nResponse:\n'));
    console.log(chalk.gray('━'.repeat(80)));
    console.log(response.output);
    console.log(chalk.gray('━'.repeat(80)));
  }
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    console.log(chalk.bold('\nAsk the Oracle - Consult premium AI models for deep code analysis\n'));
    console.log('Usage:');
    console.log('  node oracle.js <patterns> -- <question>');
    console.log('\nExample:');
    console.log('  node oracle.js "src/**/*.js" "docs/**/*.md" -- "How can I improve this codebase?"\n');
    return;
  }

  // Parse arguments (patterns before --, question after --)
  const separatorIndex = args.indexOf('--');

  if (separatorIndex === -1) {
    console.error(chalk.red('Error: Please separate patterns and question with --'));
    console.log('Example: node oracle.js "src/**/*.js" -- "Your question here"');
    process.exit(1);
  }

  const patterns = args.slice(0, separatorIndex);
  const question = args.slice(separatorIndex + 1).join(' ');

  if (patterns.length === 0) {
    console.error(chalk.red('Error: No file patterns specified'));
    process.exit(1);
  }

  if (!question) {
    console.error(chalk.red('Error: No question specified'));
    process.exit(1);
  }

  try {
    const oracle = await new Oracle().init();
    const response = await oracle.ask({ patterns, question, skipConfirmation: true });
    oracle.presentResponse(response);
  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${error.message}`));
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { Oracle };
