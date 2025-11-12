# Claude Code Skills Documentation

## Overview

Agent Skills are modular capabilities that extend Claude's functionality in Claude Code. They consist of instruction files and optional supporting resources that Claude autonomously uses when relevant to user requests.

**Official Docs**: https://code.claude.com/docs/en/skills

## What Are Agent Skills?

Agent Skills package expertise into discoverable capabilities. Key characteristics:

- **Model-invoked**: Claude autonomously decides when to use them (not manually triggered)
- **Self-contained**: Each skill is a folder with instructions and resources
- **Context-aware**: Claude loads skills when they match the request
- **Tool-integrated**: Can use any of Claude's available tools

## SKILL.md Structure

Every skill requires a `SKILL.md` file with YAML frontmatter and Markdown content:

```markdown
---
name: your-skill-name
description: Brief description of what this Skill does and when to use it
---

# Your Skill Name

## Instructions
Provide clear, step-by-step guidance for Claude.

## Examples
Show concrete examples of using this Skill.
```

### YAML Frontmatter Requirements

#### Required Fields

**name** (required)
- Format: lowercase letters, numbers, hyphens only
- Max length: 64 characters
- Example: `ask-the-oracle`, `code-reviewer`, `api-tester`

**description** (required)
- Max length: 1024 characters
- Critical for Claude's discovery mechanism
- Should include:
  - What the skill does
  - When Claude should use it
  - Specific trigger terms

#### Optional Fields

**allowed-tools** (optional)
- Restricts Claude to specified tools
- No permission requests needed for listed tools
- Useful for read-only or security-sensitive skills

Example:
```yaml
allowed-tools: Read, Grep, Glob
```

### Description Best Practices

**Bad description (too vague):**
```yaml
description: Helps with documents
```

**Good description (specific triggers):**
```yaml
description: Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files, when user mentions PDFs, or requests document manipulation.
```

**Great description (comprehensive):**
```yaml
description: Submit complex code questions to GPT-5 Pro for deep analysis when you have 20 minutes. Use when the user asks architectural questions, needs comprehensive code review, debugging complex issues, or requests expert analysis of their codebase. Automatically handles file selection, question formulation, long-running API requests, and cost calculation.
```

Key elements:
- Specific capabilities ("Extract text", "Submit questions")
- Clear use cases ("when user mentions PDFs", "debugging complex issues")
- Trigger phrases ("architectural questions", "comprehensive code review")
- Value proposition ("deep analysis", "automatically handles")

## File Organization

### Skill Locations

Skills can be stored in three locations (checked in order):

1. **Personal Skills**: `~/.claude/skills/`
   - Individual workflows
   - Private configurations
   - Not version controlled

2. **Project Skills**: `.claude/skills/`
   - Team-shared expertise
   - Version controlled (committed to repo)
   - Project-specific workflows

3. **Plugin Skills**: Installed via plugins
   - Bundled with packages
   - Managed by plugin system

### Directory Structure

Basic skill:
```
my-skill/
└── SKILL.md
```

Complex skill with resources:
```
ask-the-oracle/
├── SKILL.md                    # Main skill definition (required)
├── reference.md                # Additional documentation
├── examples.md                 # Usage examples
├── scripts/
│   ├── oracle.js              # Main script
│   ├── repomix-wrapper.js     # Helper modules
│   └── cost-calculator.js
├── templates/
│   └── question-template.md   # Prompt templates
├── config/
│   └── default-config.json    # Default settings
└── .oraclerc                  # User configuration
```

### Referencing Supporting Files

Use relative paths in SKILL.md:

```markdown
Refer to [Reference Documentation](./reference.md) for detailed API info.

See [Examples](./examples.md) for common usage patterns.

The main script is located at `./scripts/oracle.js`.
```

## Writing Effective Instructions

### Structure

```markdown
## Instructions

1. **First Step**: Clear action to take
   - Detail 1
   - Detail 2

2. **Second Step**: Next action
   - How to handle scenario A
   - How to handle scenario B

3. **Final Step**: Completion
   - What success looks like
   - What to return to user
```

### Best Practices

**Be specific and actionable:**
```markdown
❌ "Help the user with their question"
✓ "Ask 3 clarifying questions using AskUserQuestion tool"
```

**Include tool guidance:**
```markdown
Use the Bash tool to run: `repomix --include "src/**/*.js" --compress`
Use the Read tool to examine: `.oraclerc` configuration file
Use the AskUserQuestion tool to confirm estimated cost > $5
```

**Provide conditional logic:**
```markdown
If the estimated cost exceeds $5.00:
- Display cost breakdown
- Ask user to confirm with AskUserQuestion
- Only proceed if user confirms "yes"

Otherwise:
- Proceed automatically
- Show cost in final results
```

**Show expected outputs:**
```markdown
Present results in this format:

╔═══════════════════════════════════════╗
║         ORACLE RESPONSE READY         ║
╚═══════════════════════════════════════╝

Time elapsed: 18.3 minutes
Cost: $4.11

[Response here]
```

## Examples Section

Include concrete examples in SKILL.md:

```markdown
## Examples

### Example 1: Memory Leak Analysis

User: "I have a memory leak in my Python service"

1. Skill asks clarifying questions
2. User selects relevant files: `src/service.py`, `src/handlers/*.py`
3. Repomix packs ~45K tokens
4. Estimated cost: $3.20
5. Submit to Oracle
6. Wait ~18 minutes
7. Present detailed analysis with fixes

### Example 2: Architecture Review

User: "Review the architecture of my API"

1. Skill identifies API-related files
2. User confirms selection: `src/api/**/*.js`, `src/models/**/*.js`
3. Repomix packs ~80K tokens (with compression)
4. Estimated cost: $5.40
5. User confirms (exceeds $5 threshold)
6. Submit to Oracle
7. Wait ~22 minutes
8. Present architecture analysis with recommendations
```

## Tool Restrictions

### Why Restrict Tools?

- Security: Prevent unintended modifications
- Clarity: Focus skill on specific operations
- Performance: Reduce decision overhead
- Safety: Enforce read-only workflows

### How to Restrict

```yaml
---
name: code-analyzer
description: Analyzes code structure without making changes
allowed-tools: Read, Grep, Glob, Bash
---
```

This skill can only:
- Read files
- Search code
- Find files
- Run commands (read-only)

Cannot:
- Write or Edit files
- Use WebFetch
- Create tasks
- Etc.

### Common Tool Combinations

**Read-only analysis:**
```yaml
allowed-tools: Read, Grep, Glob
```

**Code execution:**
```yaml
allowed-tools: Read, Write, Bash
```

**Interactive workflows:**
```yaml
allowed-tools: Read, Grep, Glob, AskUserQuestion, TodoWrite
```

**Full access (default):**
```yaml
# Omit allowed-tools to give Claude access to all tools
```

## Testing Skills

### Basic Testing

After creating a skill, test by asking questions that match your description:

```
User: "I need expert analysis of my codebase"
→ Should trigger ask-the-oracle skill

User: "What does this function do?"
→ Should NOT trigger ask-the-oracle (simple question)
```

### Debugging

If skill isn't loading:

1. **Check YAML syntax**
   ```bash
   # YAML is whitespace-sensitive
   # No tabs allowed, use spaces
   # Verify indentation
   ```

2. **Verify file paths**
   ```bash
   ls -la .claude/skills/ask-the-oracle/
   cat .claude/skills/ask-the-oracle/SKILL.md
   ```

3. **Use debug mode**
   ```bash
   claude --debug
   ```

4. **Check description specificity**
   - Too vague? Add specific trigger terms
   - Too narrow? Broaden use cases
   - Missing keywords? Add common user phrases

### Common Issues

**Skill not triggering:**
- Description too vague
- Missing trigger keywords
- Name conflicts with other skills

**Skill errors during execution:**
- Invalid tool usage
- Missing dependencies
- File path errors
- Configuration issues

**Skill triggering incorrectly:**
- Description too broad
- Overlapping with other skills
- Ambiguous trigger terms

## Advanced Features

### Multi-Step Workflows

Skills can orchestrate complex workflows:

```markdown
## Instructions

### Phase 1: Discovery
1. Use Glob to find relevant files
2. Use Grep to search for patterns
3. Present findings to user

### Phase 2: Processing
1. Use Read to examine files
2. Use Bash to run analysis tools
3. Collect results

### Phase 3: Results
1. Format output
2. Calculate metrics
3. Present to user
```

### External Tool Integration

Skills can call external tools:

```markdown
## Instructions

1. Run Repomix to pack code:
   ```bash
   npx repomix --include "src/**/*.js" --compress -o /tmp/packed.xml
   ```

2. Submit to OpenAI API:
   ```bash
   node ./scripts/oracle.js /tmp/packed.xml
   ```

3. Parse and present results
```

### State Management

Skills can maintain state across invocations:

```markdown
## Instructions

1. Check for previous request:
   - Read `.oracle-request.json` if exists
   - If status != 'completed', resume polling

2. If new request:
   - Create response ID
   - Save to `.oracle-request.json`
   - Begin polling

3. Update state file on completion
```

### Cost Estimation

For paid API skills:

```markdown
## Important Notes

- This skill makes external API calls to OpenAI
- Typical costs: $2-$10 per request
- Always estimate and confirm costs before submission
- User must have sufficient API credits
```

## Skill Composition

Skills can reference other skills:

```markdown
## Instructions

1. First, invoke the `code-analyzer` skill to understand structure

2. Then invoke the `ask-the-oracle` skill for deep analysis

3. Finally, invoke the `report-generator` skill to create summary
```

Note: Skills are still model-invoked; this is guidance for Claude on workflow.

## Example: Complete Ask the Oracle Skill

```yaml
---
name: ask-the-oracle
description: Submit complex code questions to GPT-5 Pro for deep analysis when you have 20 minutes. Use when the user asks architectural questions, needs comprehensive code review, debugging complex issues, or requests expert analysis of their codebase. Automatically handles file selection, question formulation, long-running API requests, and cost calculation.
allowed-tools: Read, Write, Grep, Glob, Bash, AskUserQuestion, TodoWrite
---

# Ask the Oracle

Inspired by Andrej Karpathy's approach of consulting GPT-5 Pro as an "Oracle" for complex code questions.

## When to Use This Skill

Use this skill when the user:
- Asks complex architectural or design questions
- Needs debugging help for difficult issues
- Requests comprehensive code review or analysis
- Wants expert analysis beyond Claude's immediate scope
- Says things like "deep dive", "expert analysis", "comprehensive review"
- Is willing to wait 10-20 minutes for high-quality results

Do NOT use for:
- Simple, quick questions
- Questions Claude can answer directly
- Tasks requiring immediate response
- File editing or code generation

## Instructions

### Phase 1: Context Collection

1. **Understand the question**
   - Capture the user's original question
   - Identify the scope (architecture, bug, optimization, etc.)

2. **Select relevant files**
   - Use Glob to show project structure: `**/*.{js,ts,py,java,go}`
   - Ask user which files/patterns to include using AskUserQuestion
   - Show token count estimate from Repomix: `npx repomix --token-count-tree`
   - Allow multiple selection rounds if needed

3. **Pack the codebase**
   - Run Repomix with optimal settings:
     ```bash
     npx repomix --include "user-selected-patterns" \
       --style xml \
       --compress \
       --output-show-line-numbers \
       -o /tmp/oracle-context.xml
     ```
   - Use Read tool to get final token count

### Phase 2: Question Formulation

1. **Gather details** using AskUserQuestion:
   - "What specific aspect are you investigating?"
   - "What is the expected behavior?"
   - "What have you already tried?"

2. **Format the question**
   - Combine context + user question
   - Use template from `./templates/question-template.md`
   - Show formatted question to user for approval

3. **Estimate cost**
   - Calculate using ./scripts/cost-calculator.js:
     - Input tokens from Repomix
     - Expected output ~8-15K tokens
     - GPT-5 Pro pricing: $15/M input, $120/M output
   - If cost > $5.00, ask user to confirm with AskUserQuestion

### Phase 3: Submit to Oracle

1. **Submit request**
   - Run: `node ./scripts/oracle.js submit <context-file> <question>`
   - Save response ID to `.oracle-request.json`
   - Inform user: "Submitted to Oracle. This may take up to 20 minutes..."

2. **Poll for completion**
   - Run: `node ./scripts/oracle.js poll <response-id>`
   - Show progress updates every minute
   - Handle timeout (25 min max)
   - Handle errors gracefully

3. **Enable recovery**
   - If session ends, save state to `.oracle-request.json`
   - On restart, check for incomplete requests
   - Offer to resume: "You have a pending Oracle request. Resume?"

### Phase 4: Present Results

1. **Calculate actual cost**
   - Parse usage from response
   - Calculate with ./scripts/cost-calculator.js
   - Show breakdown (input + reasoning + output)

2. **Format output**
   ```
   ╔═══════════════════════════════════════╗
   ║         ORACLE RESPONSE READY         ║
   ╚═══════════════════════════════════════╝

   Time elapsed: [minutes]

   Cost Breakdown:
   - Input tokens:    X @ $15/M  = $Y
   - Reasoning tokens: X @ $15/M  = $Y
   - Output tokens:    X @ $120/M = $Y
   ────────────────────────────────────────
   Total cost: $Z.ZZ

   Response:
   [Full GPT-5 Pro response]
   ```

3. **Save to history**
   - Write complete record to `.claude/oracle-history/`
   - Include: question, files, response, metadata
   - Inform user of saved location

## Configuration

Users must set up `.oraclerc` in project root:

```json
{
  "openai": {
    "apiKey": "sk-...",
    "model": "gpt-5-pro"
  },
  "limits": {
    "maxCostPerRequest": 10.00,
    "warnCostThreshold": 5.00
  }
}
```

If `.oraclerc` doesn't exist, show setup instructions.

## Error Handling

- **No API key**: Show setup instructions
- **Insufficient credits**: Link to OpenAI billing
- **Timeout**: Explain, offer to check later via response ID
- **Rate limit**: Suggest waiting, show retry time
- **Context too large**: Suggest reducing files

## Important Notes

- This skill makes external API calls to OpenAI
- Responses typically take 10-20 minutes
- Costs range from $2-$10 depending on codebase size
- Always confirm with user before submission
- User must have OpenAI API key configured
- Not suitable for sensitive/proprietary code (OpenAI retains 30 days)

## Examples

See [examples.md](./examples.md) for detailed usage scenarios.
```

## Distribution and Sharing

### Project-Level Skills

Commit to version control:

```bash
git add .claude/skills/ask-the-oracle/
git commit -m "Add Oracle skill for deep code analysis"
git push
```

Team members automatically get skill when they pull.

### Personal Skills

Keep in `~/.claude/skills/` for private workflows:

```bash
mv .claude/skills/my-secret-skill ~/.claude/skills/
```

### Plugin Skills

Package as npm/plugin for wider distribution:

```json
{
  "name": "claude-skill-oracle",
  "version": "1.0.0",
  "claudeSkills": {
    "ask-the-oracle": "./skills/ask-the-oracle"
  }
}
```

## Resources

- Official docs: https://code.claude.com/docs/en/skills
- Anthropic blog: https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
- GitHub examples: https://github.com/anthropics/skills
- Community skills: https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/
