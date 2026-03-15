/**
 * OpenAI Provider
 *
 * Implements Oracle interface for OpenAI's GPT-5.4 Pro via Responses API
 * Supports background mode for long-running requests (20+ minutes)
 */

import OpenAI from 'openai';
import { BaseProvider } from './base-provider.js';

export class OpenAIProvider extends BaseProvider {
  constructor(config) {
    super(config);

    const apiKey = this._resolveApiKey();
    const sdkTimeout = config.sdkTimeoutMinutes
      ? config.sdkTimeoutMinutes * 60 * 1000
      : undefined;

    this.client = new OpenAI({ apiKey, timeout: sdkTimeout });
    this.model = config.model || 'gpt-5.4-pro';
  }

  // ============================================================================
  // Identity & Metadata
  // ============================================================================

  getName() {
    return 'openai';
  }

  getDisplayName() {
    return `OpenAI ${this.model.toUpperCase()}`;
  }

  getModelName() {
    return this.model;
  }

  // ============================================================================
  // Capabilities
  // ============================================================================

  supportsBackgroundMode() {
    return true;
  }

  getMaxContextTokens() {
    // GPT-5.4 Pro supports up to 200k context
    return 200000;
  }

  getMaxOutputTokens() {
    // GPT-5.4 Pro supports up to 16k output
    return 16000;
  }

  // ============================================================================
  // Core Operations
  // ============================================================================

  async submit(context, question, options = {}) {
    try {
      const combined = `${context}\n\n${question}`;

      // background: true enables server-side queueing for long requests.
      // Set useBackgroundMode: false in .oraclerc for synchronous mode (debugging only).
      const useBackground = this.config.useBackgroundMode !== false;

      const response = await this.client.responses.create({
        model: this.model,
        ...(useBackground ? { background: true, store: true } : {}),
        max_output_tokens: options.maxOutputTokens ?? 16000,
        input: [
          {
            type: 'message',
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: combined
              }
            ]
          }
        ]
      });

      return this.normalizeResponse(response);
    } catch (error) {
      throw new Error(
        `OpenAI API error: ${error.message}\n` +
        `Model: ${this.model}\n` +
        `Status: ${error.status || 'unknown'}`
      );
    }
  }

  async poll(requestId) {
    return this.retrieve(requestId);
  }

  async retrieve(requestId) {
    try {
      const response = await this.client.responses.retrieve(requestId);
      return this.normalizeResponse(response);
    } catch (error) {
      throw new Error(
        `Failed to retrieve OpenAI response: ${error.message}\n` +
        `Request ID: ${requestId}`
      );
    }
  }

  async cancel(requestId) {
    try {
      await this.client.responses.cancel(requestId);
      return true;
    } catch (error) {
      // Cancellation failures are non-critical
      console.warn(`Failed to cancel OpenAI request ${requestId}:`, error.message);
      return false;
    }
  }

  // ============================================================================
  // Cost & Response Normalization
  // ============================================================================

  getPricing() {
    // GPT-5.4 Pro pricing (March 2026)
    return { input: 30.00, output: 180.00, reasoning: 0 };
  }

  calculateCost(usage) {
    const pricing = this.getPricing();

    const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
    const reasoningCost = ((usage.reasoningTokens || 0) / 1_000_000) * pricing.reasoning;
    const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;

    return inputCost + reasoningCost + outputCost;
  }

  normalizeResponse(rawResponse) {
    const usage = {
      inputTokens: rawResponse.usage?.input_tokens || 0,
      outputTokens: rawResponse.usage?.output_tokens || 0,
      reasoningTokens: rawResponse.usage?.output_tokens_details?.reasoning_tokens || 0,
      totalTokens: rawResponse.usage?.total_tokens || 0
    };

    const cost = this.calculateCost(usage);

    // Extract output text from various possible structures
    let output = '';
    if (rawResponse.output && Array.isArray(rawResponse.output)) {
      // Look for message type with content array
      const message = rawResponse.output.find(item => item.type === 'message');
      if (message?.content && Array.isArray(message.content)) {
        // Find output_text or text items in content
        const textItems = message.content.filter(item =>
          item.type === 'output_text' || item.type === 'text'
        );
        output = textItems.map(item => item.text).join('\n');
      } else {
        // Fallback: look for direct text item
        const textOutput = rawResponse.output.find(item => item.type === 'text');
        output = textOutput?.text || '';
      }
    } else if (rawResponse.output?.text) {
      output = rawResponse.output.text;
    }

    return {
      id: rawResponse.id,
      status: this._normalizeStatus(rawResponse.status),
      output,
      usage,
      cost,
      metadata: {
        provider: this.getName(),
        model: this.getModelName(),
        elapsed: 0, // Will be calculated by orchestrator
        timestamp: new Date().toISOString(),
        raw: {
          status: rawResponse.status,
          created: rawResponse.created_at
        }
      }
    };
  }
}
