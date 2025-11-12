# Multi-Model Architecture

## Overview

The Ask the Oracle skill is designed from the ground up to support multiple premium AI models, even though V1.0 ships with only OpenAI GPT-5 Pro support. This document explains the architectural decisions that enable future multi-model capabilities without over-engineering the initial implementation.

## Design Philosophy

> **Build for extensibility without over-engineering.**

- V1.0: Implement only OpenAI provider
- Architecture: Support multiple providers seamlessly
- Future: Add providers by implementing a simple interface

## Provider Abstraction Layer

### Core Concept

All Oracle providers (OpenAI, Google, Anthropic, future models) implement a common `BaseProvider` interface. This enables:

1. **Uniform interaction** - Same code works with any provider
2. **Easy addition** - New models require only a new provider class
3. **Graceful degradation** - If a provider fails, others continue
4. **Comparative analysis** - Normalized responses enable synthesis

### Base Provider Interface

```javascript
class BaseProvider {
  // Identity
  getName()           // 'openai', 'google', 'anthropic'
  getDisplayName()    // 'OpenAI GPT-5 Pro'
  getModelName()      // 'gpt-5-pro'

  // Capabilities
  supportsBackgroundMode()   // true/false
  getMaxContextTokens()      // 200000
  getMaxOutputTokens()       // 16000

  // Operations
  async submit(context, question, options)
  async poll(requestId)
  async retrieve(requestId)
  async cancel(requestId)

  // Cost & Response
  calculateCost(usage)
  normalizeResponse(rawResponse)  // Unified format
}
```

### Key Design Decisions

**1. Normalized Response Format**

All providers return the same structure:

```javascript
{
  id: "unique-request-id",
  status: "completed" | "in_progress" | "failed" | "cancelled",
  output: "response text",
  usage: {
    inputTokens: 125000,
    outputTokens: 12000,
    reasoningTokens: 45000,
    totalTokens: 182000
  },
  cost: 4.26,
  metadata: {
    provider: "openai",
    model: "gpt-5-pro",
    elapsed: 1098000  // milliseconds
  }
}
```

This enables:
- Provider-agnostic code in orchestration layer
- Easy response comparison
- Unified cost tracking
- Synthesis across different models

**2. Provider Registry**

Central registration system:

```javascript
// Automatic provider discovery
const registry = new ProviderRegistry();

// V1.0: Only OpenAI
if (config.openai?.apiKey) {
  registry.register(new OpenAIProvider(config.openai));
}

// V2.0: Multiple providers
if (config.google?.apiKey) {
  registry.register(new GoogleProvider(config.google));
}
if (config.anthropic?.apiKey) {
  registry.register(new AnthropicProvider(config.anthropic));
}

// Get configured providers
const available = registry.getConfigured(config);
```

**3. Provider-Specific Implementation**

Each provider handles its own quirks:

```javascript
class OpenAIProvider extends BaseProvider {
  async submit(context, question, options) {
    // OpenAI-specific: Responses API with background mode
    const response = await this.client.responses.create({
      model: this.model,
      background: true,  // Long-running support
      input: [{ type: "input_text", text: `${context}\n\n${question}` }]
    });
    return this.normalizeResponse(response);
  }

  calculateCost(usage) {
    // OpenAI-specific pricing
    return (usage.inputTokens / 1_000_000) * 15.00 +
           (usage.outputTokens / 1_000_000) * 120.00 +
           (usage.reasoningTokens / 1_000_000) * 15.00;
  }
}

class GoogleProvider extends BaseProvider {
  async submit(context, question, options) {
    // Google-specific: Gemini API (future implementation)
    const response = await this.client.generateContent({
      model: this.model,
      contents: [{ role: 'user', parts: [{ text: `${context}\n\n${question}` }] }]
    });
    return this.normalizeResponse(response);
  }

  calculateCost(usage) {
    // Google-specific pricing (future rates)
    return (usage.inputTokens / 1_000_000) * 10.00 +
           (usage.outputTokens / 1_000_000) * 80.00;
  }
}
```

## Configuration Structure

### V1.0 (Single Provider)

```json
{
  "defaultProvider": "openai",
  "providers": {
    "openai": {
      "apiKey": "sk-...",
      "model": "gpt-5-pro",
      "enabled": true
    }
  }
}
```

### V2.0+ (Multi-Provider)

```json
{
  "defaultProvider": "openai",
  "providers": {
    "openai": {
      "apiKey": "sk-...",
      "model": "gpt-5-pro",
      "enabled": true
    },
    "google": {
      "apiKey": "...",
      "model": "gemini-2.0-pro",
      "enabled": true
    },
    "anthropic": {
      "apiKey": "sk-ant-...",
      "model": "claude-opus-4",
      "enabled": true
    }
  },
  "multiModel": {
    "enabled": true,
    "parallelExecution": true,
    "synthesisMode": "claude-analysis"
  },
  "limits": {
    "maxCostPerProvider": 10.00,
    "maxTotalCost": 25.00
  }
}
```

**Key Configuration Features:**

- `enabled` flag: Toggle providers without removing config
- Per-provider settings: Each model has custom parameters
- Global multi-model settings: Control parallel execution
- Cost limits: Per-provider and total budgets

## Orchestration Layer

The main `oracle.js` script remains provider-agnostic:

```javascript
// V1.0 and V2.0+ compatible
async function askOracle(context, question, options) {
  // 1. Load configuration
  const config = loadConfig('.oraclerc');

  // 2. Get available providers
  const providers = registry.getConfigured(config);

  // 3. Select provider(s)
  let selectedProviders;
  if (config.multiModel?.enabled && providers.length > 1) {
    selectedProviders = await askUserWhichProviders(providers);
  } else {
    selectedProviders = [providers[0]];
  }

  // 4. Submit to provider(s)
  const requests = await Promise.all(
    selectedProviders.map(provider =>
      provider.submit(context, question, options)
    )
  );

  // 5. Poll for completion
  const responses = await pollAll(selectedProviders, requests);

  // 6. Synthesize if multiple responses
  if (responses.length > 1) {
    return await synthesizeResponses(responses);
  }

  return responses[0];
}
```

**Key Points:**
- Same code works with 1 or N providers
- No provider-specific logic in orchestration
- Synthesis only when multiple responses
- Graceful degradation if provider fails

## Multi-Model Execution Flow

### Parallel Execution (V2.0+)

```
User selects: [GPT-5 Pro, Gemini Pro, Opus]
    ↓
Submit all in parallel
    ├─→ OpenAI API (background) → request_id_1
    ├─→ Google API (async)      → request_id_2
    └─→ Anthropic API (extended)→ request_id_3
    ↓
Poll each independently
    ├─→ GPT-5 Pro:   [3min] [7min] [12min] [18min] ✓
    ├─→ Gemini Pro:  [3min] [6min] [11min] [16min] ✓
    └─→ Opus:        [3min] [8min] [15min] [22min] ✓
    ↓
All complete (max elapsed: 22 min)
    ↓
Pass all responses to synthesizer
```

**Advantages:**
- Total time = slowest provider (not sum of all)
- User gets updates from each provider
- Can cancel individual requests
- Graceful handling if one fails

## Response Synthesis

### Synthesis Phase (V2.1+)

When multiple Oracles respond, Claude Code performs analysis:

```javascript
class ResponseSynthesizer {
  async synthesize(responses) {
    // 1. Save all responses to files
    const responsePaths = await this.saveResponses(responses);

    // 2. Instruct Claude Code to analyze
    const synthesis = await this.invokeClaude({
      task: 'analyze-oracle-responses',
      responses: responsePaths,
      instructions: `
        You have responses from ${responses.length} Oracle models.
        Analyze all responses and create a synthesis that:

        1. Identifies consensus findings (all models agree)
        2. Extracts unique insights (only one model found)
        3. Notes disagreements (models conflict)
        4. Recommends best path forward

        Be objective and highlight the value each model brings.
      `
    });

    return this.formatSynthesis(synthesis, responses);
  }
}
```

**Claude Code's Role:**
- Read all Oracle responses
- Apply its own analysis capabilities
- Identify patterns and insights
- Generate unified recommendation
- Leverage strengths of each Oracle

**Why This Works:**
- Claude Code is already the orchestrator
- It has full context of the question and codebase
- Can use its own tools (Read, Grep, etc.) during synthesis
- No need for external synthesis model

## Adding Future Providers

To add a new Oracle in V3.0+:

### 1. Create Provider Class

```javascript
// providers/new-provider.js
const BaseProvider = require('./base-provider');

class NewProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.client = new NewProviderSDK({ apiKey: config.apiKey });
  }

  getName() { return 'newprovider'; }
  getDisplayName() { return 'New Provider Model'; }
  getModelName() { return this.config.model || 'default-model'; }

  async submit(context, question, options) {
    // Implement submission logic
    const response = await this.client.ask(...);
    return this.normalizeResponse(response);
  }

  async poll(requestId) {
    // Implement polling logic
    const response = await this.client.getStatus(requestId);
    return this.normalizeResponse(response);
  }

  calculateCost(usage) {
    // Implement pricing calculation
    return usage.totalTokens * 0.00001; // example
  }

  normalizeResponse(rawResponse) {
    // Convert provider-specific format to unified format
    return {
      id: rawResponse.id,
      status: this.mapStatus(rawResponse.status),
      output: rawResponse.text,
      usage: { /* ... */ },
      cost: this.calculateCost(rawResponse.usage),
      metadata: { provider: this.getName(), /* ... */ }
    };
  }
}

module.exports = NewProvider;
```

### 2. Register in Registry

```javascript
// providers/registry.js
const NewProvider = require('./new-provider');

// Add to getConfigured method
if (config.newprovider?.apiKey) {
  configured.push(new NewProvider(config.newprovider));
}
```

### 3. Update Configuration Schema

```json
{
  "providers": {
    "newprovider": {
      "apiKey": "...",
      "model": "new-model-v1",
      "enabled": true
    }
  }
}
```

### 4. Update Documentation

That's it! No changes to:
- Core orchestration logic
- Synthesis logic
- User interface
- Cost tracking
- History saving

## Benefits of This Architecture

### For V1.0 (Now)
- Clean, simple OpenAI implementation
- No unnecessary abstraction overhead
- Easy to understand and maintain
- Fast to ship

### For V2.0+ (Future)
- Add providers with minimal code
- No refactoring of core logic
- Synthesis works automatically
- User configuration is intuitive

### For V3.0+ (Unknown Future)
- Support models we don't know about yet
- Adapt to API changes per provider
- Easy to deprecate old providers
- Extensible for new features (streaming, multi-modal, etc.)

## What We're NOT Over-Engineering

### Not Building (Yet)
- Complex provider discovery mechanisms
- Dynamic provider plugin system
- Provider marketplace
- Automatic provider testing framework
- Complex synthesis algorithms

### Building Just Enough
- Simple interface (BaseProvider)
- Basic registry (Map of providers)
- Config-based provider selection
- Claude Code-powered synthesis (using existing capabilities)

## Migration Path

### V1.0 Configuration

```json
{
  "openai": {
    "apiKey": "sk-...",
    "model": "gpt-5-pro"
  }
}
```

### V2.0 Configuration (Backward Compatible)

```json
{
  "defaultProvider": "openai",
  "providers": {
    "openai": {
      "apiKey": "sk-...",
      "model": "gpt-5-pro",
      "enabled": true
    }
  }
}
```

**Migration Strategy:**
1. Check for V1.0 format
2. Auto-convert to V2.0 format
3. Save new format
4. Inform user of upgrade

No breaking changes.

## Conclusion

This architecture provides:

1. **Simplicity** - V1.0 is straightforward
2. **Extensibility** - V2.0+ is easy to build
3. **Flexibility** - Unknown future models supported
4. **Maintainability** - Clear separation of concerns
5. **User-Friendly** - Configuration is intuitive

The key insight: **Don't over-engineer, but do design for the future.**

We're building a foundation that makes V2.0 natural, not bolting on multi-model support later.

---

**Document Version**: 1.0
**Architecture Version**: V1.0 Foundation, V2.0+ Ready
**Last Updated**: 2025-11-11
