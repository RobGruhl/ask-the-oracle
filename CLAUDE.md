# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ask the Oracle is a Claude Code skill that enables deep code analysis by consulting GPT-5.4 Pro via OpenAI. The project uses Repomix to package code and the OpenAI Responses API for analysis requests.

**Current Status**: V1.4 production-ready. Distributed as a Claude Code plugin.

## Core Architecture

### Service Layer

**oracle-service.js** (`scripts/oracle-service.js`): Business logic — `Oracle` class, `OracleError` with typed error codes, `stripJsonComments()`, JSON envelope helpers (`buildEnvelope`, `buildErrorEnvelope`), `EXIT_CODES`, `SENSITIVE_PATTERNS`.

### CLI Layer

**oracle.js** (`scripts/oracle.js`): Presentation only — `parseArgs()`, `jsonOut()`, `jsonError()`, `confirmPrompt()`, `showHelp()`, `showSensitiveWarning()`, `main()`. Imports Oracle from oracle-service.js.

### Provider System

- **BaseProvider** (`providers/base-provider.js`): Abstract interface all providers implement
- **OpenAI Provider** (`providers/openai.js`): GPT-5.4 Pro via Responses API. Configurable SDK timeout via `sdkTimeoutMinutes`.
- **Provider Registry** (`providers/registry.js`): Manages provider instances and selection

### Key Components

1. **RepomixWrapper** (`repomix-wrapper.js`): Packs selected files into AI-friendly format with token counting
2. **ConfigValidator** (`config-validator.js`): Validates `.oraclerc` configuration
3. **CostCalculator** (`cost-calculator.js`): Estimates and calculates costs with provider-specific pricing

### Skill Integration

- **SKILL.md** (`skills/ask-the-oracle/SKILL.md`): Skill manifest — instructs Claude to use `--json` lifecycle commands with versioned envelope
- **plugin.json** (`.claude-plugin/plugin.json`): Plugin marketplace metadata

## JSON API

All `--json` output uses a versioned envelope:

```json
{ "schemaVersion": 1, "ok": true, "command": "estimate", "data": { ... } }
{ "schemaVersion": 1, "ok": false, "command": "submit", "error": { "code": "...", "message": "...", "details": {} } }
```

### Error Codes

| Code | Exit | When |
|------|------|------|
| CONFIG_NOT_FOUND | 2 | `.oraclerc` missing |
| CONFIG_INVALID | 2 | Validation fails |
| CONFIG_PARSE_ERROR | 2 | JSON parse failure |
| NO_PROVIDER | 2 | No providers configured |
| VALIDATION_ERROR | 3 | Missing patterns/question, no files matched |
| COST_LIMIT_EXCEEDED | 3 | Cost exceeds limit |
| CONTEXT_TOO_LARGE | 3 | Input tokens exceed provider's context window |
| PROVIDER_ERROR | 4 | API error from provider |
| TIMEOUT | 5 | Poll exceeded maxWaitMinutes (only with `--cancel-on-timeout`, and only when estimated cost is below warn threshold) |
| REMOTE_FAILED | 6 | Provider returned failed |
| REMOTE_CANCELLED | 6 | Provider returned cancelled |

## Common Development Commands

```bash
# Run tests (zero external dependencies, mock providers)
npm test

# Estimate cost (returns artifactPath + contextHash for submit reuse)
node skills/ask-the-oracle/scripts/oracle.js estimate "src/**/*.js"

# Submit reusing artifact from estimate (no double-pack)
node skills/ask-the-oracle/scripts/oracle.js submit --yes --json \
  --artifact=/tmp/oracle-context-xxx.xml --context-hash=abc123 \
  "src/**/*.js" -- "Review this code"

# Submit without artifact (packs fresh)
node skills/ask-the-oracle/scripts/oracle.js submit --yes --json "src/**/*.js" -- "Review this code"

# Check status / retrieve / cancel
node skills/ask-the-oracle/scripts/oracle.js status <requestId>
node skills/ask-the-oracle/scripts/oracle.js retrieve <requestId>
node skills/ask-the-oracle/scripts/oracle.js cancel <requestId>

# Combined flow (submit + wait + present, detaches on timeout)
node skills/ask-the-oracle/scripts/oracle.js ask --yes "src/**/*.js" -- "Review this code"

# Combined flow with cancel-on-timeout (old behavior)
node skills/ask-the-oracle/scripts/oracle.js ask --yes --cancel-on-timeout "src/**/*.js" -- "Review this code"

# List recent request manifests
node skills/ask-the-oracle/scripts/oracle.js list --json

# Clean up stale /tmp artifacts
node skills/ask-the-oracle/scripts/oracle.js cleanup

# Install dependencies
npm install

# Set up configuration
cp .oraclerc.example .oraclerc  # then edit with your API key
```

## Configuration

The project uses `.oraclerc` in the project root (see `.oraclerc.example`). Supports `//` and `#` comments.

- `defaultProvider`: Which provider to use (currently "openai")
- `providers`: API keys, models, and settings per provider
  - `sdkTimeoutMinutes`: HTTP timeout for synchronous requests (default: SDK default ~10 min)
  - `maxWaitMinutes`: Max polling time for background requests (default: 120 min)
- `repomix`: Code packing options (style, compression, line numbers)
- `limits`: `maxCostPerRequest` ($10 default), `warnCostThreshold` ($5 default)
- `ui`: History saving and progress display settings

API keys support environment variable references (`$OPENAI_API_KEY`).

## Security Assumptions

This project assumes:

1. **Single-user machine**: Only the current user has access to the filesystem. Packed source code artifacts (`/tmp/oracle-context-*.xml`) and consultation history (`.claude/oracle-history/`) are stored as plaintext with standard user permissions.

2. **API privacy**: Source code is sent to OpenAI via their API. Review OpenAI's data retention and privacy policies for your use case.

If either assumption does not hold, you will need to:

- **Shared machine**: Add restrictive file permissions (`chmod 600`) to artifacts and history, or encrypt at rest. Consider a private temp directory instead of `/tmp`.
- **Sensitive code**: The sensitive-file warning (`.env`, `.pem`, `.key`, credentials) is a filename-pattern check only — it will not catch secrets embedded in normal source files. Add content-level scanning if needed.

## Cost Management

- **Estimation**: Before submission, estimate cost from token count
- **Warnings**: Warn if cost exceeds `warnCostThreshold`
- **Limits**: Block if cost exceeds `maxCostPerRequest`
- **Actual Cost**: After completion, display real cost breakdown
- **Privacy**: Sensitive files (.env, .pem, .key, credentials) trigger warnings before submission

GPT-5.4 Pro pricing (March 2026): $30/M input, $180/M output

## Project Structure

```
ask-the-oracle/
├── skills/ask-the-oracle/           # Skill implementation
│   ├── SKILL.md                     # Skill manifest for Claude Code
│   └── scripts/
│       ├── oracle.js                # CLI entry point (presentation only)
│       ├── oracle-service.js        # Oracle class, OracleError, helpers
│       ├── repomix-wrapper.js       # Code packing
│       ├── config-validator.js      # Config validation
│       ├── cost-calculator.js       # Cost estimation
│       ├── tests/
│       │   └── run-tests.js         # Test suite (80 tests)
│       └── providers/
│           ├── base-provider.js     # Abstract provider interface
│           ├── openai.js            # OpenAI implementation
│           └── registry.js          # Provider management
├── .claude-plugin/
│   └── plugin.json                  # Plugin manifest (only file per spec)
├── .oraclerc.example               # Configuration template
├── package.json                     # Dependencies
└── docs/
    └── REFERENCES.md                # Links to upstream docs
```

## Key Dependencies

- **repomix** (^1.12.0): Code packing and token counting
- **openai** (^6.29.0): OpenAI API client with Responses API support
- **chalk** (^5.6.2): Terminal colors and formatting
- **ora** (^9.3.0): Terminal spinners for progress indication

## Important Notes

- **Test Suite**: `npm test` — 80 tests (unit + integration), zero external dependencies (mock providers, no API keys)
- **Node Version**: Requires Node.js 18+ or Bun 1.0+
- **API Keys**: Never commit `.oraclerc` with real API keys (it's in `.gitignore`)
- **History**: Consultations saved to `.claude/oracle-history/oracle-<requestId>.json`
- **Manifests**: Request manifests saved alongside history as `manifest-<requestId>.json`
- **Detach-on-Timeout**: Default behavior on timeout is to detach (request keeps running). Use `--cancel-on-timeout` for cancel behavior, but expensive requests (estimated cost >= warn threshold) will detach instead of cancel to prevent accidental loss of in-flight work.
- **JSON Mode**: All CLI commands support `--json` for structured output (versioned envelope, used by SKILL.md)
