# Changelog

All notable changes to Ask the Oracle will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-03-13

### Changed
- Updated dependencies: repomix 1.12.0, openai 6.29.0, chalk 5.6.2, ora 9.3.0
- Resolved all 8 npm audit vulnerabilities (now 0)
- Removed node_modules from git tracking (was 193MB)
- Aligned plugin.json and SKILL.md with Anthropic spec
- SKILL.md uses `${CLAUDE_SKILL_DIR}` for portable paths
- Improved skill description for better auto-triggering
- Updated pricing to March 2026 rates ($30/M input, $180/M output)
- Removed dead code (unused imports, uncalled methods, unenforced config fields)
- Consolidated docs: replaced 5 stale reference copies with single REFERENCES.md
- Trimmed README from 509 to 140 lines, CLAUDE.md from 272 to 127 lines

### Removed
- Obsolete planning docs (PLAN, PRD, HANDOFF, etc.)
- .claude-plugin/README.md (only plugin.json belongs per spec)

## [1.0.0] - 2025-11-11

### Added
- Initial release with OpenAI GPT-5.4 Pro integration
- Cost tracking and transparent breakdown
- History storage in `.claude/oracle-history/`
- Repomix integration for code packaging
- Configuration system via `.oraclerc`
- Provider abstraction layer for future multi-model support
- Long-running request handling with polling (Responses API)
- Background Bash execution for non-blocking operation
