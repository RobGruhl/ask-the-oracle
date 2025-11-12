# OpenAI Responses API Documentation

## Overview

The Responses API is a new stateful API from OpenAI that unifies chat completions and assistants capabilities. It's designed to be simpler and more flexible, with native support for stateful conversations, multimodal inputs, and long-running background processing.

**Official Docs**: https://platform.openai.com/docs/api-reference/responses
**Azure Docs**: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/responses

## Key Features

- **Stateful conversations**: API maintains conversation history automatically
- **Multi-turn interactions**: Seamless conversation across multiple steps
- **Background mode**: Support for long-running tasks (o1-pro, o3, GPT-5 Pro)
- **Multimodal support**: Text, images, PDFs, audio in single request
- **Tool integration**: Web search, file search, code interpreter, function calling
- **Response chaining**: Continue from any previous response point

## Supported Models

### GPT-5 Series
- `gpt-5-pro` - Most powerful, extended reasoning
- `gpt-5` - Standard GPT-5
- `gpt-5-mini` - Efficient variant
- `gpt-5-nano` - Lightweight
- Various dated variants (gpt-5-2025-08-01, etc.)

### GPT-4 Series
- `gpt-4o`, `gpt-4o-mini`
- `gpt-4.1` and variants

### Reasoning Models
- `o1`, `o1-pro`
- `o3`, `o3-mini`
- `o4-mini`

### Specialized
- `computer-use-preview`
- `gpt-image-1` series

## API Client Setup

### Installation

```bash
npm install openai
```

### Initialize Client

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
```

## Core Operations

### 1. Create Response (Synchronous)

Basic text response generation:

```javascript
const response = await openai.responses.create({
  model: "gpt-5-pro",
  input: [
    {
      type: "input_text",
      text: "Analyze this codebase..."
    }
  ],
  temperature: 0.2,
  max_output_tokens: 16000
});

console.log(response.output);
```

### 2. Background Mode (Asynchronous)

For long-running tasks that may take 20+ minutes:

```javascript
const response = await openai.responses.create({
  model: "gpt-5-pro",
  background: true,  // Enable background processing
  input: [
    {
      type: "input_text",
      text: "Deep analysis of large codebase..."
    }
  ]
});

console.log('Response ID:', response.id);
console.log('Status:', response.status);  // Will be 'queued' or 'in_progress'
```

### 3. Poll for Completion

When using background mode, you must poll for completion:

```javascript
async function pollForCompletion(responseId, maxWaitMinutes = 25) {
  const startTime = Date.now();
  const pollInterval = 3000; // 3 seconds (minimum 2 seconds recommended)

  while (Date.now() - startTime < maxWaitMinutes * 60 * 1000) {
    // Wait before polling
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    // Retrieve current status
    const response = await openai.responses.retrieve(responseId);

    // Check terminal states
    if (response.status === 'completed') {
      return response;
    } else if (response.status === 'failed') {
      throw new Error(`Request failed: ${response.error}`);
    } else if (response.status === 'cancelled') {
      throw new Error('Request was cancelled');
    }

    // Status is 'queued' or 'in_progress'
    const elapsedMinutes = ((Date.now() - startTime) / 60000).toFixed(1);
    console.log(`Still processing... (${elapsedMinutes} min, status: ${response.status})`);
  }

  throw new Error(`Timeout: exceeded ${maxWaitMinutes} minutes`);
}

// Usage
try {
  const result = await pollForCompletion(response.id);
  console.log('Completed!', result.output);
} catch (error) {
  console.error('Error:', error.message);
}
```

### 4. Retrieve Response

Get any previous response by ID:

```javascript
const response = await openai.responses.retrieve('resp_abc123');

console.log('Status:', response.status);
console.log('Output:', response.output);
console.log('Usage:', response.usage);
```

### 5. Cancel Response

Cancel a running background request:

```javascript
await openai.responses.cancel('resp_abc123');
```

This operation is idempotent (safe to call multiple times).

### 6. Delete Response

Responses are retained for 30 days by default. Delete earlier if needed:

```javascript
await openai.responses.delete('resp_abc123');
```

## Response Status Lifecycle

```
queued → in_progress → completed
                    ↘ failed
                    ↘ cancelled
```

**Status meanings:**
- `queued`: Request accepted, waiting to process
- `in_progress`: Currently being processed
- `completed`: Successfully finished
- `failed`: Error occurred (check `error` field)
- `cancelled`: User cancelled the request

## Response Chaining

Continue from a previous response without resending history:

```javascript
// First question
const response1 = await openai.responses.create({
  model: "gpt-5-pro",
  input: [{ type: "input_text", text: "Explain this code" }]
});

// Follow-up question
const response2 = await openai.responses.create({
  model: "gpt-5-pro",
  previous_response_id: response1.id,  // Chain from previous
  input: [{ type: "input_text", text: "Now optimize it" }]
});
```

This maintains conversation context without resending the entire history.

## Input Types

### Text Input

```javascript
{
  type: "input_text",
  text: "Your prompt here"
}
```

### Image Input (URL)

```javascript
{
  type: "input_image",
  image: {
    url: "https://example.com/image.jpg"
  }
}
```

### Image Input (Base64)

```javascript
{
  type: "input_image",
  image: {
    data: "base64-encoded-image-data",
    format: "png"  // or "jpeg", "gif", "webp"
  }
}
```

### PDF Input

```javascript
{
  type: "input_text",
  text: "base64-encoded-pdf-data"
}
```

PDFs are converted - text and page images included in context.

### File Input

```javascript
// First upload file
const file = await openai.files.create({
  file: fs.createReadStream('document.pdf'),
  purpose: 'assistants'
});

// Then reference in response
{
  type: "input_file",
  file_id: file.id
}
```

## Output Handling

### Basic Output

```javascript
const response = await openai.responses.create({...});

// Text output
console.log(response.output.text);

// Check for multiple output items
response.output.forEach(item => {
  if (item.type === 'text') {
    console.log(item.text);
  } else if (item.type === 'image') {
    console.log('Image URL:', item.image.url);
  }
});
```

### Streaming

Enable real-time token delivery:

```javascript
const stream = await openai.responses.create({
  model: "gpt-5-pro",
  stream: true,
  input: [{ type: "input_text", text: "Explain..." }]
});

for await (const chunk of stream) {
  if (chunk.type === 'response.output_text.delta') {
    process.stdout.write(chunk.delta);
  }
}
```

### Stream Resumption

If streaming is interrupted, resume from last position:

```javascript
const stream = await openai.responses.retrieve(responseId, {
  stream: true,
  starting_after: lastSequenceNumber
});
```

## Usage and Cost Tracking

Every response includes usage statistics:

```javascript
const response = await openai.responses.retrieve(responseId);

const usage = response.usage;
console.log('Input tokens:', usage.input_tokens);
console.log('Output tokens:', usage.output_tokens);
console.log('Reasoning tokens:', usage.reasoning_tokens || 0);

// Calculate cost (GPT-5 Pro pricing)
const inputCost = (usage.input_tokens / 1_000_000) * 15.00;
const outputCost = (usage.output_tokens / 1_000_000) * 120.00;
const reasoningCost = ((usage.reasoning_tokens || 0) / 1_000_000) * 15.00;

const totalCost = inputCost + outputCost + reasoningCost;
console.log('Total cost: $' + totalCost.toFixed(2));
```

## GPT-5 Pro Pricing (November 2025)

| Token Type | Cost per 1M tokens |
|------------|-------------------|
| Input      | $15.00            |
| Reasoning  | $15.00            |
| Output     | $120.00           |

**Example costs:**
- Small query (10K in, 2K out): ~$0.40
- Medium analysis (50K in, 8K out): ~$1.71
- Large review (100K in, 15K out): ~$3.30
- Oracle session (125K in, 45K reasoning, 13K out): ~$4.26

## Advanced Parameters

### Temperature

Controls randomness (0.0 to 2.0):

```javascript
{
  temperature: 0.2  // Lower = more deterministic (good for code analysis)
}
```

### Max Output Tokens

Limit response length:

```javascript
{
  max_output_tokens: 16000  // GPT-5 Pro supports up to 16K output
}
```

### Top P

Alternative to temperature for nucleus sampling:

```javascript
{
  top_p: 0.9
}
```

Note: Use either temperature or top_p, not both.

## Tool Integration

### Web Search

```javascript
const response = await openai.responses.create({
  model: "gpt-5-pro",
  tools: [{ type: "web_search" }],
  input: [{ type: "input_text", text: "Latest React best practices" }]
});
```

### Code Interpreter

Execute Python in sandboxed environment:

```javascript
const response = await openai.responses.create({
  model: "gpt-5-pro",
  tools: [{ type: "code_interpreter" }],
  input: [{ type: "input_text", text: "Analyze this dataset..." }]
});
```

Note: Code interpreter incurs additional charges beyond token costs.

### Function Calling

Define custom functions:

```javascript
const response = await openai.responses.create({
  model: "gpt-5-pro",
  tools: [{
    type: "function",
    function: {
      name: "get_code_metrics",
      description: "Retrieve code metrics for a file",
      parameters: {
        type: "object",
        properties: {
          file_path: { type: "string" },
          metrics: { type: "array", items: { type: "string" } }
        },
        required: ["file_path"]
      }
    }
  }],
  input: [{ type: "input_text", text: "Get metrics for main.js" }]
});

// Handle function call
if (response.output[0].type === 'function_call') {
  const call = response.output[0].function_call;
  const result = await getCodeMetrics(call.arguments);

  // Continue with function result
  const response2 = await openai.responses.create({
    model: "gpt-5-pro",
    previous_response_id: response.id,
    input: [{
      type: "function_call_output",
      call_id: call.id,
      output: JSON.stringify(result)
    }]
  });
}
```

## Error Handling

### Common Error Types

```javascript
try {
  const response = await pollForCompletion(responseId);
} catch (error) {
  if (error.status === 429) {
    console.error('Rate limit exceeded');
  } else if (error.status === 401) {
    console.error('Invalid API key');
  } else if (error.status === 402) {
    console.error('Insufficient credits');
  } else if (error.status === 503) {
    console.error('Model temporarily unavailable');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Response Error Fields

```javascript
if (response.status === 'failed') {
  console.error('Error code:', response.error.code);
  console.error('Error message:', response.error.message);
}

if (response.incomplete_details) {
  console.warn('Incomplete reason:', response.incomplete_details.reason);
}
```

## Best Practices for Ask the Oracle

### 1. Always Use Background Mode

```javascript
const response = await openai.responses.create({
  model: "gpt-5-pro",
  background: true,  // Essential for 20min requests
  // ... other params
});
```

### 2. Implement Robust Polling

```javascript
// Poll every 3 seconds with progress updates
// Handle all terminal states
// Set generous timeout (25+ minutes)
```

### 3. Save Request State

```javascript
// Immediately save response ID after creation
await saveOracleRequest({
  id: response.id,
  timestamp: new Date(),
  status: response.status,
  question: userQuestion
});
```

### 4. Calculate Costs Before Submission

```javascript
// Estimate tokens using Repomix
const estimatedCost = (inputTokens / 1_000_000) * 15.00 +
                     (expectedOutputTokens / 1_000_000) * 120.00;

// Confirm with user if exceeds threshold
if (estimatedCost > 5.00) {
  await confirmWithUser(`Estimated cost: $${estimatedCost.toFixed(2)}`);
}
```

### 5. Handle Interruptions Gracefully

```javascript
// Enable recovery from saved response ID
const savedRequest = await loadOracleRequest();
if (savedRequest && savedRequest.status !== 'completed') {
  console.log('Resuming previous Oracle request...');
  const result = await pollForCompletion(savedRequest.id);
}
```

## Complete Oracle Integration Example

```javascript
import OpenAI from 'openai';
import fs from 'fs/promises';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function askOracle(context, question) {
  // 1. Create request in background mode
  console.log('Submitting to Oracle...');
  const response = await openai.responses.create({
    model: "gpt-5-pro",
    background: true,
    temperature: 0.2,
    max_output_tokens: 16000,
    input: [
      {
        type: "input_text",
        text: `${context}\n\n${question}`
      }
    ]
  });

  // 2. Save request state
  await fs.writeFile('.oracle-request.json', JSON.stringify({
    id: response.id,
    timestamp: new Date().toISOString(),
    question
  }));

  console.log(`Response ID: ${response.id}`);
  console.log('Oracle is thinking... (this may take up to 20 minutes)');

  // 3. Poll for completion
  const startTime = Date.now();
  let lastUpdate = startTime;

  while (true) {
    await new Promise(resolve => setTimeout(resolve, 3000));

    const current = await openai.responses.retrieve(response.id);

    // Check terminal states
    if (current.status === 'completed') {
      const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
      console.log(`\n✓ Response received after ${elapsed} minutes!`);

      // Calculate cost
      const cost = calculateCost(current.usage);
      console.log(`Cost: $${cost.toFixed(2)}`);

      return {
        output: current.output[0].text,
        usage: current.usage,
        cost,
        elapsed
      };
    } else if (current.status === 'failed') {
      throw new Error(`Oracle failed: ${current.error.message}`);
    } else if (current.status === 'cancelled') {
      throw new Error('Oracle request was cancelled');
    }

    // Progress update every minute
    if (Date.now() - lastUpdate > 60000) {
      const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
      console.log(`[${elapsed} min] Status: ${current.status}...`);
      lastUpdate = Date.now();
    }
  }
}

function calculateCost(usage) {
  const inputCost = (usage.input_tokens / 1_000_000) * 15.00;
  const outputCost = (usage.output_tokens / 1_000_000) * 120.00;
  const reasoningCost = ((usage.reasoning_tokens || 0) / 1_000_000) * 15.00;
  return inputCost + outputCost + reasoningCost;
}

// Usage
const context = await fs.readFile('packed-code.xml', 'utf-8');
const question = "Analyze this codebase for memory leaks...";

const result = await askOracle(context, question);
console.log(result.output);
```

## Regional Availability

The Responses API operates across 24 Azure regions:
- North America: East US, West US, Central US, etc.
- Europe: West Europe, North Europe, UK South, etc.
- Asia-Pacific: Southeast Asia, Japan East, Australia East, etc.

Check current availability at: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/

## API Rate Limits

Rate limits vary by tier:
- Free tier: Very limited (not suitable for Oracle use)
- Pay-as-you-go: Moderate limits
- **Pro tier**: Recommended for Oracle (higher limits, GPT-5 Pro access)

## Security Considerations

- API keys should never be committed to version control
- Store in environment variables or secure config
- OpenAI retains data for 30 days (Responses API)
- For sensitive code, review data retention policies
- Consider excluding files with secrets before packing

## Troubleshooting

### Request times out
- Increase maxWaitMinutes beyond 20 minutes
- Check model availability status
- Verify sufficient API credits

### Rate limit errors
- Implement exponential backoff
- Upgrade to Pro tier for higher limits
- Reduce request frequency

### High costs
- Estimate tokens before submission using Repomix
- Use compression to reduce input tokens
- Set max_output_tokens to reasonable limit
- Consider using cheaper model for follow-ups

### Response incomplete
- Check incomplete_details field for reason
- May need to retry with adjusted parameters
- Could indicate context length exceeded

## Resources

- Official API Docs: https://platform.openai.com/docs/api-reference/responses
- OpenAI Cookbook: https://cookbook.openai.com/examples/responses_api/
- Azure OpenAI Docs: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/
- Pricing Calculator: https://pricepertoken.com/
