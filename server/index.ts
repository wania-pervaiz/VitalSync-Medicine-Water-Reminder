import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { convertToModelMessages, streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { createWaterPlan } from './tools/createWaterPlan.js';
const app = new Hono();
app.use(
  '/api/*',
  cors({
   origin: ['http://localhost:5173', 'http://localhost:5174'],
  }),
);

app.post('/api/chat', async (c) => {
  const { messages } = await c.req.json();

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
});

serve(
  {
    fetch: app.fetch,
    port: Number(process.env.PORT) || 3000,
    hostname: '0.0.0.0',
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);