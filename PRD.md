# Product Requirements Document: Ask the Oracle

## Overview

"Ask the Oracle" is a Claude Code skill that enables developers to submit complex questions about their codebase to premium AI models, inspired by Andrej Karpathy's approach of using GPT-5 Pro as an "Oracle" for deep code questions when willing to wait ~20 minutes for high-quality answers.

**Initial Release (v1.0)**: OpenAI GPT-5 Pro support
**Future Releases**: Multi-model support (Gemini Pro, Claude Opus) with comparative analysis

**Inspiration Quote:**
> "I do think that a lot of the stuff, by the way, continues to improve. So I think currently probably state-of-the-art model that I go to is the GPT-5 Pro. And that's a very, very powerful model. So if I actually have 20 minutes, I will copy-paste my entire repo and I go to GPT-5 Pro, the Oracle, for like some questions. And often it's not too bad and surprisingly good compared to what existed a year ago."
> — Andrej Karpathy

## Core Functionality

### 1. Skill Invocation
- **Type**: Model-invoked Claude Code skill
- **Trigger**: When user asks complex questions about their codebase that require deep analysis
- **Skill Name**: `ask-the-oracle`
- **Location**: `.claude/skills/ask-the-oracle/`

### 2. Workflow

**Single Model (v1.0):**
```
User asks question
    ↓
Claude invokes skill
    ↓
Gather context (interactive file selection)
    ↓
Run Repomix on selected files
    ↓
Formulate question (interactive refinement)
    ↓
Submit to selected Oracle via provider API (background mode)
    ↓
Poll for completion (graceful 20min handling)
    ↓
Calculate cost
    ↓
Present results
```

**Multi-Model (v2.0+):**
```
User asks question
    ↓
Claude invokes skill
    ↓
Gather context (interactive file selection)
    ↓
Run Repomix on selected files
    ↓
Formulate question (interactive refinement)
    ↓
User selects Oracles (GPT-5 Pro, Gemini Pro, Opus, All)
    ↓
Submit to multiple Oracles in parallel
    ↓
Poll each for completion (track individually)
    ↓
Calculate cost per provider
    ↓
Claude Code analyzes and synthesizes responses
    ↓
Present comparative analysis with best insights
```

## Detailed Requirements

### Phase 1: Context Collection

**Requirement 1.1: Interactive File Selection**
- Present user with project file tree
- Support glob patterns for file selection (e.g., `src/**/*.py`, `tests/**/*.ts`)
- Allow multiple selection rounds
- Show estimated token count before proceeding

**Requirement 1.2: Repomix Integration**
- Use Repomix library (Node.js) to pack selected files
- Configuration options:
  - Format: XML (default, most AI-friendly)
  - Compression: Optional (extract essential code structure)
  - Include line numbers: Yes (for precise referencing)
  - Remove comments: Optional (ask user)
  - Token counting: Always enabled (for cost estimation)

**Example Repomix usage:**
```javascript
import { runCli } from 'repomix';

const result = await runCli(['./src', './tests'], process.cwd(), {
  output: '/tmp/oracle-context.xml',
  style: 'xml',
  compress: true,
  outputShowLineNumbers: true,
  tokenCount: true,
  quiet: true
});
```

### Phase 2: Question Formulation

**Requirement 2.1: Interactive Question Builder**
- Display initial user question
- Ask clarifying questions:
  - What specific aspect are you investigating? (architecture, bug, optimization, etc.)
  - What is the expected behavior or outcome?
  - Are there specific files/functions of primary interest?
  - What have you already tried?
- Show final formulated question for user approval

**Requirement 2.2: Context Window Management**
- GPT-5 Pro context limit: Track token usage
- Calculate: Repomix output tokens + question tokens + response budget
- If exceeding limits:
  - Suggest reducing file selection
  - Offer compression options
  - Warn about potential truncation

### Phase 3: Oracle Submission

**Requirement 3.1: OpenAI API Integration**
- Use Responses API with background mode
- Model: `gpt-5-pro`
- Configuration:
  ```javascript
  const response = await openai.responses.create({
    model: "gpt-5-pro",
    background: true,  // Enable long-running mode
    input: [
      {
        type: "input_text",
        text: formattedContext + "\n\n" + question
      }
    ],
    temperature: 0.2,  // Lower for more deterministic code analysis
    max_output_tokens: 16000  // Generous for detailed responses
  });
  ```

**Requirement 3.2: Graceful Long-Running Request Handling**
- Immediately inform user: "Submitted to Oracle. This may take up to 20 minutes..."
- Implement polling mechanism:
  ```javascript
  async function pollForCompletion(responseId, maxWaitMinutes = 25) {
    const startTime = Date.now();
    const pollInterval = 3000; // 3 seconds

    while (Date.now() - startTime < maxWaitMinutes * 60 * 1000) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const response = await openai.responses.retrieve(responseId);

      if (response.status === 'completed') {
        return response;
      } else if (response.status === 'failed') {
        throw new Error(`Oracle request failed: ${response.error}`);
      } else if (response.status === 'cancelled') {
        throw new Error('Oracle request was cancelled');
      }

      // Status: queued or in_progress
      const elapsedMinutes = ((Date.now() - startTime) / 60000).toFixed(1);
      console.log(`Still thinking... (${elapsedMinutes} min elapsed, status: ${response.status})`);
    }

    throw new Error('Oracle request timeout exceeded 25 minutes');
  }
  ```

**Requirement 3.3: Request Persistence**
- Save request details to local cache file:
  ```json
  {
    "responseId": "resp_abc123",
    "timestamp": "2025-11-11T10:30:00Z",
    "question": "...",
    "files": ["src/main.py", "..."],
    "status": "in_progress"
  }
  ```
- Enable recovery if Claude Code session ends
- Provide command to check status of pending requests

### Phase 4: Results Processing

**Requirement 4.1: Cost Calculation**
- Parse usage from response:
  ```javascript
  const usage = response.usage;
  const inputTokens = usage.input_tokens;
  const outputTokens = usage.output_tokens;
  const reasoningTokens = usage.reasoning_tokens || 0;

  // GPT-5 Pro pricing (as of Nov 2025)
  const inputCost = (inputTokens / 1_000_000) * 15.00;
  const outputCost = (outputTokens / 1_000_000) * 120.00;
  const reasoningCost = (reasoningTokens / 1_000_000) * 15.00; // Same as input

  const totalCost = inputCost + outputCost + reasoningCost;
  ```

**Requirement 4.2: Response Presentation**
- Display structured output:
  ```
  ╔═══════════════════════════════════════╗
  ║         ORACLE RESPONSE READY         ║
  ╚═══════════════════════════════════════╝

  Time elapsed: 18.3 minutes

  Cost Breakdown:
  - Input tokens:    125,430 @ $15/M  = $1.88
  - Reasoning tokens: 45,120 @ $15/M  = $0.68
  - Output tokens:    12,890 @ $120/M = $1.55
  ────────────────────────────────────────
  Total cost: $4.11

  Response:
  [Full GPT-5 Pro response with markdown formatting]
  ```

**Requirement 4.3: Response Caching**
- Save complete response to `.claude/oracle-history/`
- Include: question, context files, full response, metadata
- Enable later reference and analysis

## Technical Architecture

### File Structure

```
.claude/skills/ask-the-oracle/
├── SKILL.md                    # Skill definition
├── scripts/
│   ├── oracle.js              # Main orchestration script
│   ├── repomix-wrapper.js     # Repomix integration
│   ├── question-builder.js    # Interactive question formulation
│   ├── cost-calculator.js     # Token cost calculations
│   ├── providers/
│   │   ├── base-provider.js   # Abstract provider interface
│   │   ├── openai.js          # OpenAI GPT-5 Pro client
│   │   ├── google.js          # Google Gemini Pro client (v2.0)
│   │   ├── anthropic.js       # Anthropic Opus client (v2.0)
│   │   └── registry.js        # Provider discovery/registration
│   └── synthesizer.js         # Multi-response analysis (v2.0)
├── templates/
│   └── question-template.md   # Question formatting template
├── config/
│   └── default-config.json    # Default settings
└── .oraclerc                  # User config (API keys, preferences)
```

### Provider Abstraction Layer

**Design Philosophy**: Build for extensibility without over-engineering. V1.0 implements only OpenAI, but the architecture supports future providers seamlessly.

#### Base Provider Interface

All providers implement a common interface:

```javascript
// base-provider.js
class BaseProvider {
  constructor(config) {
    this.config = config;
  }

  // Provider metadata
  getName() { throw new Error('Not implemented'); }
  getDisplayName() { throw new Error('Not implemented'); }
  getModelName() { throw new Error('Not implemented'); }

  // Capability checks
  supportsBackgroundMode() { return false; }
  getMaxContextTokens() { throw new Error('Not implemented'); }
  getMaxOutputTokens() { throw new Error('Not implemented'); }

  // Core operations
  async submit(context, question, options = {}) {
    throw new Error('Not implemented');
  }

  async poll(requestId) {
    throw new Error('Not implemented');
  }

  async retrieve(requestId) {
    throw new Error('Not implemented');
  }

  async cancel(requestId) {
    throw new Error('Not implemented');
  }

  // Cost calculation
  calculateCost(usage) {
    throw new Error('Not implemented');
  }

  // Unified response format
  normalizeResponse(rawResponse) {
    return {
      id: rawResponse.id,
      status: 'completed' | 'in_progress' | 'failed' | 'cancelled',
      output: rawResponse.text,
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
        elapsed: 0
      }
    };
  }
}

module.exports = BaseProvider;
```

#### OpenAI Provider (v1.0)

```javascript
// providers/openai.js
const OpenAI = require('openai');
const BaseProvider = require('./base-provider');

class OpenAIProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.model = config.model || 'gpt-5-pro';
  }

  getName() { return 'openai'; }
  getDisplayName() { return 'OpenAI GPT-5 Pro'; }
  getModelName() { return this.model; }
  supportsBackgroundMode() { return true; }
  getMaxContextTokens() { return 200000; }
  getMaxOutputTokens() { return 16000; }

  async submit(context, question, options = {}) {
    const response = await this.client.responses.create({
      model: this.model,
      background: true,
      temperature: options.temperature || 0.2,
      max_output_tokens: options.maxOutputTokens || 16000,
      input: [{ type: "input_text", text: `${context}\n\n${question}` }]
    });

    return this.normalizeResponse(response);
  }

  async poll(requestId) {
    const response = await this.client.responses.retrieve(requestId);
    return this.normalizeResponse(response);
  }

  calculateCost(usage) {
    const inputCost = (usage.inputTokens / 1_000_000) * 15.00;
    const outputCost = (usage.outputTokens / 1_000_000) * 120.00;
    const reasoningCost = (usage.reasoningTokens / 1_000_000) * 15.00;
    return inputCost + outputCost + reasoningCost;
  }

  normalizeResponse(rawResponse) {
    return {
      id: rawResponse.id,
      status: rawResponse.status,
      output: rawResponse.output?.[0]?.text || '',
      usage: {
        inputTokens: rawResponse.usage?.input_tokens || 0,
        outputTokens: rawResponse.usage?.output_tokens || 0,
        reasoningTokens: rawResponse.usage?.reasoning_tokens || 0,
        totalTokens: rawResponse.usage?.total_tokens || 0
      },
      cost: this.calculateCost({
        inputTokens: rawResponse.usage?.input_tokens || 0,
        outputTokens: rawResponse.usage?.output_tokens || 0,
        reasoningTokens: rawResponse.usage?.reasoning_tokens || 0
      }),
      metadata: {
        provider: this.getName(),
        model: this.getModelName(),
        elapsed: 0
      }
    };
  }
}

module.exports = OpenAIProvider;
```

#### Provider Registry (v1.0 foundation)

```javascript
// providers/registry.js
const OpenAIProvider = require('./openai');
// Future providers:
// const GoogleProvider = require('./google');
// const AnthropicProvider = require('./anthropic');

class ProviderRegistry {
  constructor() {
    this.providers = new Map();
  }

  register(provider) {
    this.providers.set(provider.getName(), provider);
  }

  get(name) {
    return this.providers.get(name);
  }

  getAvailable() {
    return Array.from(this.providers.values());
  }

  getConfigured(config) {
    const configured = [];

    if (config.openai?.apiKey) {
      configured.push(new OpenAIProvider(config.openai));
    }

    // Future: Check for other API keys
    // if (config.google?.apiKey) {
    //   configured.push(new GoogleProvider(config.google));
    // }
    // if (config.anthropic?.apiKey) {
    //   configured.push(new AnthropicProvider(config.anthropic));
    // }

    return configured;
  }
}

module.exports = new ProviderRegistry();
```

#### Future Providers (v2.0+)

**Google Gemini Pro:**
- API: Google AI Studio / Vertex AI
- Pricing: TBD based on future rates
- Long-running: Check API capabilities

**Anthropic Claude Opus:**
- API: Anthropic Messages API
- Extended thinking mode for deep analysis
- Pricing: Based on future Opus pricing

**Unknown Future Models:**
- Registry pattern allows easy addition
- Implement BaseProvider interface
- Add to configuration
- No core code changes needed

### SKILL.md Structure

```yaml
---
name: ask-the-oracle
description: Submit complex code questions to GPT-5 Pro for deep analysis when you have 20 minutes. Use when the user asks architectural questions, needs comprehensive code review, debugging complex issues, or requests expert analysis of their codebase. Automatically handles file selection, question formulation, long-running API requests, and cost calculation.
allowed-tools: Read, Write, Grep, Glob, Bash, AskUserQuestion
---

# Ask the Oracle

Inspired by Andrej Karpathy's approach of consulting GPT-5 Pro as an "Oracle" for complex code questions.

## When to Use This Skill

- User asks complex architectural or design questions
- Debugging issues that require deep code understanding
- Requesting comprehensive code review or analysis
- Questions about code patterns, best practices, or optimization
- Phrases like "I need expert analysis", "deep dive", "comprehensive review"

## Instructions

[Detailed step-by-step workflow...]

## Important Notes

- This skill makes external API calls to OpenAI
- Responses typically take 10-20 minutes
- Costs range from $2-$10 depending on codebase size
- Always confirm with user before submission
- User must have OpenAI API key configured

## Configuration

Users must set up `.oraclerc` with:
- OpenAI API key
- Default model preferences
- Cost limits
```

### Dependencies

**Node.js Packages:**
- `repomix` - Codebase packaging
- `openai` - OpenAI API client (official SDK)
- `tiktoken` - Token counting (via Repomix)
- `inquirer` - Interactive CLI prompts
- `chalk` - Terminal formatting
- `ora` - Loading spinners

**Environment Requirements:**
- Node.js v18+ or Bun v1.0+
- OpenAI API key with GPT-5 Pro access
- Sufficient API credits (recommend $10+ balance)

### Configuration File (.oraclerc)

**V1.0 Configuration (Single Provider):**

```json
{
  "defaultProvider": "openai",

  "providers": {
    "openai": {
      "apiKey": "sk-...",
      "model": "gpt-5-pro",
      "maxWaitMinutes": 25,
      "temperature": 0.2,
      "enabled": true
    }
  },

  "repomix": {
    "style": "xml",
    "compress": true,
    "includeLineNumbers": true,
    "removeComments": false
  },

  "limits": {
    "maxCostPerRequest": 10.00,
    "maxCostPerProvider": 10.00,
    "maxTotalCost": 25.00,
    "warnCostThreshold": 5.00,
    "maxInputTokens": 100000
  },

  "ui": {
    "showProgressIndicator": true,
    "saveHistory": true,
    "historyPath": ".claude/oracle-history"
  }
}
```

**V2.0+ Configuration (Multi-Provider):**

```json
{
  "defaultProvider": "openai",

  "providers": {
    "openai": {
      "apiKey": "sk-...",
      "model": "gpt-5-pro",
      "maxWaitMinutes": 25,
      "temperature": 0.2,
      "enabled": true
    },
    "google": {
      "apiKey": "...",
      "model": "gemini-2.0-pro",
      "maxWaitMinutes": 25,
      "temperature": 0.2,
      "enabled": true
    },
    "anthropic": {
      "apiKey": "sk-ant-...",
      "model": "claude-opus-4",
      "maxWaitMinutes": 25,
      "temperature": 0.2,
      "enabled": true
    }
  },

  "multiModel": {
    "enabled": true,
    "defaultSelection": "ask",
    "parallelExecution": true,
    "synthesisMode": "claude-analysis"
  },

  "repomix": {
    "style": "xml",
    "compress": true,
    "includeLineNumbers": true,
    "removeComments": false
  },

  "limits": {
    "maxCostPerRequest": 10.00,
    "maxCostPerProvider": 10.00,
    "maxTotalCost": 25.00,
    "warnCostThreshold": 5.00,
    "maxInputTokens": 100000
  },

  "ui": {
    "showProgressIndicator": true,
    "saveHistory": true,
    "historyPath": ".claude/oracle-history"
  }
}
```

## User Experience Flow

### Example Session

```
User: "I'm getting a memory leak in my Python service. Can you do a deep analysis?"

Claude: I'll use the Ask the Oracle skill to get expert analysis from GPT-5 Pro.

[Skill invokes]

Oracle: Let's gather the relevant code for analysis.

Please select files to include:
  ☑ src/service.py
  ☑ src/memory_manager.py
  ☑ src/handlers/*.py
  ☐ tests/

Estimated tokens: ~45,000 (within limits ✓)

Oracle: Now let's refine your question...

What specific symptoms are you seeing?
> "Gradual memory growth over hours, peaks at 2GB then crashes"

When did this start occurring?
> "After the recent async refactor in v2.3"

Have you tried any debugging steps?
> "Profiled with memory_profiler, seems related to request handlers"

Oracle: Final question to submit:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
I'm debugging a memory leak in a Python service with these symptoms:
- Gradual memory growth over hours, peaks at 2GB then crashes
- Started after async refactor in v2.3
- Profiling suggests issue in request handlers

Please analyze the code and:
1. Identify potential memory leak sources
2. Explain why the async refactor may have triggered this
3. Suggest specific fixes with code examples
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Estimated cost: $3.20 (Input: ~45K tokens, Expected output: ~8K tokens)

Proceed? (y/n) > y

✓ Submitting to Oracle...
Response ID: resp_a1b2c3d4

⏳ Oracle is thinking... This may take up to 20 minutes.

[3.5 min] Status: in_progress...
[7.2 min] Status: in_progress...
[11.8 min] Status: in_progress...
[16.4 min] Status: in_progress...

✓ Response received after 18.7 minutes!

╔═══════════════════════════════════════╗
║         ORACLE RESPONSE READY         ║
╚═══════════════════════════════════════╝

Cost: $3.42 (Input: 47.2K, Reasoning: 21.3K, Output: 9.1K tokens)

[Full detailed analysis with code examples...]
```

## Error Handling

### API Errors
- **Rate limits**: Wait and retry with exponential backoff
- **Insufficient credits**: Clear error message with link to billing
- **Model unavailable**: Suggest alternative or retry later
- **Timeout**: Explain situation, offer to check later via response ID

### User Errors
- **No API key**: Provide setup instructions
- **Context too large**: Suggest file reduction strategies
- **Cost limit exceeded**: Show calculation, ask to increase limit

### Recovery Scenarios
- **Session interrupted**: Auto-save request ID, enable status check
- **Network failure during poll**: Resume polling from last state
- **Partial response**: Handle streaming failures gracefully

## Success Metrics

- Response time: 95% complete within 25 minutes
- Cost accuracy: ±$0.05 or 2% of actual cost
- User satisfaction: Clear communication at each step
- Recovery rate: 99% of interrupted requests resumable

## Future Enhancements

### V1.1 - Conversation & History
- Support for follow-up questions using `previous_response_id`
- Conversation history with the Oracle
- Improved history browsing and search
- Export responses to markdown/PDF

### V1.2 - Optimization & Budgeting
- Cost budgeting per project
- Automatic question optimization to reduce tokens
- Response summarization for quick scanning
- Smart file selection based on question analysis

### V2.0 - Multi-Model Foundation

**Core Multi-Model Support:**
- Add Google Gemini Pro provider
- Add Anthropic Claude Opus provider
- Provider selection UI in skill
- Parallel execution of multiple providers
- Per-provider cost tracking and limits

**Configuration Changes:**
- Multi-provider `.oraclerc` format
- Provider enable/disable toggles
- Model-specific parameters

**Architecture:**
- Complete provider abstraction layer
- Unified response format across all providers
- Provider registry with automatic discovery
- Graceful handling of provider failures

### V2.1 - Response Synthesis

**Claude Code Analysis:**
When multiple Oracles respond, invoke Claude Code to:
1. Read all responses
2. Identify key insights from each
3. Note areas of agreement and disagreement
4. Highlight unique perspectives per model
5. Synthesize a unified analysis

**Synthesis Output Format:**
```
╔═══════════════════════════════════════╗
║      ORACLE SYNTHESIS REPORT          ║
╚═══════════════════════════════════════╝

Consulted Oracles:
- GPT-5 Pro (18.3 min, $4.11)
- Gemini Pro (15.7 min, $3.24)
- Claude Opus (22.1 min, $5.67)

Total Cost: $13.02

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONSENSUS FINDINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All three models agreed on:
- [Key finding 1]
- [Key finding 2]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UNIQUE INSIGHTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GPT-5 Pro uniquely identified:
- [Insight specific to GPT-5 Pro]

Gemini Pro uniquely identified:
- [Insight specific to Gemini]

Claude Opus uniquely identified:
- [Insight specific to Opus]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AREAS OF DISAGREEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Models differed on:
- [Point of disagreement]
  - GPT-5 Pro: [perspective]
  - Gemini Pro: [perspective]
  - Claude Opus: [perspective]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SYNTHESIZED RECOMMENDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Based on all responses, here's the best path forward:
[Claude Code's synthesis of all perspectives]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FULL RESPONSES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Links to full individual responses]
```

**Synthesizer Implementation (V2.1):**

```javascript
// scripts/synthesizer.js
class ResponseSynthesizer {
  constructor(responses) {
    this.responses = responses; // Array of normalized responses
  }

  async synthesize() {
    // Use Claude Code's native analysis capabilities
    // to read and compare all responses

    const analysis = {
      consensus: this.findConsensus(),
      uniqueInsights: this.extractUniqueInsights(),
      disagreements: this.findDisagreements(),
      recommendation: await this.generateRecommendation()
    };

    return this.formatSynthesisReport(analysis);
  }

  findConsensus() {
    // Identify themes/points present in all responses
    // Use simple keyword/semantic similarity
  }

  extractUniqueInsights() {
    // For each provider, find points not in other responses
    // Group by provider
  }

  findDisagreements() {
    // Identify where models gave conflicting advice
    // Useful for user to understand different perspectives
  }

  async generateRecommendation() {
    // This is where Claude Code shines
    // Have Claude read all responses and synthesize
    // The skill will use Claude's native tools to:
    // 1. Read all response files
    // 2. Formulate synthesis prompt
    // 3. Generate unified recommendation
  }

  formatSynthesisReport(analysis) {
    // Create the formatted output shown above
  }
}

module.exports = ResponseSynthesizer;
```

### V2.2 - Advanced Features
- Response comparison visualization
- Model performance tracking (accuracy, cost, time)
- Automatic model selection based on question type
- Custom synthesis strategies
- Team sharing of Oracle consultations

### V3.0 - Intelligence Layer
- Learn from past Oracle consultations
- Predict which model(s) best for each question type
- Automatic cost optimization
- Integration with Claude's native analysis
- Hybrid mode: Claude + Oracle collaboration

## Appendices

### Appendix A: Repomix CLI Reference

Key options for this skill:
- `--style xml`: Best for LLM consumption
- `--compress`: Reduces tokens by extracting structure
- `--output-show-line-numbers`: Essential for precise references
- `--include <pattern>`: Target specific files
- `--token-count-tree`: Preview token usage before packing
- `--remove-comments`: Optional token reduction

### Appendix B: OpenAI Responses API Background Mode

Background mode characteristics:
- Enabled via `background: true` parameter
- Designed for o1-pro, o3, and complex reasoning tasks
- Prevents timeout during long computations
- Status polling required (min 2 second intervals)
- Responses cached for 30 days
- Can be cancelled via API if needed

Status lifecycle:
```
queued → in_progress → completed/failed/cancelled
```

### Appendix C: GPT-5 Pro Pricing (Nov 2025)

| Token Type | Cost per 1M tokens |
|------------|-------------------|
| Input      | $15.00            |
| Reasoning  | $15.00            |
| Output     | $120.00           |

Example costs:
- Small query (10K in, 2K out): ~$0.40
- Medium analysis (50K in, 8K out): ~$1.71
- Large review (100K in, 15K out): ~$3.30

### Appendix D: Token Estimation

Rough estimates:
- 1 line of code ≈ 10-20 tokens
- 1 file (200 lines) ≈ 2,000-4,000 tokens
- 1 module (10 files) ≈ 20,000-40,000 tokens

Repomix with compression can reduce by 30-50%.

### Appendix E: Security Considerations

- API keys stored in local config only (never committed)
- No codebase uploaded to Anthropic servers
- OpenAI data retention: 30 days (Responses API)
- Recommend data privacy review for sensitive codebases
- Option to exclude files with secrets (.env, credentials, etc.)

---

**Document Version**: 1.1 (Multi-Model Architecture Added)
**Last Updated**: 2025-11-11
**Status**: Ready for Implementation

**Architecture**:
- V1.0: Single provider (OpenAI GPT-5 Pro)
- V2.0+: Multi-provider with synthesis capabilities
