/**
 * Cost Calculator
 *
 * Estimates and calculates costs for Oracle consultations.
 * Supports multiple providers with different pricing models.
 */

import chalk from 'chalk';

export class CostCalculator {
  /**
   * Estimate cost before submission
   * @param {BaseProvider} provider - Oracle provider
   * @param {number} inputTokens - Estimated input tokens
   * @param {number} expectedOutputTokens - Expected output tokens (estimate)
   * @param {number} reasoningTokens - Expected reasoning tokens (optional)
   * @returns {Object} Cost estimate
   */
  static estimateCost(provider, inputTokens, expectedOutputTokens = 8000, reasoningTokens = 0) {
    const cost = provider.calculateCost({
      inputTokens,
      outputTokens: expectedOutputTokens,
      reasoningTokens
    });

    return {
      provider: provider.getDisplayName(),
      inputTokens,
      expectedOutputTokens,
      reasoningTokens,
      estimatedCost: cost,
      breakdown: {
        input: provider.calculateCost({ inputTokens, outputTokens: 0, reasoningTokens: 0 }),
        output: provider.calculateCost({ inputTokens: 0, outputTokens: expectedOutputTokens, reasoningTokens: 0 }),
        reasoning: provider.calculateCost({ inputTokens: 0, outputTokens: 0, reasoningTokens })
      }
    };
  }

  /**
   * Calculate actual cost from response
   * @param {Object} response - Normalized response from provider
   * @returns {Object} Cost breakdown
   */
  static calculateActual(response) {
    return {
      provider: response.metadata.provider,
      model: response.metadata.model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      reasoningTokens: response.usage.reasoningTokens || 0,
      totalTokens: response.usage.totalTokens,
      actualCost: response.cost,
      breakdown: {
        input: response.cost * (response.usage.inputTokens / (response.usage.totalTokens || 1)),
        output: response.cost * (response.usage.outputTokens / (response.usage.totalTokens || 1)),
        reasoning: response.cost * ((response.usage.reasoningTokens || 0) / (response.usage.totalTokens || 1))
      }
    };
  }

  /**
   * Format cost estimate for display
   * @param {Object} estimate - Cost estimate from estimateCost()
   * @param {Object} limits - Cost limits from config
   * @returns {string} Formatted string
   */
  static formatEstimate(estimate, limits = {}) {
    const { estimatedCost, inputTokens, expectedOutputTokens, reasoningTokens } = estimate;

    let output = `\n${chalk.bold('Cost Estimate:')}\n`;
    output += `  Provider: ${chalk.cyan(estimate.provider)}\n`;
    output += `  Input tokens:    ${chalk.yellow(inputTokens.toLocaleString())} @ $15/M  = ${chalk.green('$' + estimate.breakdown.input.toFixed(2))}\n`;

    if (reasoningTokens > 0) {
      output += `  Reasoning tokens: ${chalk.yellow(reasoningTokens.toLocaleString())} @ $15/M  = ${chalk.green('$' + estimate.breakdown.reasoning.toFixed(2))}\n`;
    }

    output += `  Output tokens:    ${chalk.yellow(expectedOutputTokens.toLocaleString())} @ $120/M = ${chalk.green('$' + estimate.breakdown.output.toFixed(2))}\n`;
    output += `  ${chalk.gray('─'.repeat(60))}\n`;

    // Color code based on limits
    const costStr = '$' + estimatedCost.toFixed(2);
    let coloredCost = costStr;

    if (limits.maxCostPerRequest && estimatedCost > limits.maxCostPerRequest) {
      coloredCost = chalk.red.bold(costStr + ' (EXCEEDS LIMIT!)');
    } else if (limits.warnCostThreshold && estimatedCost > limits.warnCostThreshold) {
      coloredCost = chalk.yellow.bold(costStr + ' (Warning: High Cost)');
    } else {
      coloredCost = chalk.green.bold(costStr);
    }

    output += `  ${chalk.bold('Estimated Total:')} ${coloredCost}\n`;

    return output;
  }

  /**
   * Format actual cost for display
   * @param {Object} actual - Actual cost from calculateActual()
   * @returns {string} Formatted string
   */
  static formatActual(actual) {
    let output = `\n${chalk.bold('Actual Cost:')}\n`;
    output += `  Input tokens:    ${chalk.yellow(actual.inputTokens.toLocaleString())} = ${chalk.green('$' + actual.breakdown.input.toFixed(2))}\n`;

    if (actual.reasoningTokens > 0) {
      output += `  Reasoning tokens: ${chalk.yellow(actual.reasoningTokens.toLocaleString())} = ${chalk.green('$' + actual.breakdown.reasoning.toFixed(2))}\n`;
    }

    output += `  Output tokens:    ${chalk.yellow(actual.outputTokens.toLocaleString())} = ${chalk.green('$' + actual.breakdown.output.toFixed(2))}\n`;
    output += `  ${chalk.gray('─'.repeat(60))}\n`;
    output += `  ${chalk.bold('Total Cost:')} ${chalk.green.bold('$' + actual.actualCost.toFixed(2))}\n`;

    return output;
  }

  /**
   * Check if cost is within limits
   * @param {number} cost - Cost to check
   * @param {Object} limits - Limits from config
   * @returns {Object} { withinLimit, exceeded, warning }
   */
  static checkLimits(cost, limits = {}) {
    const result = {
      withinLimit: true,
      exceeded: false,
      warning: false,
      message: ''
    };

    if (limits.maxCostPerRequest && cost > limits.maxCostPerRequest) {
      result.withinLimit = false;
      result.exceeded = true;
      result.message = `Cost $${cost.toFixed(2)} exceeds limit of $${limits.maxCostPerRequest.toFixed(2)}`;
    } else if (limits.warnCostThreshold && cost > limits.warnCostThreshold) {
      result.warning = true;
      result.message = `Cost $${cost.toFixed(2)} exceeds warning threshold of $${limits.warnCostThreshold.toFixed(2)}`;
    }

    return result;
  }

  /**
   * Estimate cost for multiple providers
   * @param {BaseProvider[]} providers - Array of providers
   * @param {number} inputTokens - Input tokens
   * @param {number} expectedOutputTokens - Expected output tokens
   * @returns {Object[]} Array of cost estimates
   */
  static estimateMultiple(providers, inputTokens, expectedOutputTokens = 8000) {
    return providers.map(provider =>
      this.estimateCost(provider, inputTokens, expectedOutputTokens)
    );
  }

  /**
   * Calculate total cost for multiple responses
   * @param {Object[]} responses - Array of normalized responses
   * @returns {Object} Total cost breakdown
   */
  static calculateMultiple(responses) {
    const totals = {
      providers: responses.map(r => r.metadata.provider),
      totalCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalReasoningTokens: 0,
      individual: []
    };

    responses.forEach(response => {
      const actual = this.calculateActual(response);
      totals.totalCost += actual.actualCost;
      totals.totalInputTokens += actual.inputTokens;
      totals.totalOutputTokens += actual.outputTokens;
      totals.totalReasoningTokens += actual.reasoningTokens;
      totals.individual.push(actual);
    });

    return totals;
  }
}
