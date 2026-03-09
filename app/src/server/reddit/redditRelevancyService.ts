/**
 * Reddit post relevancy evaluation. Supports Ollama or OpenRouter (OpenAI-compatible API).
 *
 * Uses system/user message split so providers can cache the static system prompt
 * (instructions + product description) across calls, reducing token costs.
 */

import { ChatOllama } from '@langchain/ollama';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import OpenAI from 'openai';

export interface RelevancyResult {
  relevant: boolean;
  painPointSummary: string | null;
  reasoning: string | null;
}

export type RelevancyOptions =
  | { engine: 'ollama'; baseUrl: string; model: string; disableThinking?: boolean }
  | { engine: 'openrouter'; baseUrl: string; apiKey: string; model: string; disableThinking?: boolean };

const SYSTEM_PROMPT = `You are evaluating whether a Reddit post author is a prospective user, tester, or lead for a specific product.

Product description:
"""
{productDescription}
"""

You must decide THREE things:
1. Lead fit: Could this post author be a prospective user, tester, or customer for THIS product? (Their situation or need should align with what the product does.)
2. Pain point / Intent: What is the user trying to do, what problem or goal do they have? Summarize their intent regardless of whether it matches the product.
3. Reasoning: Why is this post relevant or not relevant to the product? Provide a short explanation.

Set relevant to true ONLY when BOTH are true: the author is a plausible lead for this product AND they mention a pain point or need that the product could solve. Do not set relevant just because the post mentions any problem; the problem must be one your product could address.

Always write a painPointSummary (1-2 sentences) capturing the user's intent, problem, or goal — even if the post is not relevant to the product.
Always write a reasoning (1-2 sentences) explaining your decision — why the post is or isn't a fit for the product.

Respond with ONLY a JSON object, no other text. Use this exact format:
{"relevant": true or false, "painPointSummary": "user's intent or need", "reasoning": "why this is or isn't a fit"}`;

function parseRelevancyResponse(text: string): RelevancyResult {
  const cleaned = text.replace(/<think>.*?<\/think>/gs, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { relevant: false, painPointSummary: null, reasoning: null };
  }
  const parsed = JSON.parse(jsonMatch[0]) as {
    relevant?: boolean;
    painPointSummary?: string | null;
    reasoning?: string | null;
  };
  const relevant = parsed.relevant === true;
  const painPointSummary =
    parsed.painPointSummary && String(parsed.painPointSummary).trim()
      ? String(parsed.painPointSummary).trim().slice(0, 500)
      : null;
  const reasoning =
    parsed.reasoning && String(parsed.reasoning).trim()
      ? String(parsed.reasoning).trim().slice(0, 500)
      : null;
  return { relevant, painPointSummary, reasoning };
}

/**
 * Cached client instances keyed by a stable config fingerprint.
 * Avoids re-creating HTTP clients on every call within the same process.
 */
let cachedOllama: { key: string; instance: ChatOllama } | null = null;
let cachedOpenAI: { key: string; instance: OpenAI } | null = null;

function getOllamaClient(baseUrl: string, model: string, disableThinking: boolean): ChatOllama {
  const key = `${baseUrl}|${model}|${disableThinking}`;
  if (cachedOllama?.key === key) return cachedOllama.instance;
  const instance = new ChatOllama({
    baseUrl: baseUrl || 'http://localhost:11434',
    model: model || 'llama3.2:3b',
    temperature: 0.3,
    think: !disableThinking,
  });
  cachedOllama = { key, instance };
  return instance;
}

function getOpenAIClient(baseUrl: string, apiKey: string): OpenAI {
  const key = `${baseUrl}|${apiKey}`;
  if (cachedOpenAI?.key === key) return cachedOpenAI.instance;
  const instance = new OpenAI({
    baseURL: baseUrl || 'https://openrouter.ai/api/v1',
    apiKey: apiKey.trim(),
  });
  cachedOpenAI = { key, instance };
  return instance;
}

export async function evaluateRelevancy(
  productDescription: string,
  postText: string,
  options: RelevancyOptions
): Promise<RelevancyResult> {
  const trimmedProduct = (productDescription || '').trim().slice(0, 2000);
  const trimmedPost = (postText || '').trim().slice(0, 4000);
  const systemPrompt = SYSTEM_PROMPT.replace('{productDescription}', trimmedProduct);
  const userPrompt = `Reddit post (title and body):\n"""\n${trimmedPost}\n"""`;

  try {
    if (options.engine === 'ollama') {
      const { baseUrl, model } = options;
      const client = getOllamaClient(baseUrl, model, options.disableThinking ?? true);
      const response = await client.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ]);
      const text = typeof response.content === 'string' ? response.content : String(response.content ?? '');
      return parseRelevancyResponse(text);
    }

    const { baseUrl, apiKey, model } = options;
    const client = getOpenAIClient(baseUrl, apiKey);
    const disableThinking = options.disableThinking ?? true;
    const completion = await client.chat.completions.create({
      model: model.trim(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      ...(disableThinking ? { reasoning: { effort: 'none' } } : {}),
    } as any);
    const text = completion.choices[0]?.message?.content ?? '';
    return parseRelevancyResponse(text);
  } catch (err) {
    console.error('Reddit relevancy evaluation error:', err);
    return { relevant: false, painPointSummary: null, reasoning: null };
  }
}
