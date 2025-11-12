# Ask the Oracle - Project Summary

## What We Built

A comprehensive design for a Claude Code skill that consults premium AI models for deep code analysis, with built-in support for future multi-model synthesis.

## Documentation Created

### Main Documents

1. **[README.md](./README.md)** (9.6 KB)
   - Project overview and quick start
   - Features and use cases
   - Cost expectations and workflows
   - Multi-model roadmap

2. **[PRD.md](./PRD.md)** (28.3 KB)
   - Complete product requirements
   - Detailed technical architecture
   - Provider abstraction layer design
   - Multi-model workflows and synthesis
   - Configuration examples
   - User experience flows
   - Cost calculations
   - Error handling strategies

### Reference Documentation

3. **[docs/repomix-reference.md](./docs/repomix-reference.md)** (7.4 KB)
   - Complete Repomix CLI guide
   - Library usage with code examples
   - Token counting and optimization
   - Integration recommendations

4. **[docs/openai-responses-api.md](./docs/openai-responses-api.md)** (16.7 KB)
   - OpenAI Responses API reference
   - Background mode for long-running requests
   - Polling mechanisms and status handling
   - GPT-5 Pro pricing and cost calculation
   - Complete code examples

5. **[docs/claude-skills-reference.md](./docs/claude-skills-reference.md)** (16.5 KB)
   - Claude Code skills creation guide
   - SKILL.md structure and best practices
   - Tool restrictions and testing
   - Complete example skill

6. **[docs/multi-model-architecture.md](./docs/multi-model-architecture.md)** (12.4 KB)
   - Provider abstraction layer design
   - Multi-model architecture philosophy
   - Response synthesis approach
   - Future provider integration guide

## Key Architectural Decisions

### V1.0: Single Provider (OpenAI GPT-5 Pro)

**Ship Fast:**
- Focus on OpenAI GPT-5 Pro only
- Proven API with background mode
- Clear pricing and capabilities
- Get user feedback early

**Build Smart:**
- Provider abstraction layer from day 1
- Configuration structure supports multiple providers
- Normalized response format
- Registry pattern for provider management

### V2.0+: Multi-Model with Synthesis

**Add Providers:**
- Google Gemini Pro
- Anthropic Claude Opus
- Future premium models

**Synthesis Approach:**
- Claude Code reads all Oracle responses
- Identifies consensus findings
- Extracts unique insights per model
- Notes disagreements
- Generates unified recommendations

**Key Insight:**
> Use Claude Code itself as the synthesis engine. It's already the orchestrator, has full context, and can apply its own analytical capabilities.

## Design Philosophy

### Build for Extensibility Without Over-Engineering

**What We Built:**
- ✅ Simple provider interface (BaseProvider)
- ✅ Basic registry (Map-based)
- ✅ Config-based provider selection
- ✅ Normalized response format
- ✅ Clear migration path

**What We're NOT Building (Yet):**
- ❌ Complex plugin system
- ❌ Provider marketplace
- ❌ Automatic provider discovery
- ❌ Complex synthesis algorithms
- ❌ Dynamic provider loading

**Result:**
- V1.0 is simple and fast to ship
- V2.0 requires minimal new code
- V3.0 can support unknown future models
- Architecture is clean and maintainable

## Provider Abstraction Layer

### Base Interface

All providers implement:

```javascript
class BaseProvider {
  // Identity
  getName()           // 'openai', 'google', 'anthropic'
  getDisplayName()    // 'OpenAI GPT-5 Pro'
  getModelName()      // 'gpt-5-pro'

  // Capabilities
  supportsBackgroundMode()
  getMaxContextTokens()
  getMaxOutputTokens()

  // Operations
  async submit(context, question, options)
  async poll(requestId)
  async retrieve(requestId)
  async cancel(requestId)

  // Unified format
  calculateCost(usage)
  normalizeResponse(rawResponse)
}
```

### Benefits

1. **Provider-agnostic orchestration** - Same code for any Oracle
2. **Easy provider addition** - Implement interface, register, done
3. **Unified response format** - Enables synthesis
4. **Graceful degradation** - Provider failures isolated
5. **Future-proof** - Support models we don't know about yet

## Multi-Model Workflows

### V1.0 Workflow

```
User question → File selection → Repomix → Question formulation
    → Submit to GPT-5 Pro → Poll (20 min) → Present results
```

### V2.0+ Workflow

```
User question → File selection → Repomix → Question formulation
    → Select Oracles → Submit to all in parallel → Poll each
    → Claude Code synthesizes → Present comparative analysis
```

### Synthesis Output

```
╔═══════════════════════════════════════╗
║      ORACLE SYNTHESIS REPORT          ║
╚═══════════════════════════════════════╝

Consulted Oracles:
- GPT-5 Pro (18 min, $4.11)
- Gemini Pro (16 min, $3.24)
- Claude Opus (22 min, $5.67)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONSENSUS FINDINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[What all models agreed on]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UNIQUE INSIGHTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GPT-5 Pro: [Unique finding]
Gemini Pro: [Unique finding]
Claude Opus: [Unique finding]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AREAS OF DISAGREEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Where models differ and why]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SYNTHESIZED RECOMMENDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Claude Code's unified analysis]
```

## Configuration Examples

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
  },
  "limits": {
    "maxCostPerRequest": 10.00
  }
}
```

### V2.0+ (Multi-Provider)

```json
{
  "defaultProvider": "openai",
  "providers": {
    "openai": { "apiKey": "...", "enabled": true },
    "google": { "apiKey": "...", "enabled": true },
    "anthropic": { "apiKey": "...", "enabled": true }
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

## Cost Expectations

### Single Model (V1.0)

| Scenario | Tokens | Cost |
|----------|--------|------|
| Small query | 10K in, 2K out | ~$0.40 |
| Medium analysis | 50K in, 8K out | ~$1.71 |
| Large review | 100K in, 15K out | ~$3.30 |
| Full codebase | 125K in, 45K reasoning, 13K out | ~$4.26 |

### Multi-Model (V2.0+)

Consulting 3 Oracles with medium analysis:
- GPT-5 Pro: ~$4.26
- Gemini Pro: ~$3.24 (estimated)
- Claude Opus: ~$5.67 (estimated)
- **Total: ~$13.17**

**Value Proposition:** Get perspectives from 3 SOTA models for the price of a few API calls. Claude Code synthesis ensures you get the best insights from each.

## Roadmap

### V1.1 - Conversation & History
- Follow-up questions
- History browsing
- Export capabilities

### V1.2 - Optimization & Budgeting
- Cost budgeting per project
- Automatic question optimization
- Smart file selection

### V2.0 - Multi-Model Foundation
- Add Gemini Pro provider
- Add Claude Opus provider
- Provider selection UI
- Parallel execution

### V2.1 - Response Synthesis
- **Claude Code analyzes all responses**
- Consensus identification
- Unique insights extraction
- Disagreement highlighting
- Synthesized recommendations

### V2.2 - Advanced Features
- Response visualization
- Model performance tracking
- Automatic model selection

### V3.0 - Intelligence Layer
- Learn from past consultations
- Predict best models per question
- Full Claude + Oracle collaboration

## Adding Future Providers

To add a new Oracle:

1. **Create provider class** implementing `BaseProvider`
2. **Register in registry** - one line of code
3. **Update config schema** - add provider section
4. **Done** - No changes to core logic needed

Example:

```javascript
// providers/future-model.js
class FutureModelProvider extends BaseProvider {
  getName() { return 'futuremodel'; }

  async submit(context, question, options) {
    // Provider-specific implementation
    return this.normalizeResponse(response);
  }

  calculateCost(usage) {
    // Provider-specific pricing
  }
}

// providers/registry.js
if (config.futuremodel?.apiKey) {
  configured.push(new FutureModelProvider(config.futuremodel));
}
```

That's it!

## Technical Stack

### Core
- **Repomix**: Codebase packaging
- **OpenAI API**: GPT-5 Pro with Responses API
- **Claude Code**: Skill framework + synthesis
- **Node.js/Bun**: Runtime
- **tiktoken**: Token counting

### Future
- **Google AI SDK**: Gemini integration
- **Anthropic SDK**: Opus integration
- **Provider abstraction**: Unified interface

## Next Steps

### Implementation Phases

**Phase 1: Core Infrastructure**
1. Set up project structure
2. Implement BaseProvider interface
3. Create OpenAI provider
4. Build provider registry
5. Configuration loading

**Phase 2: V1.0 Features**
1. Repomix integration
2. Question builder
3. Cost calculator
4. Polling mechanism
5. State management
6. History tracking

**Phase 3: Skill Integration**
1. SKILL.md creation
2. Claude Code tool integration
3. Interactive prompts
4. Error handling
5. Testing

**Phase 4: Polish & Release**
1. User testing
2. Documentation
3. Examples
4. Bug fixes
5. V1.0 launch

**Phase 5: Multi-Model (V2.0)**
1. Google provider
2. Anthropic provider
3. Provider selection UI
4. Parallel execution
5. Synthesis engine

## Success Criteria

### V1.0
- [ ] Successfully query GPT-5 Pro via Responses API
- [ ] Handle 20+ minute responses gracefully
- [ ] Accurate cost calculation (±2%)
- [ ] State persistence and recovery
- [ ] Clear user experience

### V2.0
- [ ] Multiple providers working in parallel
- [ ] Unified response format across all providers
- [ ] Claude Code synthesis produces valuable insights
- [ ] Cost tracking per provider
- [ ] Graceful handling of provider failures

## Why This Approach Works

### For V1.0
- ✅ **Simple**: Focus on one provider
- ✅ **Fast**: No unnecessary abstraction
- ✅ **Proven**: OpenAI API is mature
- ✅ **Valuable**: Solves real problem (Karpathy's use case)

### For V2.0+
- ✅ **Extensible**: Architecture supports it naturally
- ✅ **No Refactoring**: Core logic doesn't change
- ✅ **Synthesis**: Claude Code is perfect for this
- ✅ **Flexible**: Easy to add unknown future models

### Key Insight

> **Don't build what you might need. Build what you do need, but architect it so future needs are easy to add.**

We're shipping V1.0 fast, but V2.0 will be natural, not bolted on.

## Project Status

- [x] Documentation complete
- [x] Architecture designed
- [x] Provider abstraction specified
- [x] Multi-model synthesis planned
- [x] Configuration structure defined
- [ ] Implementation (next step)

## Files Summary

| File | Size | Purpose |
|------|------|---------|
| README.md | 9.6 KB | Project overview |
| PRD.md | 28.3 KB | Complete requirements |
| docs/repomix-reference.md | 7.4 KB | Repomix guide |
| docs/openai-responses-api.md | 16.7 KB | OpenAI API reference |
| docs/claude-skills-reference.md | 16.5 KB | Skills creation guide |
| docs/multi-model-architecture.md | 12.4 KB | Architecture deep dive |
| **Total** | **91.0 KB** | **Complete design** |

---

**Status**: ✅ **Ready for Implementation**

**Architecture**: 🏗️ **V1.0 Simple, V2.0+ Ready**

**Philosophy**: 💡 **Build for extensibility without over-engineering**

**Next Step**: 🚀 **Start implementing V1.0**

**Vision**: 🔮 **Multi-model synthesis with Claude Code**
