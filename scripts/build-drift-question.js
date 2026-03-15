#!/usr/bin/env node
/**
 * Build the drift-check question from the three prior oracle Q&A history files.
 * Outputs the assembled question text to stdout.
 */

import { readFile } from 'fs/promises';

const historyDir = '/Users/robgruhl/Projects/ask-the-oracle/.claude/oracle-history';

const ids = [
  'resp_073d04376ff3743d0069b66798aef481a1beca78f1cd44e66c',
  'resp_02734482898b90b60069b66b4e9d88819298c53d816bde8b7d',
  'resp_04150c67a73d7c8c0069b6c6c66d80819796d5e591573ebbbc',
];

const labels = [
  'Response 1: Initial Architectural Review (completed)',
  'Response 2: Delivery Plan — Phase 0 + Phase 1 (truncated at 16K tokens)',
  'Response 3: Continuation — Phase 2, Phase 3, Responsiveness, Autodefense (completed)',
];

const parts = [
  `DRIFT AND CONSISTENCY CHECK — Three prior oracle consultations analyzed the same Terraria AI autopilot system. Each was an independent GPT-5.4 Pro request, so they may contain contradictions, drift, or inconsistencies. The code files attached are the CURRENT state of the codebase.`,
  '',
  'Please carefully review all three Q&A exchanges below against each other AND against the current code, then produce:',
  '',
  '1. **CONTRADICTIONS**: Any places where the three responses directly contradict each other (e.g., different recommendations for the same thing, conflicting phase ordering, incompatible designs)',
  '2. **DRIFT**: Recommendations that shifted or evolved across responses without acknowledgment (e.g., a Phase 1 item in Response 2 that became Phase 2 in Response 3)',
  '3. **STALE RECOMMENDATIONS**: Anything recommended that the current code already implements or that is no longer applicable given recent changes',
  '4. **GAPS**: Important topics raised in one response but dropped or not carried forward in later ones',
  '5. **CONSOLIDATED ERRATA**: A clean, authoritative list of corrections — for each issue found, state what the correct/best recommendation is',
  '',
  '---',
  '',
];

for (let i = 0; i < ids.length; i++) {
  const data = JSON.parse(await readFile(`${historyDir}/oracle-${ids[i]}.json`, 'utf8'));
  parts.push(`# ${labels[i]}`);
  parts.push('');
  parts.push('## Question');
  parts.push('');
  parts.push(data.question || '(not recorded)');
  parts.push('');
  parts.push('## Answer');
  parts.push('');
  parts.push(data.response || '(empty)');
  parts.push('');
  parts.push('---');
  parts.push('');
}

const question = parts.join('\n');
process.stdout.write(question);
