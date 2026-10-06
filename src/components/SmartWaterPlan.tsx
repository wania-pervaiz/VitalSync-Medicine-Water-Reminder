import { useEffect, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

interface WaterPlanOutput {
  title: string;
  summary: string;
  schedule: {
    glassNumber: number;
    time: string;
    amount: string;
  }[];
}

interface SmartWaterPlanProps {
  waterGlasses?: number;
  waterGoal?: number;
  onDrinkWater?: () => void;
  onScheduleCreated?: (
    schedule: WaterPlanOutput['schedule']
  ) => void;
}

export function SmartWaterPlan({
  waterGlasses,
  waterGoal,
  onDrinkWater,
  onScheduleCreated,
}: SmartWaterPlanProps) {
  const [prompt, setPrompt] = useState('');

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: 'http://localhost:3000/api/chat',
    }),
  });

  useEffect(() => {
    for (const message of messages) {
      for (const part of message.parts) {
        if (
          part.type === 'tool-createWaterPlan' &&
          part.state === 'output-available'
        ) {
          const output = part.output as WaterPlanOutput;

          onScheduleCreated?.(output.schedule);
        }
      }
    }
  }, [messages, onScheduleCreated]);

  const handleGeneratePlan = async () => {
    if (!prompt.trim()) return;

    await sendMessage({
      text: prompt,
    });
  };

  return (
    <section className="rounded-3xl border-2 border-teal-600 p-6 shadow-sm">
      <div>
        <h2 className="text-2xl font-extrabold">Smart Sip</h2>

        <p className="mt-2 text-gray-600">
          Let AI design your ideal daily water routine.
        </p>
      </div>

      <div className="mt-6">
        <label
          htmlFor="water-plan-prompt"
          className="block font-medium"
        >
          Customize your schedule
        </label>

        <input
          id="water-plan-prompt"
          type="text"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          className="mt-2 w-full rounded-lg border-2 border-teal-600 px-3 py-2 text-center"
          placeholder="e.g. I want 8 glasses from..........."
        />

        <button
          type="button"
          onClick={handleGeneratePlan}
          disabled={status === 'submitted' || status === 'streaming'}
          className="mt-3 px-6 py-3 bg-gradient-to-r from-teal-400 to-teal-600 hover:brightness-105 text-white font-semibold rounded-2xl shadow-[0_10px_30px_-8px_rgba(13,148,136,0.55)] transition disabled:opacity-50"
        >
          {status === 'submitted' || status === 'streaming'
            ? 'Generating...'
            : 'Generate Plan'}
        </button>
      </div>

      {messages.map((message) => (
        <div key={message.id} className="space-y-3">
          {message.parts.map((part, index) => {
            if (part.type === 'text') {
              return (
                <div
                  key={`${message.id}-text-${index}`}
                  className="mt-6 rounded-lg border-2 border-teal-600 p-4"
                >
                  {part.text}
                </div>
              );
            }

            if (part.type === 'tool-createWaterPlan') {
              switch (part.state) {
                case 'input-streaming':
                  return (
                    <div
                      key={`${message.id}-tool-${index}`}
                      className="mt-6 rounded-xl border p-4"
                    >
                      <h3 className="font-semibold">
                        Preparing Your Water Plan
                      </h3>

                      <p className="mt-1 text-sm text-gray-600">
                        AI is preparing your water plan...
                      </p>
                    </div>
                  );

                case 'input-available':
                  return (
                    <div
                      key={`${message.id}-tool-${index}`}
                      className="mt-6 rounded-xl border p-4"
                    >
                      <h3 className="font-semibold">
                        Creating Your Water Plan
                      </h3>

                      <p className="mt-1 text-sm text-gray-600">
                        Your water goal information is ready. Creating your
                        personalized plan...
                      </p>
                    </div>
                  );

                case 'output-available': {
                  const output = part.output as WaterPlanOutput;

                  return (
                    <div
                      key={`${message.id}-tool-${index}`}
                      className="mt-6 rounded-xl border-2 border-teal-600 p-5"
                    >
                      <h3 className="text-lg font-semibold">
                        Your Custom Water Plan
                      </h3>

                      <p className="mt-1 text-sm text-gray-600">
                        {output.summary}
                      </p>

                      <div className="mt-4 space-y-2">
                        {output.schedule.map((slot) => (
                          <div
                            key={slot.glassNumber}
                            className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                          >
                            <span className="font-medium">
                              Glass {slot.glassNumber}
                            </span>

                            <span className="text-sm text-gray-600">
                              {slot.time}
                            </span>

                            <span className="text-sm font-medium">
                              {slot.amount}
                            </span>
                          </div>
                        ))}
                      </div>

                      {onDrinkWater && (
                        <button
                          type="button"
                          onClick={onDrinkWater}
                          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white"
                        >
                          Drink Water
                        </button>
                      )}
                    </div>
                  );
                }

                case 'output-error':
                  return (
                    <div
                      key={`${message.id}-tool-${index}`}
                      className="mt-6 rounded-xl border border-red-300 bg-red-50 p-4"
                    >
                      <h3 className="font-semibold text-red-700">
                        Water Plan Could Not Be Created
                      </h3>

                      <p className="mt-1 text-sm text-red-600">
                        Please choose different wake and sleep times.
                      </p>
                    </div>
                  );

                default:
                  return null;
              }
            }

            return null;
          })}
        </div>
      ))}

      {waterGlasses !== undefined && (
        <p className="mt-6 text-sm text-gray-600">
          Current glasses: {waterGlasses}
        </p>
      )}

      {waterGoal !== undefined && (
        <p className="mt-1 text-sm text-gray-600">
          Water goal: {waterGoal}
        </p>
      )}
    </section>
  );
}