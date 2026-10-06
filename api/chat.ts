import { convertToModelMessages, streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { createWaterPlan } from './tools/createWaterPlan';
export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const { messages } = await req.json();

  const result = await streamText({
    model: google('gemini-3.5-flash-lite'),

    system:
      'You are a water planning assistant. Whenever the user asks to create or generate a water drinking plan, you MUST call the createWaterPlan tool. Do not answer with a plan yourself.',

    messages: await convertToModelMessages(messages),

    tools: {
      createWaterPlan,
    },
  });

  return result.toUIMessageStreamResponse();
}