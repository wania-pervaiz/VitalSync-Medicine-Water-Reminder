import { tool } from 'ai';
import { z } from 'zod';

export const createWaterPlan = tool({
  description:
    'Create a personalized water drinking schedule based on the user’s water goal, wake time, and sleep time.',

  inputSchema: z.object({
    waterGoalGlasses: z
      .number()
      .min(1)
      .max(20)
      .describe('The total number of glasses of water the user wants to drink.'),

    wakeTime: z
      .string()
      .describe('The time the user wakes up, for example 8:00 AM.'),

    sleepTime: z
      .string()
      .describe('The time the user goes to sleep, for example 10:00 PM.'),
  }),

  execute: async ({ waterGoalGlasses, wakeTime, sleepTime }) => {
    const parseTime = (time: string) => {
      const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);

      if (!match) {
        throw new Error(
          `Invalid time format: ${time}. Please use a format such as 8:00 AM.`,
        );
      }

      let hours = Number(match[1]);
      const minutes = Number(match[2]);
      const period = match[3].toUpperCase();

      if (period === 'AM' && hours === 12) {
        hours = 0;
      }

      if (period === 'PM' && hours !== 12) {
        hours += 12;
      }

      return hours * 60 + minutes;
    };

    const formatTime = (totalMinutes: number) => {
      const hours24 = Math.floor(totalMinutes / 60) % 24;
      const minutes = totalMinutes % 60;

      const period = hours24 >= 12 ? 'PM' : 'AM';
      const hours12 = hours24 % 12 || 12;

      return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
    };

    const startMinutes = parseTime(wakeTime);
    const endMinutes = parseTime(sleepTime);

    if (endMinutes === startMinutes) {
  throw new Error(
    'Wake time and sleep time must be different.',
  );
}

const adjustedEndMinutes =
  endMinutes <= startMinutes
    ? endMinutes + 24 * 60
    : endMinutes;

const interval =
  waterGoalGlasses === 1
    ? 0
    : (adjustedEndMinutes - startMinutes) /
      (waterGoalGlasses - 1);
    const schedule = [];

    for (let i = 0; i < waterGoalGlasses; i++) {
      schedule.push({
        glassNumber: i + 1,
        time: formatTime(Math.round(startMinutes + i * interval)),
        amount: '250ml (1 Glass)',
      });
    }

    return {
      title: 'Your Custom Water Plan',
      summary: `Target: ${waterGoalGlasses} glasses between ${wakeTime} and ${sleepTime}.`,
      schedule,
    };
  },
});