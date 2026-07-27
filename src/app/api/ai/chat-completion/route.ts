import { NextRequest, NextResponse } from 'next/server';

const API_KEYS: Record<string, string | undefined> = {
  OPEN_AI: process.env.OPENAI_API_KEY,
  ANTHROPIC: process.env.ANTHROPIC_API_KEY,
  GEMINI: process.env.GEMINI_API_KEY,
  PERPLEXITY: process.env.PERPLEXITY_API_KEY,
};

type ChatMessage = { role: string; content: string };

function formatErrorResponse(error: unknown, provider?: string) {
  const statusCode = (error as any)?.statusCode || (error as any)?.status || 500;
  const providerName = provider || 'Unknown';

  return {
    error: `${providerName.toUpperCase()} API error: ${statusCode}`,
    details: error instanceof Error ? error.message : String(error),
    statusCode,
  };
}

function httpError(message: string, statusCode: number) {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function toAnthropicMessages(messages: ChatMessage[]) {
  const system =
    messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n') || undefined;
  const anthropicMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
  return { system, anthropicMessages };
}

function toGeminiContents(messages: ChatMessage[]) {
  const systemText = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const systemInstruction = systemText ? { parts: [{ text: systemText }] } : undefined;
  return { systemInstruction, contents };
}

// Non-streaming completion, normalized to OpenAI's { choices: [{ message: { role, content } }] } shape.
async function getCompletion(
  provider: string,
  model: string,
  messages: ChatMessage[],
  apiKey: string,
  parameters: Record<string, any>
) {
  if (provider === 'OPEN_AI' || provider === 'PERPLEXITY') {
    const url =
      provider === 'OPEN_AI'
        ? 'https://api.openai.com/v1/chat/completions'
        : 'https://api.perplexity.ai/chat/completions';

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, stream: false, ...parameters }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw httpError(data?.error?.message || `Request failed with status ${res.status}`, res.status);
    }
    return data; // Already OpenAI-shaped
  }

  if (provider === 'ANTHROPIC') {
    const { system, anthropicMessages } = toAnthropicMessages(messages);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        messages: anthropicMessages,
        system,
        max_tokens: parameters?.max_tokens ?? 4096,
        ...parameters,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw httpError(data?.error?.message || `Request failed with status ${res.status}`, res.status);
    }

    const content = data?.content?.map((b: any) => b.text ?? '').join('') ?? '';
    return {
      id: data.id,
      model: data.model,
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: data.stop_reason }],
    };
  }

  if (provider === 'GEMINI') {
    const { systemInstruction, contents } = toGeminiContents(messages);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, systemInstruction, ...parameters }),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      throw httpError(data?.error?.message || `Request failed with status ${res.status}`, res.status);
    }

    const content = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
    return {
      model,
      choices: [
        { index: 0, message: { role: 'assistant', content }, finish_reason: data?.candidates?.[0]?.finishReason },
      ],
    };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

// Streaming completion, re-emitted through our own SSE envelope: {type:'chunk', chunk} / {type:'done'} / {type:'error'}.
// `chunk` is always normalized to OpenAI's delta shape: { choices: [{ delta: { content } }] }.
async function streamCompletion(
  provider: string,
  model: string,
  messages: ChatMessage[],
  apiKey: string,
  parameters: Record<string, any>,
  send: (payload: any) => void
) {
  if (provider === 'OPEN_AI' || provider === 'PERPLEXITY') {
    const url =
      provider === 'OPEN_AI'
        ? 'https://api.openai.com/v1/chat/completions'
        : 'https://api.perplexity.ai/chat/completions';

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, stream: true, ...parameters }),
    });

    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      throw httpError(data?.error?.message || `Request failed with status ${res.status}`, res.status);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') return;
        try {
          send({ type: 'chunk', chunk: JSON.parse(payload) }); // already OpenAI delta-shaped
        } catch {
          // skip malformed/partial chunk
        }
      }
    }
    return;
  }

  if (provider === 'ANTHROPIC') {
    const { system, anthropicMessages } = toAnthropicMessages(messages);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        messages: anthropicMessages,
        system,
        max_tokens: parameters?.max_tokens ?? 4096,
        stream: true,
        ...parameters,
      }),
    });

    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      throw httpError(data?.error?.message || `Request failed with status ${res.status}`, res.status);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        try {
          const event = JSON.parse(trimmed.slice(5).trim());
          if (event.type === 'content_block_delta' && event.delta?.text) {
            send({ type: 'chunk', chunk: { choices: [{ delta: { content: event.delta.text } }] } });
          }
        } catch {
          // skip malformed/partial chunk
        }
      }
    }
    return;
  }

  if (provider === 'GEMINI') {
    const { systemInstruction, contents } = toGeminiContents(messages);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, systemInstruction, ...parameters }),
      }
    );

    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      throw httpError(data?.error?.message || `Request failed with status ${res.status}`, res.status);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        try {
          const event = JSON.parse(trimmed.slice(5).trim());
          const text = event?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
          if (text) send({ type: 'chunk', chunk: { choices: [{ delta: { content: text } }] } });
        } catch {
          // skip malformed/partial chunk
        }
      }
    }
    return;
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

export async function POST(request: NextRequest) {
  let body: any = {};

  try {
    body = await request.json();
    const { provider, model, messages, stream = false, parameters = {} } = body;

    if (!provider || !model || !messages?.length) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, model, messages', details: 'Request validation failed' },
        { status: 400 }
      );
    }

    const apiKey = API_KEYS[provider];
    if (!apiKey) {
      return NextResponse.json(
        {
          error: `${provider.toUpperCase()} API key is not configured`,
          details: 'The API key for this provider is missing in environment variables',
        },
        { status: 400 }
      );
    }

    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          const send = (payload: any) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          try {
            send({ type: 'start' });
            await streamCompletion(provider, model, messages, apiKey, parameters, send);
            send({ type: 'done' });
            controller.close();
          } catch (error) {
            const formatted = formatErrorResponse(error, provider);
            console.error('API Route Error:', { error: formatted.error, details: formatted.details });
            send({ type: 'error', error: formatted.error, details: formatted.details });
            controller.close();
          }
        },
      });

      return new NextResponse(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    const response = await getCompletion(provider, model, messages, apiKey, parameters);
    return NextResponse.json(response);
  } catch (error) {
    const formatted = formatErrorResponse(error, body?.provider);
    console.error('API Route Error:', { error: formatted.error, details: formatted.details });
    return NextResponse.json(
      { error: formatted.error, details: formatted.details },
      { status: formatted.statusCode }
    );
  }
}
