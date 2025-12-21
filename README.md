# Pharma Agent

AI-powered pharmacist assistant for retail pharmacy chain - production-ready implementation.

Real-time conversational AI pharmacy agent (OpenAI GPT-4o/GPT-5) providing medication information, stock checks, and prescription requirements. Features: SSE streaming, bilingual (Hebrew/English), multi-step flows, tool-based data retrieval, strict safety enforcement.

**Features:** 3 tools, 3 multi-step flows, bilingual support, synthetic database (10 users, 5 medications), Docker support. No medical advice/diagnosis - redirects to healthcare professionals.

## Tech Stack

Node.js 20+, TypeScript, Fastify, In-memory synthetic data

## Quick Start

**Prerequisites:** Node.js 20+, OpenAI API key

1. Create `.env` file with these lines:
   ```
   OPENAI_API_KEY=your-api-key-here
   OPENAI_MODEL=gpt-5
   OPENAI_SMALL_MODEL=gpt-4o
   PORT=3000
   IS_DEBUG=false  # Optional: set to 'true' for debug logging
   ```
2. Install: `npm install`
3. Run: `npm run dev` (or `npm run build && npm start` for production)
4. Open `http://localhost:3000`

## Docker

```bash
# Build
docker build -t pharma-agent .

# Run
docker run -p 3000:3000 -e OPENAI_API_KEY=your-api-key-here pharma-agent
```

## API

**POST /chat** - Send message to agent, returns SSE stream

```json
{ "message": "What is Aspirin?", "context": { "medication": "Aspirin" } }
```

**GET /health** - Health check

## Documentation

- [FLOWS.md](./FLOWS.md) - Multi-step flow documentation (3 workflows)
- [TOOLS.md](./TOOLS.md) - Tool design documentation (3 tools)
- [EVALUATION.md](./EVALUATION.md) - Evaluation plan and test results

## Architecture

**Deterministic flow-controlled design** - AI handles intent extraction, response generation, and natural language. Code controls flow transitions and tool selection. Safety is enforced via prompts.

**AI Role:** Intent parsing, context-aware response generation, bilingual conversations (English/Hebrew), error handling, progressive disclosure prompts, safety compliance (via prompts)  
**Code Controls:** Flow transitions, tool selection, flow advancement

**Request Flow:** User Message → Intent Parser (AI) → Flow Manager → Prompt Generator → OpenAI API → Tool Execution → SSE Stream

**Design:** Tool-based facts (no hallucinations), stateless (horizontal scaling), prompt-enforced safety, progressive disclosure

**Tools:** `getMedicationByName`, `checkInventory`, `requiresPrescription`  
**Flows:** Medication Information, Inventory Check, Prescription Confirmation

See [TOOLS.md](./TOOLS.md) and [FLOWS.md](./FLOWS.md) for details.

## Debug

**Debug Logging:** Set `IS_DEBUG=true` in `.env` to enable colored (cyan) system logs showing flow transitions, context, and tool execution.

**Model Selection:** GPT-4o (`OPENAI_SMALL_MODEL`) chosen for fast, low-latency intent parsing. 
GPT-5 (`OPENAI_MODEL`) used for high-quality response generation with advanced reasoning.
