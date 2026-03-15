/**
 * Repomix Wrapper
 *
 * Handles code packing using Repomix library.
 * Provides token counting and selective file inclusion.
 */

import { runCli } from 'repomix';
import { readFile } from 'fs/promises';
import { join } from 'path';

export class RepomixWrapper {
  constructor(config) {
    this.config = config || {
      style: 'xml',
      compress: true,
      includeLineNumbers: true,
      removeComments: false
    };
  }

  /**
   * Pack selected files/patterns into AI-friendly format
   * @param {string[]} patterns - Glob patterns
   * @param {string} workingDir - Working directory (default: cwd)
   * @param {Object} options - Additional repomix options
   * @returns {Promise<Object>} Result with output path, token count, file count
   */
  async pack(patterns, workingDir = process.cwd(), options = {}) {
    const outputPath = options.output || join('/tmp', `oracle-context-${Date.now()}.xml`);

    try {
      // Convert patterns to array if needed
      const patternArray = Array.isArray(patterns) ? patterns : [patterns];

      // Helper to attempt packing with a given include format
      const attemptPack = async (include) => {
        return await runCli(
          ['.'],  // Current directory to scan
          workingDir,
          {
            output: outputPath,
            include,
            style: this.config.style,
            compress: this.config.compress,
            outputShowLineNumbers: this.config.includeLineNumbers,
            removeComments: this.config.removeComments,
            tokenCount: true,
            quiet: true,
            ...options
          }
        );
      };

      // Try comma-separated string first (current repomix version expects this)
      let result;
      try {
        result = await attemptPack(patternArray.join(','));
      } catch (error) {
        // If that fails, try array format (future repomix versions may prefer this)
        if (error.message.includes('split is not a function')) {
          result = await attemptPack(patternArray);
        } else {
          throw error;
        }
      }

      return {
        outputPath,
        tokenCount: result.packResult?.totalTokens || 0,
        fileCount: result.packResult?.totalFiles || 0,
        files: Object.entries(result.packResult?.fileTokenCounts || {}).map(([path, tokens]) => ({
          path,
          tokens,
          characters: result.packResult?.fileCharCounts?.[path] || 0
        })),
        totalCharacters: result.packResult?.totalCharacters || 0
      };
    } catch (error) {
      throw new Error(`Repomix packing failed: ${error.message}`);
    }
  }

  /**
   * Read the packed context from file
   * @param {string} outputPath - Path to packed file
   * @returns {Promise<string>} Packed context
   */
  async readPacked(outputPath) {
    try {
      return await readFile(outputPath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read packed context: ${error.message}`);
    }
  }

  /**
   * Pack and read in one operation
   * @param {string[]} patterns - Glob patterns
   * @param {string} workingDir - Working directory
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} { context, metadata }
   */
  async packAndRead(patterns, workingDir = process.cwd(), options = {}) {
    const result = await this.pack(patterns, workingDir, options);
    const context = await this.readPacked(result.outputPath);

    return {
      context,
      metadata: {
        tokenCount: result.tokenCount,
        fileCount: result.fileCount,
        files: result.files,
        outputPath: result.outputPath
      }
    };
  }

}
