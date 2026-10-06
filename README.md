# 💊 VitalSync

**Never miss a dose. Never forget to hydrate.**

VitalSync is a simple, friendly web app that helps you stay on top of two
things that are easy to forget in a busy day: taking your medicine on time,
and drinking enough water. No account, no app store, no complicated setup —
just open it in your browser and it quietly keeps watch for you.

---

## Why VitalSync?

Most reminder apps let you tap "snooze" and forget about it. VitalSync treats
medicine differently — **when it's time to take your medicine, the alarm
only gives you one option: "Taken."** No skip, no snooze, no easy way to
ignore it. Because your health shouldn't come with an escape hatch.

Water is more forgiving — life happens, so you *can* say "remind me later,"
and it'll gently come back and ask again in 10 minutes.

---

## What it does

| | |
|---|---|
| 💊 **Medicine tracking** | Add your medicines with dose, schedule, and stock count. Get a full-screen alarm at the right time. |
| 💧 **Water reminders** | Set a daily glass goal — VitalSync reminds you on a schedule, and tracks your progress visually. |
| 📦 **Refill alerts** | Running low on a medicine? VitalSync flags it before you run out. |
| 📜 **History** | See everything you've taken, drunk, or refilled — with times and dates. |
| ⚙️ **Your settings** | Your name, your water goal, sound on or off — all customizable. |

---

## How to use it

### 1. Start the app
```bash
npm install
npm run dev
```
Open the link it gives you (usually `http://localhost:5173`) in your browser.

### 2. Add your medicines
Go to the **Medicines** tab → **Add Medicine**. Fill in the name, dose, what
time to take it, and how much stock you have. That's it — VitalSync will
watch the clock for you.

### 3. Set your water goal
Head to **Settings** to set how many glasses you want per day, and how often
you'd like to be reminded.

### 4. When an alarm goes off
- **Medicine alarm:** read the dose and instructions, then tap **Taken**.
  Your stock updates automatically.
- **Water alarm:** tap **Drank** to log it, or **Remind me later** if you
  need a few more minutes.

### 5. Check in anytime
- **Dashboard** — your at-a-glance overview for today.
- **Hydration** — your water progress, glass by glass.
- **Refill Alerts** — anything running low.
- **History** — everything you've done, all in one timeline.

---

## A quick heads-up on sound 🔊

Your browser won't play any sound until you've clicked somewhere on the page
at least once — that's a browser rule, not a VitalSync bug. Try the "Test
Alarm" buttons in the sidebar once when you first open the app, and sound
will work normally for the rest of your session.

---

## Your data stays yours

VitalSync saves everything right in your own browser — no sign-up, no
account, nothing sent anywhere. That also means it's tied to *this* browser
on *this* device, so it won't sync across your phone and laptop (yet!).

---

## A gentle reminder

VitalSync is a reminder and tracking tool — not a doctor. Always follow the
advice of your actual healthcare provider when it comes to your medications.

## AI Tool Contract

### Tool: createWaterPlan

The `createWaterPlan` tool creates a personalized water drinking schedule based on the user's water goal, wake time, and sleep time.

### Input

The tool accepts:

* `waterGoalGlasses` — Number of glasses of water, from 1 to 20.
* `wakeTime` — User's wake-up time, such as `8:00 AM`.
* `sleepTime` — User's sleep time, such as `10:00 PM`.

The input is validated using Zod.

### Output

The tool returns:

* `title` — Name of the water plan.
* `summary` — Short description of the goal and time range.
* `schedule` — List of water reminders containing the glass number, time, and amount.

The result is displayed as a water-plan UI instead of raw JSON.

### Error Handling

If the tool cannot create a valid plan, the UI displays a separate error state with a user-friendly message.

### Tool Lifecycle States

The UI handles four tool states:

1. **Input Streaming** — The AI is preparing the tool input.
2. **Input Available** — The tool input is ready and the plan is being created.
3. **Output Available** — The generated water schedule is displayed.
4. **Output Error** — An error message is displayed when the tool cannot create the plan.
