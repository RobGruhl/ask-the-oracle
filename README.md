# Ask the Oracle

A Claude Code skill for deep code analysis using GPT-5.4 Pro's extended reasoning.

> "I think currently probably state-of-the-art model that I go to is the GPT Pro. And that's a very, very powerful model. So if I actually have 20 minutes, I will copy-paste my entire repo and I go to GPT Pro, the Oracle, for like some questions. And often it's not too bad and surprisingly good compared to what existed a year ago."
>
> -- Andrej Karpathy

## What It Does

1. Packs your code with Repomix (smart file selection, token counting)
2. Submits to GPT-5.4 Pro via OpenAI Responses API
3. Handles 10-20 minute response times with lifecycle commands
4. Warns about sensitive files before sending to third parties
5. Tracks costs and saves consultation history

Claude stays responsive during the wait -- you check on progress when convenient.

## Installation

```bash
# Clone
git clone https://github.com/robgruhl/ask-the-oracle.git \
  ~/.claude/skills/ask-the-oracle

# Install dependencies
cd ~/.claude/skills/ask-the-oracle && npm install

# Configure
cp .oraclerc.example .oraclerc
# Edit .oraclerc with your OpenAI API key
```

Note: `.oraclerc` goes in the **project root** where you run the Oracle, not in the skill directory. The config file supports `//` and `#` comments.

### Prerequisites

- Node.js 18+ (or Bun 1.0+)
- OpenAI API key with GPT-5.4 Pro access

## Usage

Ask Claude naturally:

```
"Ask the Oracle to review my authentication code for security issues"
"I have a memory leak. Ask the Oracle for deep analysis."
"Ask the Oracle how to optimize the database queries in services/"
```

### CLI Commands

The Oracle supports lifecycle commands for fine-grained control:

```bash
# Estimate cost before submitting
node skills/ask-the-oracle/scripts/oracle.js estimate "src/**/*.js"

# Submit and get request ID immediately (no waiting)
node skills/ask-the-oracle/scripts/oracle.js submit --yes "src/**/*.js" -- "Review this code"

# Submit reusing packed artifact from estimate (avoids double-packing)
node skills/ask-the-oracle/scripts/oracle.js submit --yes \
  --artifact=/tmp/oracle-context-xxx.xml --context-hash=abc123 \
  "src/**/*.js" -- "Review this code"

# Check status of a running request
node skills/ask-the-oracle/scripts/oracle.js status <requestId>

# Retrieve completed response
node skills/ask-the-oracle/scripts/oracle.js retrieve <requestId>

# Cancel a running request
node skills/ask-the-oracle/scripts/oracle.js cancel <requestId>

# List recent request manifests
node skills/ask-the-oracle/scripts/oracle.js list

# Clean up stale artifact files from /tmp
node skills/ask-the-oracle/scripts/oracle.js cleanup

# Combined flow: submit, wait, and present (detaches on timeout)
node skills/ask-the-oracle/scripts/oracle.js ask --yes "src/**/*.js" -- "Review this code"

# Cancel on timeout instead of detaching
node skills/ask-the-oracle/scripts/oracle.js ask --yes --cancel-on-timeout "src/**/*.js" -- "Review this code"
```

All commands support `--json` for machine-readable output with a versioned envelope.

### JSON API

All `--json` responses use a consistent envelope:

```json
{ "schemaVersion": 1, "ok": true, "command": "estimate", "data": { ... } }
{ "schemaVersion": 1, "ok": false, "command": "submit", "error": { "code": "COST_LIMIT_EXCEEDED", "message": "..." } }
```

Error codes: `CONFIG_NOT_FOUND`, `CONFIG_INVALID`, `CONFIG_PARSE_ERROR`, `NO_PROVIDER`, `VALIDATION_ERROR`, `COST_LIMIT_EXCEEDED`, `CONTEXT_TOO_LARGE`, `PROVIDER_ERROR`, `TIMEOUT`, `REMOTE_FAILED`, `REMOTE_CANCELLED`.

## Configuration

Create `.oraclerc` in your project root (see `.oraclerc.example`):

```json
{
  "defaultProvider": "openai",
  "providers": {
    "openai": {
      "apiKey": "$OPENAI_API_KEY",
      "model": "gpt-5.4-pro",
      "maxWaitMinutes": 25,
      "enabled": true
    }
  },
  "limits": {
    "maxCostPerRequest": 10.00,
    "warnCostThreshold": 5.00
  }
}
```

## Cost

| Scope | Estimated Cost |
|-------|----------------|
| Small module | $0.50 - $1.50 |
| Subsystem | $2.00 - $4.00 |
| Large codebase | $5.00 - $10.00 |

Pricing: $30/M input, $180/M output (GPT-5.4 Pro, March 2026)

## Project Structure

```
ask-the-oracle/
├── skills/ask-the-oracle/
│   ├── SKILL.md                 # Skill manifest
│   └── scripts/
│       ├── oracle.js            # CLI entry point
│       ├── oracle-service.js    # Oracle class & business logic
│       ├── repomix-wrapper.js   # Code packing
│       ├── config-validator.js  # Config validation
│       ├── cost-calculator.js   # Cost estimation
│       ├── tests/run-tests.js   # Test suite
│       └── providers/
│           ├── base-provider.js # Provider interface
│           ├── openai.js        # OpenAI implementation
│           └── registry.js      # Provider management
├── .claude-plugin/plugin.json   # Plugin manifest
├── .oraclerc.example            # Config template
├── docs/REFERENCES.md           # Links to upstream docs
└── package.json
```

## Troubleshooting

**No files matched** -- Use quotes around globs: `"src/**/*.js"`. Check `.gitignore` exclusions.

**Invalid API key** -- Verify `OPENAI_API_KEY` env var or key in `.oraclerc`. Confirm GPT-5.4 Pro access.

**Timeout** -- By default, `ask` detaches on timeout (the request keeps running in background). Use `--cancel-on-timeout` for old cancel behavior. You can also increase `maxWaitMinutes` in `.oraclerc`, or use `submit` + `status` + `retrieve` instead. Also consider `sdkTimeoutMinutes` for synchronous requests.

**Plugin not loading** -- Restart Claude Code. Check `~/.claude/skills/ask-the-oracle/` exists.

**Config parse error** -- `.oraclerc` now supports `//` and `#` comments. If you have other comment styles, switch to `//`.

## Upgrading

```bash
cd ~/.claude/skills/ask-the-oracle
git pull origin main && npm install
```

## License

MIT

## Acknowledgments

- **Andrej Karpathy** for the Oracle concept
- **Repomix** for codebase packaging
- **OpenAI** for GPT-5.4 Pro and Responses API
- **Anthropic** for Claude Code

---

**Version**: 1.4.0 | **Last Updated**: 2026-03-15
