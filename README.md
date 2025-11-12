# Ask the Oracle

A Claude Code skill that enables deep code analysis by submitting questions to OpenAI's GPT-5 Pro model, inspired by Andrej Karpathy's approach.

## Inspiration

> "I do think that a lot of the stuff, by the way, continues to improve. So I think currently probably state-of-the-art model that I go to is the GPT-5 Pro. And that's a very, very powerful model. So if I actually have 20 minutes, I will copy-paste my entire repo and I go to GPT-5 Pro, the Oracle, for like some questions. And often it's not too bad and surprisingly good compared to what existed a year ago."
>
> — Andrej Karpathy

## Overview

**Ask the Oracle** is a Claude Code skill that automates the process of consulting premium AI models for deep code analysis:

**V1.0 Features:**
1. Selecting relevant code files using Repomix
2. Formulating well-structured questions through interactive prompts
3. Submitting to OpenAI GPT-5 Pro via Responses API (background mode)
4. Gracefully handling 10-20 minute response times
5. Calculating precise costs based on token usage
6. Presenting comprehensive analysis results

**V2.0+ Vision (Multi-Model):**
7. Query multiple Oracles in parallel (GPT-5 Pro, Gemini Pro, Claude Opus)
8. Claude Code synthesizes responses from all models
9. Comparative analysis highlighting consensus and unique insights
10. Best-of-all-worlds recommendations

## Features

### V1.0 (Current)
- **Smart File Selection**: Interactive file/pattern selection with token estimation
- **Question Builder**: Guided question formulation for better results
- **Long-Running Requests**: Robust polling mechanism for 20+ minute responses
- **Cost Transparency**: Real-time cost estimation and breakdown
- **State Management**: Resume interrupted requests seamlessly
- **History Tracking**: Save all Oracle consultations for future reference

### V2.0+ (Planned)
- **Multi-Model Support**: Query GPT-5 Pro, Gemini Pro, and Claude Opus
- **Parallel Execution**: Submit to multiple Oracles simultaneously
- **Response Synthesis**: Claude Code analyzes all responses
- **Comparative Analysis**: Identify consensus, unique insights, and disagreements
- **Provider Abstraction**: Easy addition of future premium models
- **Cost Optimization**: Per-provider budgets and smart model selection

## Installation

### Method 1: Claude Code Plugin (Recommended)

Install Ask the Oracle as a Claude Code plugin for automatic dependency management and easy updates:

```bash
# Search for the plugin in the marketplace
/plugin marketplace search ask-the-oracle

# Install from the marketplace (when published)
/plugin marketplace add robgruhl/ask-the-oracle
/plugin install ask-the-oracle@robgruhl

# Restart Claude Code to load the plugin
/restart
```

Once installed, configure your API key:

```bash
# Copy the example configuration
cp .oraclerc.example .oraclerc

# Edit .oraclerc and add your OpenAI API key
# The plugin will automatically detect this configuration in any project
```

### Method 2: Manual Global Installation

Install as a global skill available to all your Claude Code projects:

```bash
# Clone the repository
git clone https://github.com/robgruhl/ask-the-oracle.git ~/.claude/global-skills/ask-the-oracle

# Install dependencies
cd ~/.claude/global-skills/ask-the-oracle
bun install  # or npm install

# Configure API key
cp .oraclerc.example ~/.oraclerc
# Edit ~/.oraclerc and add your OpenAI API key
```

### Method 3: Project-Local Installation

Install in a specific project only:

```bash
# Clone into your project's skills directory
git clone https://github.com/robgruhl/ask-the-oracle.git .claude/skills/ask-the-oracle

# Install dependencies
cd .claude/skills/ask-the-oracle
bun install  # or npm install

# Configure API key (project-specific)
cp .oraclerc.example ../../.oraclerc
# Edit .oraclerc in your project root
```

### Prerequisites

- **Claude Code**: Version 1.0.0 or later
- **Node.js**: Version 18.0.0 or later (or Bun 1.0+)
- **OpenAI API Key**: With GPT-5 Pro access
- **API Credits**: $10+ recommended for testing

### Usage

Simply ask Claude a complex question about your code:

```
"I have a memory leak in my Python service. Can you do a deep analysis?"
```

Claude will automatically invoke the Oracle skill and guide you through the process.

Or use the skill directly in CLI mode:

```bash
# From your project directory
node ~/.claude/global-skills/ask-the-oracle/skills/ask-the-oracle/scripts/oracle.js \
  "src/**/*.js" "*.md" -- "Review the architecture of this project"

# Skip confirmation prompt for automation
node oracle.js --yes "src/**/*.py" -- "Find potential security issues"
```

## Use Cases

Use the Oracle when you need:

- **Architectural Analysis**: "Review the architecture of my API"
- **Bug Investigation**: "Debug this complex memory leak"
- **Code Review**: "Comprehensive review of my authentication system"
- **Optimization**: "How can I improve performance of this module?"
- **Best Practices**: "Suggest improvements following current best practices"

## Cost Expectations

| Scenario | Tokens | Estimated Cost |
|----------|--------|----------------|
| Small query | 10K in, 2K out | ~$0.40 |
| Medium analysis | 50K in, 8K out | ~$1.71 |
| Large review | 100K in, 15K out | ~$3.30 |
| Full codebase | 125K in, 45K reasoning, 13K out | ~$4.26 |

Pricing: $15/M input, $120/M output, $15/M reasoning (GPT-5 Pro, Nov 2025)

## Project Structure

```
ask-the-oracle/
├── README.md                    # This file
├── PRD.md                       # Product Requirements Document
├── LICENSE                      # MIT License
├── package.json                 # npm dependencies
├── .oraclerc.example            # Configuration template
├── .claude-plugin/              # Plugin metadata
│   └── plugin.json              # Plugin manifest for marketplace
├── skills/                      # Skill implementation
│   └── ask-the-oracle/
│       ├── SKILL.md             # Skill documentation
│       ├── scripts/
│       │   ├── oracle.js        # Main orchestrator
│       │   ├── repomix-wrapper.js
│       │   ├── config-validator.js
│       │   ├── history-manager.js
│       │   └── providers/
│       │       ├── base-provider.js
│       │       └── openai.js
│       ├── templates/
│       │   └── context-prompt.txt
│       └── config/
│           └── defaults.json
└── docs/                        # Reference documentation
    ├── repomix-reference.md
    ├── openai-responses-api.md
    └── claude-skills-reference.md
```

## Documentation

- **[PRD.md](./PRD.md)**: Complete product requirements
- **[Repomix Reference](./docs/repomix-reference.md)**: Repomix CLI and library usage
- **[OpenAI API Reference](./docs/openai-responses-api.md)**: Responses API with background mode
- **[Claude Skills Guide](./docs/claude-skills-reference.md)**: How to create Claude Code skills

## Development Status

**Current Stage**: V1.0 Complete - Plugin Conversion

- [x] Requirements gathering
- [x] Documentation research
- [x] PRD creation
- [x] Skill implementation
- [x] Testing & refinement (all P0 fixes validated)
- [x] Production-ready CLI
- [ ] Plugin marketplace submission
- [ ] Public release announcement

## Workflow

### Single Model (V1.0)
```
User asks complex question
    ↓
Claude invokes Oracle skill
    ↓
Interactive file selection
    ↓
Repomix packs selected code
    ↓
Question formulation
    ↓
Cost estimation & confirmation
    ↓
Submit to GPT-5 Pro (background)
    ↓
Poll for completion (10-20 min)
    ↓
Calculate actual cost
    ↓
Present results + save history
```

### Multi-Model (V2.0+)
```
User asks complex question
    ↓
Claude invokes Oracle skill
    ↓
Interactive file selection
    ↓
Repomix packs selected code
    ↓
Question formulation
    ↓
Select Oracles (GPT-5 Pro, Gemini, Opus, All)
    ↓
Cost estimation & confirmation
    ↓
Submit to multiple Oracles in parallel
    ↓
Poll each for completion (track individually)
    ↓
Calculate costs per provider
    ↓
Claude Code synthesizes all responses
    ↓
Present comparative analysis + save history
```

## Technical Stack

### Core (V1.0)
- **Repomix**: Codebase packaging
- **OpenAI API**: GPT-5 Pro access (Responses API with background mode)
- **Claude Code**: Skill framework and synthesis engine
- **Node.js/Bun**: Runtime
- **tiktoken**: Token counting

### Future (V2.0+)
- **Google AI SDK**: Gemini Pro integration
- **Anthropic SDK**: Claude Opus integration
- **Provider Abstraction Layer**: Unified interface for all models
- **Response Synthesizer**: Claude Code-powered analysis

## Configuration

### V1.0 Configuration (Single Provider)

Create `.oraclerc` in your project root:

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
    "includeLineNumbers": true
  },

  "limits": {
    "maxCostPerRequest": 10.00,
    "warnCostThreshold": 5.00
  }
}
```

### V2.0+ Configuration (Multi-Provider)

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

## Security Considerations

- API keys stored locally only (never committed)
- No data sent to Anthropic servers
- OpenAI retains data for 30 days
- Review data privacy policies for sensitive codebases
- Automatic exclusion of .env and credential files

## Roadmap

### V1.1 - Conversation & History
- Follow-up questions using conversation chaining
- Improved history browsing and search
- Export responses to markdown/PDF

### V1.2 - Optimization & Budgeting
- Project-level cost budgeting
- Automatic question optimization to reduce tokens
- Response summarization for quick scanning
- Smart file selection based on question analysis

### V2.0 - Multi-Model Foundation
- **Google Gemini Pro** provider
- **Anthropic Claude Opus** provider
- Provider selection UI
- Parallel execution of multiple providers
- Per-provider cost tracking

### V2.1 - Response Synthesis
- **Claude Code analyzes all Oracle responses**
- Identify consensus findings across models
- Extract unique insights per model
- Highlight areas of disagreement
- Generate synthesized recommendations
- Beautiful comparative analysis reports

### V2.2 - Advanced Features
- Response comparison visualization
- Model performance tracking
- Automatic model selection based on question type
- Custom synthesis strategies

### V3.0 - Intelligence Layer
- Learn from past consultations
- Predict best model(s) for each question type
- Automatic cost optimization
- Full Claude + Oracle collaboration mode

## Contributing

Contributions welcome! This is an open-source project aimed at improving developer workflows.

## License

MIT License - feel free to use, modify, and distribute

## Acknowledgments

- **Andrej Karpathy** for the Oracle concept
- **Repomix** for excellent codebase packaging
- **OpenAI** for GPT-5 Pro and Responses API
- **Anthropic** for Claude Code and Agent Skills framework

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check the documentation in `./docs/`
- Review the PRD for detailed specifications

## Troubleshooting

### "No files matched the specified patterns"

If you see this error, check:
1. **Pattern syntax**: Use quotes around globs: `"src/**/*.js"` not `src/**/*.js`
2. **Working directory**: Patterns are relative to your current directory
3. **Git ignore**: Files may be excluded by `.gitignore` or `.repomixignore`
4. **Test manually**: Run `npx repomix --include "your-pattern" --output test.txt` to verify

### "Invalid API key" or Authentication Errors

1. Verify your API key in `.oraclerc` starts with `sk-...`
2. Check that your account has GPT-5 Pro access enabled
3. Ensure you have sufficient API credits

### Requests Timeout

If requests consistently timeout:
1. Increase `maxWaitMinutes` in `.oraclerc` (default: 25 minutes)
2. Check OpenAI API status at status.openai.com
3. Reduce the size of your code context

### Plugin Not Loading

If the skill doesn't auto-invoke:
1. Verify installation: `/plugin list`
2. Restart Claude Code: `/restart`
3. Check logs for errors: Look for skill loading messages
4. Try manual global installation as fallback

## Upgrading

### Plugin Installation
```bash
# Update to latest version
/plugin update ask-the-oracle@robgruhl
/restart
```

### Manual Installation
```bash
cd ~/.claude/global-skills/ask-the-oracle  # or your install location
git pull origin main
bun install  # or npm install
```

## Uninstalling

### Plugin Installation
```bash
/plugin uninstall ask-the-oracle@robgruhl
```

### Manual Installation
```bash
rm -rf ~/.claude/global-skills/ask-the-oracle
```

---

**Status**: Production Ready - V1.0 Complete ✅

**Version**: 1.0.0 (Plugin Release)

**Last Updated**: 2025-11-11
