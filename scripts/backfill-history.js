#!/usr/bin/env node
/**
 * backfill-history.js — Re-retrieve an oracle response from OpenAI and
 * update (or create) the local history file with the actual output.
 *
 * Usage:  node scripts/backfill-history.js <requestId>
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import OpenAI from 'openai';
import { stripJsonComments } from '../skills/ask-the-oracle/scripts/oracle-service.js';

const requestId = process.argv[2];
if (!requestId) {
  console.error('Usage: node scripts/backfill-history.js <requestId>');
  process.exit(1);
}

// Read API key from .oraclerc
const rcPath = join(process.cwd(), '.oraclerc');
const rcRaw = await readFile(rcPath, 'utf8');
const rc = JSON.parse(stripJsonComments(rcRaw));
const apiKeyRef = rc.providers?.openai?.apiKey || '';
const apiKey = apiKeyRef.startsWith('$') ? process.env[apiKeyRef.slice(1)] : apiKeyRef;

if (!apiKey) {
  console.error('No API key found. Check .oraclerc or set OPENAI_API_KEY.');
  process.exit(1);
}

// Retrieve directly from OpenAI
const client = new OpenAI({ apiKey });
const rawResponse = await client.responses.retrieve(requestId);

// Normalize (same as openai.js provider)
const usage = {
  inputTokens: rawResponse.usage?.input_tokens || 0,
  outputTokens: rawResponse.usage?.output_tokens || 0,
  reasoningTokens: rawResponse.usage?.output_tokens_details?.reasoning_tokens || 0,
  totalTokens: rawResponse.usage?.total_tokens || 0,
};

let output = '';
if (rawResponse.output && Array.isArray(rawResponse.output)) {
  const message = rawResponse.output.find(item => item.type === 'message');
  if (message?.content && Array.isArray(message.content)) {
    output = message.content
      .filter(item => item.type === 'output_text' || item.type === 'text')
      .map(item => item.text)
      .join('\n\n');
  }
}

const pricing = { input: 30.00, output: 180.00 };
const cost = (usage.inputTokens / 1e6) * pricing.input
           + (usage.outputTokens / 1e6) * pricing.output;

// Load existing history file or create new
const historyDir = join(process.cwd(), '.claude/oracle-history');
const historyFile = join(historyDir, `oracle-${requestId}.json`);

let entry;
try {
  entry = JSON.parse(await readFile(historyFile, 'utf8'));
} catch {
  entry = {
    timestamp: new Date().toISOString(),
    question: '',
    patterns: [],
    packedFiles: 0,
    provider: 'openai',
    model: rawResponse.model || 'unknown',
    requestId,
  };
}

// Patch in actual response data
entry.status = rawResponse.status;
entry.response = output;
entry.usage = usage;
entry.cost = cost;
entry.inputTokens = usage.inputTokens;

await writeFile(historyFile, JSON.stringify(entry, null, 2));
console.log(`Updated ${historyFile}`);
console.log(`  status:   ${entry.status}`);
console.log(`  response: ${output.length} chars`);
console.log(`  cost:     $${cost.toFixed(2)}`);
