/**
 * Base Provider Interface
 *
 * All Oracle providers (OpenAI, Google, Anthropic) must implement this interface.
 * This enables unified interaction regardless of the underlying model API.
 */

export class BaseProvider {
  constructor(config) {
    this.config = config;
  }

  // ============================================================================
  // Identity & Metadata
  // ============================================================================

  /**
   * Get the unique identifier for this provider
   * @returns {string} e.g., 'openai', 'google', 'anthropic'
   */
  getName() {
    throw new Error('getName() must be implemented by subclass');
  }

  /**
   * Get the human-readable display name
   * @returns {string} e.g., 'OpenAI GPT-5 Pro'
   */
  getDisplayName() {
    throw new Error('getDisplayName() must be implemented by subclass');
  }

  /**
   * Get the specific model being used
   * @returns {string} e.g., 'gpt-5-pro', 'gemini-2.0-pro'
   */
  getModelName() {
    throw new Error('getModelName() must be implemented by subclass');
  }

  // ============================================================================
  // Capabilities
  // ============================================================================

  /**
   * Check if this provider supports background/async long-running requests
   * @returns {boolean}
   */
  supportsBackgroundMode() {
    return false;
  }

  /**
   * Get maximum context window size in tokens
   * @returns {number}
   */
  getMaxContextTokens() {
    throw new Error('getMaxContextTokens() must be implemented by subclass');
  }

  /**
   * Get maximum output tokens
   * @returns {number}
   */
  getMaxOutputTokens() {
    throw new Error('getMaxOutputTokens() must be implemented by subclass');
  }

  // ============================================================================
  // Core Operations
  // ============================================================================

  /**
   * Submit a question to the Oracle
   * @param {string} context - Packed codebase context from Repomix
   * @param {string} question - User's formatted question
   * @param {Object} options - Additional options (temperature, maxTokens, etc.)
   * @returns {Promise<Object>} Normalized response object
   */
  async submit(context, question, options = {}) {
    throw new Error('submit() must be implemented by subclass');
  }

  /**
   * Poll for status of a long-running request
   * @param {string} requestId - Unique request identifier
   * @returns {Promise<Object>} Normalized response object with current status
   */
  async poll(requestId) {
    throw new Error('poll() must be implemented by subclass');
  }

  /**
   * Retrieve a completed or in-progress response
   * @param {string} requestId - Unique request identifier
   * @returns {Promise<Object>} Normalized response object
   */
  async retrieve(requestId) {
    throw new Error('retrieve() must be implemented by subclass');
  }

  /**
   * Cancel a running request
   * @param {string} requestId - Unique request identifier
   * @returns {Promise<boolean>} Success status
   */
  async cancel(requestId) {
    throw new Error('cancel() must be implemented by subclass');
  }

  // ============================================================================
  // Cost & Response Normalization
  // ============================================================================

  /**
   * Calculate cost based on token usage
   * @param {Object} usage - Token usage object
   * @param {number} usage.inputTokens
   * @param {number} usage.outputTokens
   * @param {number} [usage.reasoningTokens]
   * @returns {number} Cost in USD
   */
  calculateCost(usage) {
    throw new Error('calculateCost() must be implemented by subclass');
  }

  /**
   * Normalize provider-specific response to unified format
   * @param {Object} rawResponse - Provider-specific response
   * @returns {Object} Normalized response
   */
  normalizeResponse(rawResponse) {
    return {
      id: rawResponse.id || 'unknown',
      status: this._normalizeStatus(rawResponse.status),
      output: this._extractOutput(rawResponse),
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        totalTokens: 0
      },
      cost: 0.0,
      metadata: {
        provider: this.getName(),
        model: this.getModelName(),
        elapsed: 0,
        timestamp: new Date().toISOString()
      }
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Normalize provider-specific status to unified format
   * @private
   */
  _normalizeStatus(status) {
    const statusMap = {
      'completed': 'completed',
      'complete': 'completed',
      'success': 'completed',
      'in_progress': 'in_progress',
      'processing': 'in_progress',
      'running': 'in_progress',
      'queued': 'queued',
      'pending': 'queued',
      'failed': 'failed',
      'error': 'failed',
      'cancelled': 'cancelled',
      'canceled': 'cancelled'
    };

    return statusMap[status?.toLowerCase()] || 'unknown';
  }

  /**
   * Extract output text from provider-specific response
   * @private
   */
  _extractOutput(rawResponse) {
    // Subclasses should override if needed
    return rawResponse.output || rawResponse.text || '';
  }

  /**
   * Resolve API key from config (supports environment variable substitution)
   * @protected
   */
  _resolveApiKey() {
    const key = this.config.apiKey;

    // Check if it's an environment variable reference
    if (key?.startsWith('$')) {
      const envVar = key.substring(1);
      const envValue = process.env[envVar];

      if (!envValue) {
        throw new Error(
          `API key references environment variable ${envVar} which is not set. ` +
          `Please set ${envVar} or provide the API key directly in .oraclerc`
        );
      }

      return envValue;
    }

    if (!key) {
      throw new Error(
        `API key not configured for ${this.getName()} provider. ` +
        `Please set it in .oraclerc`
      );
    }

    return key;
  }
}
