# Repomix Documentation Reference

## Overview

Repomix is a powerful tool that packs your entire repository into a single, AI-friendly file, perfect for feeding your codebase to Large Language Models.

**GitHub**: https://github.com/yamadashy/repomix
**Website**: https://repomix.com

## Installation

```bash
npm install repomix
```

## Command Line Options

### Output Format Options

Supports multiple output formats via the `--style` flag:
- `xml` (default) - Best for LLM consumption
- `markdown`
- `json`
- `plain`

The `--parsable-style` option escapes special characters to ensure valid XML/Markdown when code contains formatting-breaking syntax.

### File Selection & Filtering

- `--include <patterns>`: Target specific files with glob patterns
- `-i, --ignore <patterns>`: Exclude additional files
- `--no-gitignore`: Disable automatic .gitignore rules
- `--no-dot-ignore`: Disable .ignore file rules
- `--no-default-patterns`: Skip built-in exclusions (node_modules, .git, etc.)

### Compression & Content Control

- `--compress`: Extract essential code structure (classes, functions, interfaces) via Tree-sitter parsing
- `--remove-comments`: Strip code comments
- `--remove-empty-lines`: Delete blank lines
- `--truncate-base64`: Reduce output by shortening base64 strings

### Output Destination & Analysis

- `-o, --output <file>`: Specify output file path
- `--stdout`: Write directly to standard output
- `--token-count-tree [threshold]`: Display file tree with token metrics
- `--copy`: Transfer results to system clipboard

### Practical CLI Example

```bash
repomix --include "src/**/*.ts" --compress -o output.json --style json
```

This command processes TypeScript files, applies structural extraction, and exports JSON format.

## Using Repomix as a Library

### Installation

```bash
npm install repomix
```

### Core API Methods

#### runCli Function

The primary method mimics command-line functionality:

```javascript
import { runCli } from 'repomix';

const result = await runCli(
  ['./src', './tests'],  // paths
  process.cwd(),         // working directory
  {
    output: 'output.xml',
    style: 'xml',
    compress: true,
    quiet: true
  }
);

console.log('Files processed:', result.fileCount);
console.log('Total tokens:', result.tokenCount);
```

#### Low-Level Components

Repomix exposes modular functions for granular control:
- `searchFiles()` - Locates files matching criteria
- `collectFiles()` - Gathers file contents
- `processFiles()` - Applies transformations
- `TokenCounter` - Calculates token usage for different models

### Key Configuration Options

The `CliOptions` object supports:

```javascript
{
  output: 'path/to/output.xml',    // destination file path
  style: 'xml',                     // format type (xml|markdown|json|plain)
  compress: true,                   // reduces output size
  quiet: true,                      // suppresses console output
  remote: 'https://github.com/...',// processes external repositories via URL
  include: ['src/**/*.js'],         // glob patterns to include
  ignore: ['**/*.test.js'],         // glob patterns to exclude
  outputShowLineNumbers: true,      // include line numbers in output
  removeComments: false,            // strip comments
  removeEmptyLines: false,          // remove blank lines
  tokenCount: true                  // calculate token metrics
}
```

### Result Data

Pack results provide actionable metrics:

```javascript
{
  fileCount: 42,
  totalCharacters: 125430,
  totalTokens: 31250,
  files: [
    {
      path: 'src/main.js',
      characters: 5420,
      tokens: 1355
    },
    // ... more files
  ]
}
```

### Practical Library Example

```javascript
import { runCli } from 'repomix';

async function packCodeForLLM(filePaths, options = {}) {
  const result = await runCli(filePaths, process.cwd(), {
    output: '/tmp/llm-context.xml',
    style: 'xml',
    compress: true,
    outputShowLineNumbers: true,
    tokenCount: true,
    quiet: true,
    ...options
  });

  return {
    outputPath: '/tmp/llm-context.xml',
    tokenCount: result.totalTokens,
    fileCount: result.fileCount,
    files: result.files
  };
}

// Usage
const context = await packCodeForLLM(['./src', './lib'], {
  include: ['**/*.js', '**/*.ts'],
  ignore: ['**/*.test.js']
});

console.log(`Packed ${context.fileCount} files (${context.tokenCount} tokens)`);
```

## Token Counting

Repomix uses tiktoken for accurate token counting, essential for LLM context planning:

```bash
# Display token count per file in tree format
repomix --token-count-tree
```

Output example:
```
src/
├── main.js (1,355 tokens)
├── utils.js (842 tokens)
└── config.js (234 tokens)
```

## Output Formats Comparison

### XML (Recommended for LLMs)

```xml
<file path="src/main.js">
<content>
// code here
</content>
</file>
```

Best for:
- Maximum LLM comprehension
- Preserving structure
- Parsing and processing

### Markdown

```markdown
# src/main.js

```javascript
// code here
```
```

Best for:
- Human readability
- Documentation
- GitHub/web display

### JSON

```json
{
  "files": [
    {
      "path": "src/main.js",
      "content": "// code here"
    }
  ]
}
```

Best for:
- Programmatic processing
- API integration
- Custom tooling

## Best Practices for "Ask the Oracle"

1. **Use XML format** - Best LLM comprehension
2. **Enable compression** - Reduces tokens by 30-50%
3. **Include line numbers** - Enables precise code references
4. **Calculate tokens first** - Use `--token-count-tree` to preview
5. **Be selective** - Use `--include` patterns to target relevant files
6. **Remove noise** - Consider `--remove-comments` for token savings

## Token Estimation Guide

Rough estimates:
- 1 line of code ≈ 10-20 tokens
- 1 file (200 lines) ≈ 2,000-4,000 tokens
- 1 module (10 files) ≈ 20,000-40,000 tokens

Compression can reduce by 30-50% depending on code verbosity.

## Security Considerations

- Repomix operates fully offline after installation
- No data collection, transmission, or storage
- Respects .gitignore by default
- Consider excluding sensitive files:
  ```bash
  repomix --ignore "**/.env" --ignore "**/credentials.json"
  ```

## Common Issues

### Large repositories exceeding token limits

Solution: Use selective inclusion
```bash
repomix --include "src/core/**/*.js" --include "src/api/**/*.js" --compress
```

### Code contains special XML characters

Solution: Use `--parsable-style` to escape special characters

### Need to process remote repository

Solution: Use `--remote` option
```javascript
await runCli([], process.cwd(), {
  remote: 'https://github.com/user/repo',
  output: 'remote-repo.xml'
});
```

## Integration with Ask the Oracle

Recommended configuration for Oracle skill:

```javascript
const oracleRepomixConfig = {
  style: 'xml',                 // Best for GPT-5 Pro
  compress: true,               // Reduce tokens
  outputShowLineNumbers: true,  // Enable precise references
  tokenCount: true,             // For cost estimation
  removeComments: false,        // Keep context (optional)
  removeEmptyLines: true,       // Minor token savings
  quiet: true                   // Clean output
};
```

Workflow integration:
1. User selects files/patterns
2. Run `--token-count-tree` to estimate cost
3. Confirm with user if cost acceptable
4. Pack with `runCli()` using config above
5. Read output file for Oracle submission
