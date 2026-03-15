#!/usr/bin/env node
/**
 * Submit the drift-check oracle request.
 * Reads the question from /tmp/oracle-drift-question.txt
 * and submits it with the autopilot code files.
 */

import { readFile } from 'fs/promises';
import { Oracle } from '../skills/ask-the-oracle/scripts/oracle-service.js';

const question = await readFile('/tmp/oracle-drift-question.txt', 'utf8');

const patterns = [
  process.env.HOME + '/Projects/terrar-ai/tModLoader/src/Terraria/Terraria/Testing/AutopilotSequencer.cs',
  process.env.HOME + '/Projects/terrar-ai/tModLoader/src/Terraria/Terraria/Testing/AutopilotController.cs',
  process.env.HOME + '/Projects/terrar-ai/tModLoader/src/Terraria/Terraria/Testing/AutopilotRunner.cs',
  process.env.HOME + '/Projects/terrar-ai/tModLoader/src/Terraria/Terraria/Testing/AutopilotStateWriter.cs',
  process.env.HOME + '/.claude/skills/autopilot-driver/SKILL.md',
  process.env.HOME + '/.claude/skills/autopilot-driver/scripts/send-commands.sh',
  process.env.HOME + '/.claude/skills/autopilot-driver/scripts/wait-idle.sh',
  process.env.HOME + '/.claude/skills/autopilot-driver/scripts/read-state.sh',
  process.env.HOME + '/Projects/terrar-ai/reference/18-autopilot.md',
];

const oracle = new Oracle();
await oracle.init();

const result = await oracle.submit({ patterns, question });

console.log(JSON.stringify({
  schemaVersion: 1,
  ok: true,
  command: 'submit',
  data: result
}, null, 2));
