import { convertToModelMessages, streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { createWaterPlan } from './tools/createWaterPlan.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { messages } = req.body;

  const result = await streamText({
    model: google('gemini-3.5-flash-lite'),

    system:
      'You are a water planning assistant. Whenever the user asks to create or generate a water drinking plan, you MUST call the createWaterPlan tool. Do not answer with a plan yourself.',

    messages: await convertToModelMessages(messages),

    tools: {
      createWaterPlan,
    },
  });

  const response = result.toUIMessageStreamResponse();

  res.statusCode = 200;

  res.setHeader(
    'Content-Type',
    response.headers.get('Content-Type') || 'text/plain',
  );

  if (response.body) {
    const reader = response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      res.write(Buffer.from(value));
    }
  }

  res.end();
}

