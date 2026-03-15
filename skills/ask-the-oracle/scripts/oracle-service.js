/**
 * Ask the Oracle - Service Layer
 *
 * Business logic for deep code analysis consultations.
 * Separated from CLI presentation for testability and reuse.
 */

import { readFile, writeFile, mkdir, readdir, unlink } from 'fs/promises';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { registry } from './providers/registry.js';
import { RepomixWrapper } from './repomix-wrapper.js';
import { CostCalculator } from './cost-calculator.js';
import { ConfigValidator } from './config-validator.js';

// ============================================================================
// Error Codes & Exit Codes
// ============================================================================

const EXIT_CODES = {
  CONFIG_NOT_FOUND:    2,
  CONFIG_INVALID:      2,
  CONFIG_PARSE_ERROR:  2,
  NO_PROVIDER:         2,
  VALIDATION_ERROR:    3,
  COST_LIMIT_EXCEEDED: 3,
  CONTEXT_TOO_LARGE:   3,
  PROVIDER_ERROR:      4,
  TIMEOUT:             5,
  REMOTE_FAILED:       6,
  REMOTE_CANCELLED:    6,
};

class OracleError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'OracleError';
    this.code = code;
    this.details = details;
    this.exitCode = EXIT_CODES[code] || 1;
  }
}

// ============================================================================
// JSON Envelope Helpers
// ============================================================================

function buildEnvelope(command, data) {
  return { schemaVersion: 1, ok: true, command, data };
}

function buildErrorEnvelope(command, error) {
  if (error instanceof OracleError) {
    return {
      schemaVersion: 1,
      ok: false,
      command,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
  }
  return {
    schemaVersion: 1,
    ok: false,
    command,
    error: {
      code: 'UNKNOWN',
      message: error.message || String(error),
      details: {},
    },
  };
}

// ============================================================================
// Comment Stripping
// ============================================================================

/**
 * Strip // and # line comments from JSON text while respecting string boundaries.
 * Handles: "https://..." safely, multiline, trailing commas left as-is.
 */
function stripJsonComments(text) {
  let result = '';
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];

    // String literal — copy verbatim until closing quote
    if (ch === '"') {
      result += ch;
      i++;
      while (i < len) {
        const sc = text[i];
        result += sc;
        i++;
        if (sc === '\\') {
          // Escaped character — copy next char too
          if (i < len) {
            result += text[i];
            i++;
          }
        } else if (sc === '"') {
          break;
        }
      }
      continue;
    }

    // "//" line comment
    if (ch === '/' && i + 1 < len && text[i + 1] === '/') {
      // Skip to end of line
      i += 2;
      while (i < len && text[i] !== '\n') i++;
      continue;
    }

    // "#" line comment (only when not inside a string — already handled above)
    if (ch === '#') {
      // Skip to end of line
      while (i < len && text[i] !== '\n') i++;
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

// ============================================================================
// Sensitive File Patterns
// ============================================================================

const SENSITIVE_PATTERNS = [
  /\.env($|\.)/, /\.pem$/, /\.key$/, /\.p12$/, /\.pfx$/,
  /id_rsa/, /id_ed25519/, /\.secret/, /credentials/i,
];

// ============================================================================
// Oracle Service
// ============================================================================

class Oracle {
  constructor(configPath = '.oraclerc') {
    this.configPath = configPath;
    this.config = null;
    this.provider = null;
  }

  async init() {
    this.config = await this.loadConfig();

    try {
      ConfigValidator.validate(this.config);
    } catch (err) {
      throw new OracleError('CONFIG_INVALID', err.message);
    }

    this.provider = registry.getDefault(this.config);

    if (!this.provider) {
      throw new OracleError(
        'NO_PROVIDER',
        'No Oracle providers configured. Please set up .oraclerc with your API keys.\n' +
        'See .oraclerc.example for template.'
      );
    }

    return this;
  }

  async loadConfig() {
    const configPath = join(process.cwd(), this.configPath);

    if (!existsSync(configPath)) {
      throw new OracleError(
        'CONFIG_NOT_FOUND',
        `.oraclerc not found. Please create ${configPath}\n` +
        'See .oraclerc.example for template.'
      );
    }

    const content = await readFile(configPath, 'utf-8');
    const stripped = stripJsonComments(content);

    try {
      return JSON.parse(stripped);
    } catch (err) {
      throw new OracleError(
        'CONFIG_PARSE_ERROR',
        `Failed to parse .oraclerc: ${err.message}\nFile: ${configPath}`
      );
    }
  }

  getWarnings() {
    return ConfigValidator.getWarnings(this.config);
  }

  checkSensitiveFiles(files) {
    return files.filter(f =>
      SENSITIVE_PATTERNS.some(pattern => pattern.test(f.path))
    );
  }

  /**
   * Pack files and estimate cost (no submission).
   * Returns artifactPath and contextHash for reuse by submit().
   */
  async estimate({ patterns }) {
    if (!patterns || patterns.length === 0) {
      throw new OracleError('VALIDATION_ERROR', 'No file patterns specified. Usage: oracle.js estimate <patterns>');
    }

    const repomix = new RepomixWrapper(this.config.repomix);
    const packed = await repomix.packAndRead(patterns);

    const estimate = CostCalculator.estimateCost(
      this.provider, packed.metadata.tokenCount
    );

    const limitCheck = CostCalculator.checkLimits(
      estimate.estimatedCost, this.config.limits
    );

    const sensitive = this.checkSensitiveFiles(packed.metadata.files || []);

    const tokenCheck = CostCalculator.checkTokenLimits(this.provider, packed.metadata.tokenCount);

    // Compute a content hash for cache validation
    const contextHash = createHash('sha256').update(packed.context).digest('hex').slice(0, 16);

    // Write sidecar manifest alongside XML artifact
    const sidecarPath = packed.metadata.outputPath.replace(/\.xml$/, '.manifest.json');
    const sidecar = {
      contextHash,
      tokenCount: packed.metadata.tokenCount,
      fileCount: packed.metadata.fileCount,
      files: packed.metadata.files || [],
      provider: {
        name: this.provider.getName(),
        model: this.provider.getModelName(),
      },
      created: new Date().toISOString(),
    };
    await writeFile(sidecarPath, JSON.stringify(sidecar, null, 2)).catch(() => {});

    // Fire-and-forget cleanup of stale artifacts
    this.cleanupStaleArtifacts().catch(() => {});

    return {
      fileCount: packed.metadata.fileCount,
      tokenCount: packed.metadata.tokenCount,
      files: packed.metadata.files || [],
      estimate,
      limitCheck,
      tokenCheck,
      sensitiveFiles: sensitive,
      provider: {
        name: this.provider.getName(),
        displayName: this.provider.getDisplayName(),
        model: this.provider.getModelName()
      },
      artifactPath: packed.metadata.outputPath,
      sidecarPath,
      contextHash
    };
  }

  /**
   * Pack (or reuse artifact), check limits, and submit question.
   * Returns immediately with requestId.
   *
   * @param {Object} opts
   * @param {string[]} opts.patterns - Glob patterns for file selection
   * @param {string} opts.question - Question to ask the oracle
   * @param {string} [opts.artifactPath] - Pre-packed artifact from estimate()
   * @param {string} [opts.contextHash] - Hash to validate cached artifact
   */
  async submit({ patterns, question, artifactPath, contextHash }) {
    if (!patterns || patterns.length === 0) {
      throw new OracleError('VALIDATION_ERROR', 'No file patterns specified');
    }
    if (!question) {
      throw new OracleError('VALIDATION_ERROR', 'No question specified (use -- to separate patterns from question)');
    }

    const repomix = new RepomixWrapper(this.config.repomix);
    let packed;

    // Try to reuse cached artifact from estimate using sidecar manifest
    if (artifactPath && contextHash) {
      try {
        const sidecarPath = artifactPath.replace(/\.xml$/, '.manifest.json');
        const sidecarContent = await readFile(sidecarPath, 'utf-8').catch(() => null);

        if (sidecarContent) {
          const sidecar = JSON.parse(sidecarContent);
          if (sidecar.contextHash === contextHash) {
            const context = await repomix.readPacked(artifactPath);
            const verifyHash = createHash('sha256').update(context).digest('hex').slice(0, 16);
            if (verifyHash === contextHash) {
              // Full reuse — no Repomix call at all
              packed = {
                context,
                metadata: {
                  tokenCount: sidecar.tokenCount,
                  fileCount: sidecar.fileCount,
                  files: sidecar.files,
                  outputPath: artifactPath,
                },
              };
            }
          }
        }

        // Sidecar missing/invalid — fall back to hash-only validation
        if (!packed) {
          const context = await repomix.readPacked(artifactPath);
          const verifyHash = createHash('sha256').update(context).digest('hex').slice(0, 16);
          if (verifyHash === contextHash) {
            const result = await repomix.pack(patterns);
            packed = { context, metadata: { ...result, outputPath: artifactPath } };
          }
        }
      } catch {
        // Fall through to full pack
      }
    }

    if (!packed) {
      packed = await repomix.packAndRead(patterns);
    }

    if (packed.metadata.fileCount === 0) {
      throw new OracleError('VALIDATION_ERROR', 'No files matched the specified patterns');
    }

    const tokenCheck = CostCalculator.checkTokenLimits(this.provider, packed.metadata.tokenCount);
    if (!tokenCheck.withinLimit) {
      throw new OracleError('CONTEXT_TOO_LARGE', tokenCheck.message, {
        inputTokens: packed.metadata.tokenCount,
        maxContext: tokenCheck.maxContext,
      });
    }

    const estimate = CostCalculator.estimateCost(
      this.provider, packed.metadata.tokenCount
    );

    const limitCheck = CostCalculator.checkLimits(
      estimate.estimatedCost, this.config.limits
    );

    if (!limitCheck.withinLimit) {
      throw new OracleError(
        'COST_LIMIT_EXCEEDED',
        `Cost limit exceeded: ${limitCheck.message}`,
        { estimatedCost: estimate.estimatedCost, limit: this.config.limits?.maxCostPerRequest }
      );
    }

    const sensitive = this.checkSensitiveFiles(packed.metadata.files || []);

    let response;
    try {
      response = await this.provider.submit(
        packed.context, question,
        { temperature: this.config.providers[this.provider.getName()]?.temperature }
      );
    } catch (err) {
      throw new OracleError('PROVIDER_ERROR', err.message);
    }

    const historyFile = await this.saveToHistory(response, {
      question, patterns, packedMetadata: packed.metadata
    }, true);

    await this.saveManifest(response.id, {
      providerName: this.provider.getName(),
      model: this.provider.getModelName(),
      question,
      patterns,
      artifactPath: packed.metadata.outputPath,
      submittedAt: new Date().toISOString(),
      estimatedCost: estimate.estimatedCost,
    });

    return {
      requestId: response.id,
      historyFile,
      estimate,
      limitCheck,
      sensitiveFiles: sensitive,
      packed: { fileCount: packed.metadata.fileCount, tokenCount: packed.metadata.tokenCount },
      provider: {
        name: this.provider.getName(),
        displayName: this.provider.getDisplayName(),
        model: this.provider.getModelName()
      }
    };
  }

  /**
   * Resolve provider for a request — uses manifest if available, falls back to default.
   */
  async _resolveProvider(requestId) {
    const manifest = await this.loadManifest(requestId);
    if (manifest?.providerName) {
      const provider = registry.getByName(this.config, manifest.providerName);
      if (provider) return provider;
    }
    return this.provider;
  }

  /**
   * Check status of a submitted request (single poll)
   */
  async status(requestId) {
    if (!requestId) {
      throw new OracleError('VALIDATION_ERROR', 'No request ID specified. Usage: oracle.js status <requestId>');
    }
    try {
      const provider = await this._resolveProvider(requestId);
      return await provider.retrieve(requestId);
    } catch (err) {
      if (err instanceof OracleError) throw err;
      throw new OracleError('PROVIDER_ERROR', err.message);
    }
  }

  /**
   * Retrieve a response (same as status, but updates history if completed)
   */
  async retrieve(requestId) {
    if (!requestId) {
      throw new OracleError('VALIDATION_ERROR', 'No request ID specified. Usage: oracle.js retrieve <requestId>');
    }

    let response;
    try {
      const provider = await this._resolveProvider(requestId);
      response = await provider.retrieve(requestId);
    } catch (err) {
      if (err instanceof OracleError) throw err;
      throw new OracleError('PROVIDER_ERROR', err.message);
    }

    if (response.status === 'completed') {
      await this.saveToHistory(response, {
        question: '', patterns: [],
        packedMetadata: { fileCount: 0, tokenCount: 0 }
      });
      await this.updateManifestStatus(requestId, 'completed');
    }

    return response;
  }

  /**
   * Cancel a running request
   */
  async cancel(requestId) {
    if (!requestId) {
      throw new OracleError('VALIDATION_ERROR', 'No request ID specified. Usage: oracle.js cancel <requestId>');
    }
    try {
      const provider = await this._resolveProvider(requestId);
      const result = await provider.cancel(requestId);
      await this.updateManifestStatus(requestId, 'cancelled');
      return result;
    } catch (err) {
      if (err instanceof OracleError) throw err;
      throw new OracleError('PROVIDER_ERROR', err.message);
    }
  }

  /**
   * Poll until completion. Calls onStatus callback for progress updates.
   *
   * @param {string} requestId
   * @param {Object} opts
   * @param {Function} [opts.onStatus] - Progress callback
   * @param {boolean} [opts.cancelOnTimeout=false] - If true, cancel on timeout and throw. Default: detach gracefully.
   *   Ignored when a request manifest exists with an estimated cost above the warn threshold
   *   (prevents accidental cancellation of expensive in-flight requests).
   * @param {number} [opts._pollIntervalMs] - Override poll interval (test-only)
   */
  async waitForCompletion(requestId, { onStatus, cancelOnTimeout = false, _pollIntervalMs } = {}) {
    const maxWaitMinutes = this.config.providers[this.provider.getName()]?.maxWaitMinutes || 120;
    const maxWaitMs = maxWaitMinutes * 60 * 1000;
    const pollInterval = _pollIntervalMs ?? 3000;
    const startTime = Date.now();
    let backoffMs = 0;
    let retryCount = 0;

    while (Date.now() - startTime < maxWaitMs) {
      await new Promise(resolve => setTimeout(resolve, pollInterval + backoffMs));

      let response;
      try {
        response = await this.provider.poll(requestId);
        backoffMs = 0;
        retryCount = 0;
      } catch (error) {
        if (error.status === 429 || (error.status >= 500 && error.status < 600)) {
          retryCount++;
          backoffMs = Math.min(30000, 1000 * Math.pow(2, retryCount));
          if (onStatus) onStatus({ status: 'rate_limited', backoffMs, elapsed: Date.now() - startTime });
          continue;
        }
        throw new OracleError('PROVIDER_ERROR', error.message);
      }

      const elapsed = Date.now() - startTime;
      if (onStatus) onStatus({ status: response.status, elapsed });

      if (response.status === 'completed') {
        response.metadata.elapsed = elapsed;
        await this.updateManifestStatus(requestId, 'completed');
        return response;
      } else if (response.status === 'incomplete') {
        response.metadata.elapsed = elapsed;
        await this.updateManifestStatus(requestId, 'incomplete');
        return response;
      } else if (response.status === 'failed') {
        await this.updateManifestStatus(requestId, 'failed');
        throw new OracleError('REMOTE_FAILED', `Oracle failed: ${response.error || 'Unknown error'}`);
      } else if (response.status === 'cancelled') {
        await this.updateManifestStatus(requestId, 'cancelled');
        throw new OracleError('REMOTE_CANCELLED', 'Request cancelled');
      }
    }

    // Timeout — default is to detach (request keeps running server-side)
    if (cancelOnTimeout) {
      // Safety: refuse to cancel if estimated cost is above warn threshold
      const manifest = await this.loadManifest(requestId);
      const warnThreshold = this.config.limits?.warnCostThreshold || 5;
      if (manifest?.estimatedCost && manifest.estimatedCost >= warnThreshold) {
        // Too expensive to cancel — detach instead
        if (onStatus) onStatus({ status: 'detach_override', elapsed: Date.now() - startTime,
          reason: `Estimated cost $${manifest.estimatedCost.toFixed(2)} exceeds warn threshold $${warnThreshold.toFixed(2)} — detaching instead of cancelling` });
      } else {
        await this.provider.cancel(requestId).catch(() => {});
        await this.updateManifestStatus(requestId, 'cancelled');
        throw new OracleError('TIMEOUT', `Oracle request timeout after ${maxWaitMinutes} minutes`);
      }
    }

    // Default: detach gracefully
    return {
      id: requestId,
      status: 'detached',
      output: '',
      usage: {},
      cost: 0,
      metadata: {
        provider: this.provider.getName(),
        model: this.provider.getModelName(),
        elapsed: Date.now() - startTime,
      },
    };
  }

  /**
   * Save consultation to history. Returns history file path.
   */
  async saveToHistory(response, metadata, partial = false) {
    if (!this.config.ui?.saveHistory) return null;

    const historyDir = join(
      process.cwd(),
      this.config.ui.historyPath || '.claude/oracle-history'
    );

    try {
      await mkdir(historyDir, { recursive: true });
    } catch {
      return null;
    }

    const historyFile = join(historyDir, `oracle-${response.id}.json`);

    const entry = {
      timestamp: new Date().toISOString(),
      question: metadata.question,
      patterns: metadata.patterns,
      packedFiles: metadata.packedMetadata.fileCount,
      inputTokens: response.usage?.inputTokens || 0,
      provider: response.metadata?.provider || 'unknown',
      model: response.metadata?.model || 'unknown',
      cost: response.cost || 0,
      elapsed: response.metadata?.elapsed || 0,
      requestId: response.id,
      status: partial ? response.status : 'completed',
      response: response.output || '',
      usage: response.usage || {}
    };

    try {
      await writeFile(historyFile, JSON.stringify(entry, null, 2));
    } catch {
      return null;
    }

    return historyFile;
  }

  // ============================================================================
  // Request Manifests
  // ============================================================================

  _getHistoryDir() {
    return join(
      process.cwd(),
      this.config.ui?.historyPath || '.claude/oracle-history'
    );
  }

  async saveManifest(requestId, { providerName, model, question, patterns, artifactPath, submittedAt, estimatedCost }) {
    const historyDir = this._getHistoryDir();
    try {
      await mkdir(historyDir, { recursive: true });
    } catch {
      return null;
    }

    const manifest = {
      requestId,
      providerName,
      model,
      question,
      patterns,
      artifactPath,
      submittedAt,
      estimatedCost: estimatedCost || null,
      status: 'in_progress',
    };

    const manifestPath = join(historyDir, `manifest-${requestId}.json`);
    try {
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    } catch {
      return null;
    }
    return manifestPath;
  }

  async loadManifest(requestId) {
    const manifestPath = join(this._getHistoryDir(), `manifest-${requestId}.json`);
    try {
      const content = await readFile(manifestPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async updateManifestStatus(requestId, status) {
    const manifest = await this.loadManifest(requestId);
    if (!manifest) return;
    manifest.status = status;
    const manifestPath = join(this._getHistoryDir(), `manifest-${requestId}.json`);
    try {
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    } catch {
      // non-critical
    }
  }

  async listManifests({ limit = 20 } = {}) {
    const historyDir = this._getHistoryDir();
    try {
      const files = await readdir(historyDir);
      const manifests = [];
      for (const file of files) {
        if (!file.startsWith('manifest-') || !file.endsWith('.json')) continue;
        try {
          const content = await readFile(join(historyDir, file), 'utf-8');
          manifests.push(JSON.parse(content));
        } catch {
          // skip corrupt manifests
        }
      }
      manifests.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
      return manifests.slice(0, limit);
    } catch {
      return [];
    }
  }

  // ============================================================================
  // Artifact Cleanup
  // ============================================================================

  async cleanupStaleArtifacts(maxAgeHours = 24) {
    const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;
    let cleaned = 0;
    try {
      const files = await readdir('/tmp');
      for (const file of files) {
        if (!file.startsWith('oracle-context-')) continue;
        const fullPath = join('/tmp', file);
        try {
          const stat = statSync(fullPath);
          if (stat.mtimeMs < cutoff) {
            await unlink(fullPath);
            cleaned++;
          }
        } catch {
          // skip files we can't stat/delete
        }
      }
    } catch {
      // /tmp not readable — unlikely but safe
    }
    return cleaned;
  }
}

export {
  Oracle,
  OracleError,
  EXIT_CODES,
  SENSITIVE_PATTERNS,
  stripJsonComments,
  buildEnvelope,
  buildErrorEnvelope,
};
