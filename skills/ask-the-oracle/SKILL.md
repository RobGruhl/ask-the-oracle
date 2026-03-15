---
name: ask-the-oracle
description: Consult GPT-5.4 Pro for deep code analysis that takes 10-20 minutes of extended reasoning. Use this skill whenever the user asks for architecture review, security audit, debugging complex issues, comprehensive code review, performance analysis, or expert-level analysis across multiple files. Also use when the user says "ask the oracle", "deep dive", "deep analysis", "expert analysis", "consult the oracle", or wants a second opinion from another model. Do NOT use for simple questions you can answer directly.
allowed-tools: Read, Grep, Glob, Bash, AskUserQuestion
---

# Ask the Oracle

Consult GPT-5.4 Pro as an "Oracle" for complex code questions requiring 10-20 minutes of deep reasoning.

## JSON API

All `--json` output uses a versioned envelope:

```json
// Success
{ "schemaVersion": 1, "ok": true, "command": "estimate", "data": { ... } }

// Error
{ "schemaVersion": 1, "ok": false, "command": "submit", "error": { "code": "COST_LIMIT_EXCEEDED", "message": "...", "details": {} } }
```

Always check `ok` first. On success, read `data`. On failure, read `error.code` and `error.message`.

## Instructions

### Phase 1: Understand and Select Files

1. Capture the user's question -- what do they want to know, what problem are they solving?
2. Use Glob to identify relevant files matching the question scope
3. Ask user to confirm file selection using AskUserQuestion -- present count, let them refine

### Phase 2: Estimate Cost

Run the estimate command to get structured data:

```bash
cd <project-root> && node ${CLAUDE_SKILL_DIR}/scripts/oracle.js estimate --json <patterns>
```

Parse the JSON envelope. On success, read from `data`:
- `data.fileCount`, `data.tokenCount` -- scope metrics
- `data.estimate` -- cost breakdown
- `data.limitCheck` -- whether cost is within limits
- `data.sensitiveFiles` -- files that will be sent to a third party
- `data.tokenCheck` -- token limit check: `withinLimit`, `headroom`, `message`
- `data.artifactPath` -- path to pre-packed artifact (pass to submit to avoid double-packing)
- `data.sidecarPath` -- path to artifact sidecar manifest (metadata for fast reuse)
- `data.contextHash` -- hash to validate the cached artifact

If `data.sensitiveFiles` is non-empty, warn the user that those files will be sent to a third party.

### Phase 3: Confirm with User

1. GPT-5.4 Pro pricing: $30/M input, $180/M output. Typical cost: $2-10.
2. If cost > $5 warn the user. If cost > configured limit, don't proceed without approval.
3. Confirm with user: show estimated cost, remind them it takes ~10-20 minutes.

### Phase 4: Submit

Submit the question, reusing the packed artifact from estimate:

```bash
cd <project-root> && node ${CLAUDE_SKILL_DIR}/scripts/oracle.js submit --yes --json \
  --artifact=<artifactPath> --context-hash=<contextHash> \
  <patterns> -- "<question>"
```

The `--artifact` and `--context-hash` flags reuse the packed context from estimate, avoiding a second Repomix pass.
The `--yes` flag skips the cost prompt (you already confirmed with the user).

Parse the envelope. On success, read `data.requestId`.

Tell the user immediately:
> "Oracle consultation submitted to GPT-5.4 Pro (Request ID: <id>). This takes 10-20 minutes. Ask me 'Check on the Oracle' anytime for status."

### Phase 5: Check Status

When the user checks progress:

```bash
cd <project-root> && node ${CLAUDE_SKILL_DIR}/scripts/oracle.js status --json <requestId>
```

Report `data.status`: `queued`, `in_progress`, `completed`, or `failed`.

### Phase 6: Retrieve and Present Results

When status is `completed`:

```bash
cd <project-root> && node ${CLAUDE_SKILL_DIR}/scripts/oracle.js retrieve --json <requestId>
```

Read `data.output`, `data.usage`, and `data.cost`.

Summarize key findings, highlight actionable recommendations, show cost/time, ask about follow-ups.

### Error Handling

All errors return an envelope with `ok: false`. Check `error.code`:

| Code | Exit | Meaning |
|------|------|---------|
| CONFIG_NOT_FOUND | 2 | `.oraclerc` missing -- tell user to `cp .oraclerc.example .oraclerc` |
| CONFIG_INVALID | 2 | Config validation failed |
| CONFIG_PARSE_ERROR | 2 | JSON parse error in `.oraclerc` |
| NO_PROVIDER | 2 | No providers configured |
| VALIDATION_ERROR | 3 | Missing patterns/question, no files matched |
| COST_LIMIT_EXCEEDED | 3 | Cost exceeds configured limit -- suggest reducing file scope |
| CONTEXT_TOO_LARGE | 3 | Input tokens exceed provider's context window -- reduce file scope |
| PROVIDER_ERROR | 4 | API error from provider -- check API key, connectivity |
| TIMEOUT | 5 | Polling exceeded maxWaitMinutes (only with `--cancel-on-timeout`) |
| REMOTE_FAILED | 6 | Provider returned failed |
| REMOTE_CANCELLED | 6 | Provider returned cancelled |

To cancel: `node ${CLAUDE_SKILL_DIR}/scripts/oracle.js cancel <requestId>`

## Important Notes

- **Cost**: Typically $0.05-$2 per request depending on codebase size and response length
- **Time**: 10-20 minutes (GPT-5.4 Pro extended reasoning)
- **Privacy**: Code is sent to OpenAI (retained per their policy)
- **Security assumptions**: Designed for a single-user machine. Artifacts and history are stored as plaintext. See CLAUDE.md "Security Assumptions" for details.
- **History**: Saved to `.claude/oracle-history/`
- **Config**: `.oraclerc` in project root (see `.oraclerc.example`). Supports `//` and `#` comments.

## Configuration

Users need `.oraclerc` in their project root:

```json
{
  "defaultProvider": "openai",
  "providers": {
    "openai": {
      "apiKey": "$OPENAI_API_KEY",
      "model": "gpt-5.4-pro",
      "enabled": true
    }
  },
  "limits": {
    "maxCostPerRequest": 10.00,
    "warnCostThreshold": 5.00
  }
}
```

