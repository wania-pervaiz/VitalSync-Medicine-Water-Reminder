import React, { useState, useEffect, useRef } from 'react';
import { SmartWaterPlan } from './components/SmartWaterPlan';
import {
  Droplets, Pill, Settings as SettingsIcon, AlertTriangle,
  Clock, Plus, Trash2, Edit3, Activity, X
} from 'lucide-react';

interface Medicine {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  timeSlot: 'Morning' | 'Afternoon' | 'Evening' | 'Night' | 'Custom';
  timeInput: string;
  timeAmPm: 'AM' | 'PM';
  startDate: string;
  endDate: string;
  currentStock: number;
  totalStock: number;
  refillThreshold: number;
  notes: string;
}

interface HistoryItem {
  id: string;
  timestamp: string;
  dateString: string;
  type: 'medicine' | 'water';
  title: string;
  detail: string;
  status: 'Taken' | 'Drank' | 'Refilled';
}

interface SettingsState {
  waterGoal: number;
  waterIntervalMinutes: number;
  soundEnabled: boolean;
  userName: string;
}
interface WaterScheduleItem {
  glassNumber: number;
  time: string;
  amount: string;
}

// Parses "9:05 AM", "9:05am", "9:05 a.m." or "21:05" into a Date for today
const getScheduledDate = (timeStr: string): Date | null => {
  const clean = timeStr.replace(/[\u202f\u00a0]/g, ' ').replace(/\./g, '');
  const m = clean.match(/(\d{1,2}):(\d{1,2})\s*(AM|PM)?/i);
  if (!m) return null;
  let h = Number(m[1]);
  const mins = Number(m[2]);
  if (m[3]) {
    h = h % 12;
    if (m[3].toUpperCase() === 'PM') h += 12;
  }
  const d = new Date();
  d.setHours(h, mins, 0, 0);
  return d;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'medicines' | 'water' | 'history' | 'refills' | 'settings'>('dashboard');

  const [settings, setSettings] = useState<SettingsState>(() => {
    const saved = localStorage.getItem('vitalsync_settings_v8');
    return saved ? JSON.parse(saved) : {
      waterGoal: 8,
      waterIntervalMinutes: 120,
      soundEnabled: true,
      userName: 'Alex'
    };
  });

  const [medicines, setMedicines] = useState<Medicine[]>(() => {
    const saved = localStorage.getItem('vitalsync_medicines_v8');
    return saved ? JSON.parse(saved) : [
      {
        id: '1',
        name: 'Vitamin D',
        dosage: '1 tablet',
        frequency: 'Once daily',
        timeSlot: 'Night',
        timeInput: '8:00',
        timeAmPm: 'PM',
        startDate: '2026-09-01',
        endDate: '2026-10-01',
        currentStock: 4,
        totalStock: 30,
        refillThreshold: 5,
        notes: 'Take after dinner'
      },
      {
        id: '2',
        name: 'Omega-3 Fish Oil',
        dosage: '1 capsule',
        frequency: 'Twice daily',
        timeSlot: 'Morning',
        timeInput: '9:00',
        timeAmPm: 'AM',
        startDate: '2026-09-10',
        endDate: '2026-12-31',
        currentStock: 18,
        totalStock: 60,
        refillThreshold: 10,
        notes: 'With meals'
      }
    ];
  });

  const todayStr = new Date().toDateString();
  const [waterGlasses, setWaterGlasses] = useState<number>(() => {
    const saved = localStorage.getItem('vitalsync_water_glasses_' + todayStr);
    return saved ? JSON.parse(saved) : 6;
  });
  const [waterSchedule, setWaterSchedule] = useState<WaterScheduleItem[]>([]);
  

const firedWaterRef = useRef<Set<string>>(new Set()); // glasses already rung today
const scheduleKeyRef = useRef<string>('');
const ringingGlassRef = useRef<number>(0);

  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('vitalsync_history_v8');
    return saved ? JSON.parse(saved) : [
      { id: 'h1', timestamp: '08:03 PM', dateString: 'September 25', type: 'medicine', title: 'Vitamin D', detail: '1 tablet — Taken at 8:03 PM', status: 'Taken' },
      { id: 'h2', timestamp: '09:30 AM', dateString: 'September 25', type: 'water', title: 'Water Intake', detail: 'Logged 1 glass of water', status: 'Drank' }
    ];
  });

  const [activeAlarm, setActiveAlarm] = useState<{ type: 'med' | 'water'; title: string; subtitle: string; medId?: string } | null>(null);

  const [showMedModal, setShowMedModal] = useState(false);
  const [editingMedId, setEditingMedId] = useState<string | null>(null);

  const [medForm, setMedForm] = useState({
    name: '',
    dosage: '',
    frequency: 'Once daily',
    timeSlot: 'Morning' as 'Morning' | 'Afternoon' | 'Evening' | 'Night' | 'Custom',
    timeInput: '9:25',
    timeAmPm: 'AM' as 'AM' | 'PM',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    currentStock: '30',
    totalStock: '30',
    refillThreshold: '5',
    notes: ''
  });

  

  useEffect(() => {
    localStorage.setItem('vitalsync_medicines_v8', JSON.stringify(medicines));
  }, [medicines]);

  useEffect(() => {
    localStorage.setItem('vitalsync_settings_v8', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('vitalsync_water_glasses_' + todayStr, JSON.stringify(waterGlasses));
  }, [waterGlasses, todayStr]);

  useEffect(() => {
    localStorage.setItem('vitalsync_history_v8', JSON.stringify(history));
  }, [history]);

  // ---- TIMER-STYLE BUZZER ----
  // A crisp, flat digital beep (no pitch slide) repeated on a steady
  // cadence — this is what makes it read as a "kitchen timer" / alarm
  // clock sound rather than a soft notification chime.
 const alarmAudioRef = useRef<HTMLAudioElement | null>(null);
 const firedTodayRef = useRef<Set<string>>(new Set());

const BUZZER_REPEATS = 3; // how many times the sound plays before it stops (change if you like)
const buzzerPlaysRef = useRef(0);
const fallbackCtxRef = useRef<AudioContext | null>(null);

// Built-in beeper: used automatically if /sounds/timer-alarm.mp3 is missing or blocked
const playFallbackBuzz = () => {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    fallbackCtxRef.current = ctx;
    const beeps = BUZZER_REPEATS * 6;
    for (let i = 0; i < beeps; i++) {
      const t = ctx.currentTime + i * 0.4;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.setValueAtTime(0.0001, t + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.25);
    }
  } catch (e) {
    console.error('Fallback buzzer error', e);
  }
};

const startContinuousBuzzer = () => {
  if (!settings.soundEnabled) return;
  if (!alarmAudioRef.current) {
    alarmAudioRef.current = new Audio('/sounds/timer-alarm.mp3');
  }
  const audio = alarmAudioRef.current;
  audio.loop = false;
  buzzerPlaysRef.current = 1;
  audio.onended = () => {
    if (buzzerPlaysRef.current < BUZZER_REPEATS) {
      buzzerPlaysRef.current += 1;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  };
  audio.onerror = () => playFallbackBuzz(); // mp3 missing or unreadable
  audio.currentTime = 0;
  audio.play().catch((err) => {
    console.warn('Alarm sound could not play, using fallback beep:', err);
    playFallbackBuzz();
  });
};

const stopContinuousBuzzer = () => {
  if (alarmAudioRef.current) {
    alarmAudioRef.current.onended = null;
    alarmAudioRef.current.onerror = null;
    alarmAudioRef.current.pause();
    alarmAudioRef.current.currentTime = 0;
  }
  if (fallbackCtxRef.current) {
    fallbackCtxRef.current.close().catch(() => {});
    fallbackCtxRef.current = null;
  }
};
  // A distinct, single confirmation "ding" — used when an action is confirmed
  const playConfirmDing = () => {
    if (!settings.soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(659.25, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch (e) {
      console.error("Audio playback error", e);
    }
  };

  // Watch activeAlarm state to start/stop the continuous timer buzzer automatically
  useEffect(() => {
    if (activeAlarm) {
      startContinuousBuzzer();
    } else {
      stopContinuousBuzzer();
    }
    return () => {
      stopContinuousBuzzer();
    };
  }, [activeAlarm]);

  const triggerTestMedAlarm = () => {
    setActiveAlarm({
      type: 'med',
      title: 'Time to take your medicine',
      subtitle: 'Medicine: Vitamin D\nDose: 1 tablet\nInstruction: Take after dinner',
      medId: '1'
    });
  };

  const triggerTestWaterAlarm = () => {
    setActiveAlarm({
      type: 'water',
      title: 'Time to drink water',
      subtitle: 'Hydration Reminder: Time for your scheduled glass of water.',
    });
  };

  // Check medicine schedules against current time every 30 seconds
 useEffect(() => {
  const checkSchedules = () => {
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const todayKey = now.toDateString();

    medicines.forEach(med => {
      const fireKey = `${med.id}_${todayKey}`;
      if (firedTodayRef.current.has(fireKey)) return; // already alerted for this medicine today

      const medTime = getScheduledDate(`${med.timeInput} ${med.timeAmPm}`);
      if (
        medTime &&
        medTime.getHours() === currentHours &&
        medTime.getMinutes() === currentMinutes
      ) {
        firedTodayRef.current.add(fireKey); // mark as fired so it won't repeat today
        setActiveAlarm({
          type: 'med',
          title: `Time to take: ${med.name}`,
          subtitle: `Dosage: ${med.dosage}\nInstruction: ${med.notes || 'Take as prescribed'}`,
          medId: med.id
        });
      }
    });
  };

  const interval = setInterval(checkSchedules, 30000);
  return () => clearInterval(interval);
}, [medicines]);
useEffect(() => {
  const checkWaterSchedule = () => {
    if (waterSchedule.length === 0 || activeAlarm) return;

    const now = new Date();
    const todayKey = now.toDateString();

    for (const glass of waterSchedule) {
      const key = `${glass.glassNumber}_${todayKey}`;
      if (firedWaterRef.current.has(key)) continue;

      const t = getScheduledDate(glass.time);
      if (!t) continue;

      const diff = now.getTime() - t.getTime();
      // ring only at the user's scheduled time (2 minute grace window)
      if (diff >= 0 && diff < 2 * 60 * 1000) {
        firedWaterRef.current.add(key);
        ringingGlassRef.current = glass.glassNumber;
        setActiveAlarm({
          type: 'water',
          title: `Time to drink Glass ${glass.glassNumber}`,
          subtitle: 'Hydration Reminder: Time for your scheduled glass of water.',
        });
        break;
      }
    }
  };

  checkWaterSchedule();
  const interval = setInterval(checkWaterSchedule, 1000);
  return () => clearInterval(interval);
}, [waterSchedule, activeAlarm]);
  const addHistoryItem = (type: 'medicine' | 'water', title: string, detail: string, status: 'Taken' | 'Drank' | 'Refilled') => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateFormatted = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: timeStr,
      dateString: dateFormatted,
      type,
      title,
      detail,
      status
    };
    setHistory(prev => [newItem, ...prev]);
  };

  const handleTakeMedicine = (medId?: string) => {
    stopContinuousBuzzer();
    playConfirmDing();
    if (medId) {
      setMedicines(prev => prev.map(m => {
        if (m.id === medId) {
          const newStock = Math.max(0, m.currentStock - 1);
          return { ...m, currentStock: newStock };
        }
        return m;
      }));
      const med = medicines.find(m => m.id === medId);
      if (med) {
        addHistoryItem('medicine', med.name, `${med.dosage} — Taken at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, 'Taken');
      }
    } else {
      addHistoryItem('medicine', 'Scheduled Medicine', `1 tablet — Taken at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, 'Taken');
    }
    setActiveAlarm(null);
  };

  const handleDrinkWater = () => {
  stopContinuousBuzzer();
  playConfirmDing();

  if (waterGlasses < settings.waterGoal) {
    setWaterGlasses((prev) => prev + 1);
  }

  addHistoryItem(
    'water',
    'Water Intake',
    'Logged 1 glass of water',
    'Drank'
  );

  setActiveAlarm(null);
};
  const handleSnoozeWater = () => {
  stopContinuousBuzzer();
  setActiveAlarm(null);

  setTimeout(() => {
    setActiveAlarm({
      type: 'water',
      title: `Time to drink Glass ${ringingGlassRef.current}`,
      subtitle:
        'Hydration Reminder: Time for your scheduled glass of water.',
    });
  }, 10 * 60 * 1000);
};
  const handleRefillStock = (medId: string) => {
    playConfirmDing();
    setMedicines(prev => prev.map(m => {
      if (m.id === medId) {
        return { ...m, currentStock: m.totalStock };
      }
      return m;
    }));
    const med = medicines.find(m => m.id === medId);
    if (med) {
      addHistoryItem('medicine', `${med.name} Refilled`, `Restocked to ${med.totalStock} units`, 'Refilled');
    }
  };

  const handleDeleteMed = (medId: string) => {
    playConfirmDing();
    setMedicines(prev => prev.filter(m => m.id !== medId));
  };

  const openAddModal = () => {
    setEditingMedId(null);
    setMedForm({
      name: '',
      dosage: '',
      frequency: 'Once daily',
      timeSlot: 'Morning',
      timeInput: '9:25',
      timeAmPm: 'AM',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      currentStock: '30',
      totalStock: '30',
      refillThreshold: '5',
      notes: ''
    });
    setShowMedModal(true);
  };

  const openEditModal = (med: Medicine) => {
    setEditingMedId(med.id);
    setMedForm({
      name: med.name,
      dosage: med.dosage,
      frequency: med.frequency,
      timeSlot: med.timeSlot,
      timeInput: med.timeInput || '9:00',
      timeAmPm: med.timeAmPm || 'AM',
      startDate: med.startDate,
      endDate: med.endDate,
      currentStock: med.currentStock.toString(),
      totalStock: med.totalStock.toString(),
      refillThreshold: med.refillThreshold.toString(),
      notes: med.notes
    });
    setShowMedModal(true);
  };

  const handleSaveMed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!medForm.name.trim()) return;

    const newMedData: Medicine = {
      id: editingMedId ? editingMedId : Date.now().toString(),
      name: medForm.name,
      dosage: medForm.dosage || '1 tablet',
      frequency: medForm.frequency,
      timeSlot: medForm.timeSlot,
      timeInput: medForm.timeInput,
      timeAmPm: medForm.timeAmPm,
      startDate: medForm.startDate,
      endDate: medForm.endDate,
      currentStock: parseInt(medForm.currentStock) || 30,
      totalStock: parseInt(medForm.totalStock) || 30,
      refillThreshold: parseInt(medForm.refillThreshold) || 5,
      notes: medForm.notes
    };

    if (editingMedId) {
      setMedicines(prev => prev.map(m => m.id === editingMedId ? newMedData : m));
    } else {
      setMedicines(prev => [...prev, newMedData]);
    }

    setShowMedModal(false);
    playConfirmDing();
  };

  const lowStockMeds = medicines.filter(m => m.currentStock <= m.refillThreshold);

  return (
    <>
      {/* Small injected stylesheet for the pulsing alarm ring — keeps this a single drop-in file */}
      <style>{`
        @keyframes ringPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(88,129,87,0.35); }
          50% { box-shadow: 0 0 0 14px rgba(88,129,87,0); }
        }
        .ring-pulse-anim { animation: ringPulse 1.6s ease-out infinite; }
      `}</style>

      <div className="min-h-screen bg-[#F3F5EE] bg-[radial-gradient(at_15%_0%,rgba(163,177,138,0.28)_0px,transparent_55%),radial-gradient(at_85%_15%,rgba(45,145,140,0.14)_0px,transparent_50%),radial-gradient(at_0%_90%,rgba(88,129,87,0.12)_0px,transparent_45%)] text-[#2C3E2D] font-sans antialiased flex flex-col md:flex-row selection:bg-[#588157]/25">

        {/* SIDEBAR NAVIGATION */}
        <aside className="w-full md:w-72 bg-white/60 backdrop-blur-2xl border-r border-[#4A6B52] p-6 flex flex-col justify-between shrink-0 shadow-[4px_0_30px_-20px_rgba(44,62,45,0.4)]">
          <div>
            <div className="flex items-center gap-3 mb-10 px-2">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#6B9A6C] to-[#3A5A40] text-white flex items-center justify-center shadow-[0_10px_30px_-8px_rgba(58,90,64,0.5)]">
                <Activity className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-[#3A5A40]">VitalSync</h1>
                <p className="text-xs text-[#588157] font-medium">Gentle Health Companion</p>
              </div>
            </div>

            <nav className="space-y-1.5">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: Activity },
                { id: 'medicines', label: 'Medicines', icon: Pill, badge: medicines.length },
                { id: 'water', label: 'Hydration', icon: Droplets, badge: `${waterGlasses}/${settings.waterGoal}` },
                { id: 'refills', label: 'Refill Alerts', icon: AlertTriangle, alert: lowStockMeds.length > 0 ? lowStockMeds.length : null },
                { id: 'history', label: 'History Log', icon: Clock },
                { id: 'settings', label: 'Settings', icon: SettingsIcon },
              ].map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-[#6B9A6C] to-[#3A5A40] text-white shadow-[0_10px_30px_-8px_rgba(58,90,64,0.5)] font-semibold scale-[1.02]'
                        : 'text-[#4A5D4E] hover:bg-white/70 hover:text-[#3A5A40]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-[#588157]'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${isActive ? 'bg-white/25 text-white' : 'bg-[#E2E8DF] text-[#4A5D4E]'}`}>
                        {item.badge}
                      </span>
                    )}
                    {item.alert !== undefined && item.alert !== null && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold animate-pulse">
                        {item.alert}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="pt-6 border-t border-white/60 space-y-4">
            <div className="bg-white/80 backdrop-blur-xl p-3.5 rounded-2xl border border-[#4A6B52] shadow-[0_8px_30px_-18px_rgba(44,62,45,0.4)] flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6B9A6C] to-[#3A5A40] text-white flex items-center justify-center font-bold text-sm shadow-[0_6px_16px_-6px_rgba(58,90,64,0.5)]">
                {settings.userName.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <h4 className="text-sm font-semibold text-[#3A5A40] truncate">{settings.userName}</h4>
                <p className="text-xs text-[#7F8C7D]">Daily Adherence Active</p>
              </div>
            </div>

            <div className="bg-white/50 backdrop-blur p-3 rounded-2xl border-2 border-[#4A6B52] text-center space-y-2">
              <p className="text-xs font-medium text-[#4A5D4E]">Test Timer Buzzer:</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={triggerTestMedAlarm}
                  className="px-2.5 py-1 text-xs bg-white text-amber-900 font-semibold rounded-lg border-2 border-amber-500 hover:bg-amber-50 shadow-sm">
                  🔔 Med Alarm
                </button>
                <button
                  onClick={triggerTestWaterAlarm}
                 className="px-2.5 py-1 text-xs bg-white text-[#0D9488] font-semibold rounded-lg border-2 border-[#0D9488] hover:bg-teal-50 shadow-sm">
                  💧 Water Alarm
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full overflow-y-auto">

          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-[#EAEFE8] backdrop-blur-xl p-5 rounded-3xl border border-[#4A6B52] shadow-[0_8px_30px_-18px_rgba(44,62,45,0.35)]">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-[#3A5A40] capitalize">
                {activeTab === 'dashboard' ? `Welcome back, ${settings.userName}` : activeTab}
              </h2>
              <p className="text-sm text-[#6A7B68]">
                {activeTab === 'dashboard' && "Here is your peaceful health overview for today."}
                {activeTab === 'medicines' && "Manage your prescriptions, schedules, and active stock."}
                {activeTab === 'water' && "Stay refreshed and track your daily hydration goals."}
                {activeTab === 'refills' && "Medicines requiring replenishment soon."}
                {activeTab === 'history' && "Complete audit trail of your health routines."}
                {activeTab === 'settings' && "Customize your preferences, goals, and sound alerts."}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {activeTab === 'medicines' && (
                <button
                  onClick={openAddModal}
                  className="flex items-center gap-2 bg-gradient-to-r from-[#6B9A6C] to-[#3A5A40] hover:brightness-105 text-white px-4 py-2.5 rounded-2xl font-medium text-sm transition shadow-[0_10px_30px_-8px_rgba(58,90,64,0.5)]"
                >
                  <Plus className="w-4 h-4" /> Add Medicine
                </button>
              )}
              <div className="text-right hidden sm:block bg-white/70 px-4 py-2 rounded-2xl border border-white/60">
                <span className="text-xs font-semibold text-[#588157] block">{new Date().toLocaleDateString('en-US', { weekday: 'long' })}</span>
                <span className="text-xs text-[#7F8C7D]">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
            </div>
          </header>

          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl border border-[#4A6B52] shadow-[0_8px_30px_-18px_rgba(44,62,45,0.35)] hover:-translate-y-0.5 hover:shadow-[0_14px_36px_-16px_rgba(44,62,45,0.4)] transition-all duration-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#6B9A6C] to-[#3A5A40] text-white flex items-center justify-center shadow-[0_8px_20px_-8px_rgba(58,90,64,0.5)]">
                        <Pill className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#3A5A40]">Medicines Today</h3>
                        <p className="text-xs text-[#7F8C7D]">Strict Adherence Tracker</p>
                      </div>
                    </div>
                    <button onClick={() => setActiveTab('medicines')} className="text-xs text-[#588157] font-semibold hover:underline">
                      View All →
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 my-4">
                    <div className="bg-white/70 p-4 rounded-2xl border border-[#6A7B68]">
                      <span className="text-2xl font-extrabold text-[#3A5A40]">{history.filter(h => h.type === 'medicine').length}</span>
                      <p className="text-xs text-[#6A7B68] font-medium mt-0.5">Taken Today</p>
                    </div>
                    <div className="bg-white/70 p-4 rounded-2xl border border-[#6A7B68]">
                      <span className="text-2xl font-extrabold text-[#588157]">{medicines.length}</span>
                      <p className="text-xs text-[#6A7B68] font-medium mt-0.5">Active Prescriptions</p>
                    </div>
                  </div>

                  {medicines.length > 0 && (
                    <div className="pt-2 border-t border-[#F0F4EC] flex items-center justify-between text-xs text-[#6A7B68]">
                      <span>Next scheduled: <strong className="text-[#3A5A40]">{medicines[0].name} ({medicines[0].timeInput} {medicines[0].timeAmPm})</strong></span>
                      <button
                        onClick={() => handleTakeMedicine(medicines[0].id)}
                        className="px-3 py-1 bg-gradient-to-r from-[#6B9A6C] to-[#3A5A40] text-white rounded-lg font-medium hover:brightness-105 transition"
                      >
                        Take Now
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl border border-teal-600 shadow-[0_8px_30px_-18px_rgba(44,62,45,0.35)] hover:-translate-y-0.5 hover:shadow-[0_14px_36px_-16px_rgba(44,62,45,0.4)] transition-all duration-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 text-white flex items-center justify-center shadow-[0_8px_20px_-8px_rgba(13,148,136,0.55)]">
                        <Droplets className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#3A5A40]">Today's Water</h3>
                        <p className="text-xs text-[#7F8C7D]">Goal: {settings.waterGoal} glasses</p>
                      </div>
                    </div>
                    <button onClick={() => setActiveTab('water')} className="text-xs text-teal-600 font-semibold hover:underline">
                      Open Water →
                    </button>
                  </div>

                  <div className="my-3 space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-[#3A5A40]">{waterGlasses} / {settings.waterGoal} glasses</span>
                      <span className="text-teal-600">{Math.round((waterGlasses / settings.waterGoal) * 100)}%</span>
                    </div>
                    <div className="w-full bg-[#F0F4EC] h-3 rounded-full overflow-hidden p-0.5 border border-[#E2E8DF]">
                      <div
                        className="bg-gradient-to-r from-teal-400 to-teal-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (waterGlasses / settings.waterGoal) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#F0F4EC] flex items-center justify-between text-xs">
                    <span className="text-[#6A7B68]">{Math.max(0, settings.waterGoal - waterGlasses)} glasses remaining today</span>
                    <button
                      onClick={handleDrinkWater}
                      className="px-3 py-1 bg-gradient-to-r from-teal-400 to-teal-600 text-white rounded-lg font-medium hover:brightness-105 transition"
                    >
                      + Log Glass
                    </button>
                  </div>
                </div>

              </div>

              {lowStockMeds.length > 0 && (
                <div className="bg-amber-50/90 backdrop-blur border border-amber-200 rounded-3xl p-5 flex items-center justify-between shadow-[0_8px_30px_-18px_rgba(180,83,9,0.3)]">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-white flex items-center justify-center shrink-0 shadow-[0_8px_20px_-8px_rgba(217,119,6,0.5)]">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-amber-900">Refill Warning Required</h4>
                      <p className="text-xs text-amber-700">
                        {lowStockMeds.map(m => m.name).join(', ')} {lowStockMeds.length === 1 ? 'is' : 'are'} running low on inventory.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('refills')}
                    className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-105 text-white text-xs font-semibold rounded-xl transition shadow-[0_8px_20px_-8px_rgba(217,119,6,0.5)]"
                  >
                    View Refills
                  </button>
                </div>
              )}

              <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl border border-[#4A6B52] shadow-[0_8px_30px_-18px_rgba(44,62,45,0.35)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-[#3A5A40]">Recent Health Activity</h3>
                  <button onClick={() => setActiveTab('history')} className="text-xs text-[#588157] font-semibold hover:underline">
                    View Full History
                  </button>
                </div>

                <div className="space-y-3">
                  {history.slice(0, 3).map(item => (
                    <div key={item.id} className="flex items-start gap-3 p-3 rounded-2xl bg-white/70 border border-[#EBEFE8]">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white ${
                        item.type === 'medicine' ? 'bg-gradient-to-br from-[#6B9A6C] to-[#3A5A40]' : 'bg-gradient-to-br from-teal-400 to-teal-600'
                      }`}>
                        {item.type === 'medicine' ? <Pill className="w-4 h-4" /> : <Droplets className="w-4 h-4" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-[#3A5A40]">{item.title}</h4>
                          <span className="text-xs text-[#7F8C7D]">{item.timestamp}</span>
                        </div>
                        <p className="text-xs text-[#6A7B68] mt-0.5">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MEDICINES */}
          {activeTab === 'medicines' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[#3A5A40]">Your Prescriptions</h3>
                  <p className="text-xs text-[#6A7B68]">Strict adherence tracking with automated timer alerts & stock deduction.</p>
                </div>
                <button
                  onClick={openAddModal}
                  className="flex items-center gap-2 bg-gradient-to-r from-[#6B9A6C] to-[#3A5A40] text-white px-4 py-2 rounded-xl text-sm font-medium hover:brightness-105 transition shadow-[0_8px_20px_-8px_rgba(58,90,64,0.5)]"
                >
                  <Plus className="w-4 h-4" /> Add Medicine
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {medicines.map(med => {
                  const isLow = med.currentStock <= med.refillThreshold;
                  return (
                    <div key={med.id} className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl border border-[#4A6B52] shadow-[0_8px_30px_-18px_rgba(44,62,45,0.35)] flex flex-col justify-between hover:-translate-y-0.5 transition-transform duration-200">
                      <div>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#588157]/10 text-[#588157] font-semibold">
                              {med.timeSlot} • {med.timeInput} {med.timeAmPm}
                            </span>
                            <h4 className="text-lg font-bold text-[#3A5A40] mt-2">{med.name}</h4>
                            <p className="text-xs text-[#7F8C7D] font-medium">{med.dosage} — {med.frequency}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditModal(med)}
                              className="p-2 text-[#7F8C7D] hover:text-[#588157] hover:bg-white rounded-xl transition"
                              title="Edit Medicine"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteMed(med.id)}
                              className="p-2 text-[#7F8C7D] hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                              title="Delete Medicine"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {med.notes && (
                          <p className="text-xs text-[#6A7B68] italic bg-white/70 p-2.5 rounded-xl border border-[#EBEFE8] mb-4">
                            "{med.notes}"
                          </p>
                        )}

                        <div className="space-y-1.5 mb-4">
                          <div className="flex justify-between text-xs">
                            <span className="text-[#6A7B68]">Stock Available</span>
                            <span className={`font-semibold ${isLow ? 'text-amber-600' : 'text-[#3A5A40]'}`}>
                              {med.currentStock} / {med.totalStock} units
                            </span>
                          </div>
                          <div className="w-full bg-[#F0F4EC] h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isLow ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-[#6B9A6C] to-[#3A5A40]'}`}
                              style={{ width: `${Math.min(100, (med.currentStock / med.totalStock) * 100)}%` }}
                            />
                          </div>
                        </div>

                        <div className="text-xs text-[#7F8C7D] mb-4">
                          Active Period: {med.startDate} to {med.endDate}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#F0F4EC] flex items-center justify-between">
                        {isLow ? (
                          <span className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Refill needed
                          </span>
                        ) : (
                          <span className="text-xs text-[#7F8C7D]">Stock is healthy</span>
                        )}
                        <button
                          onClick={() => handleTakeMedicine(med.id)}
                          className="px-4 py-2 bg-gradient-to-r from-[#6B9A6C] to-[#3A5A40] hover:brightness-105 text-white text-xs font-semibold rounded-xl shadow-[0_8px_20px_-8px_rgba(58,90,64,0.5)] transition"
                        >
                          [ Taken ]
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: WATER HYDRATION */}
          {activeTab === 'water' && (
            <div className="space-y-6">
              <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl border border-teal-600 shadow-[0_8px_30px_-18px_rgba(44,62,45,0.35)] text-center max-w-xl mx-auto space-y-6">
                <div className="w-16 h-16 bg-gradient-to-br from-teal-400 to-teal-600 text-white rounded-3xl mx-auto flex items-center justify-center shadow-[0_10px_30px_-8px_rgba(13,148,136,0.55)]">
                  <Droplets className="w-8 h-8" />
                </div>

                <div>
                  <h3 className="text-2xl font-extrabold text-[#3A5A40]">Hydration Tracker</h3>
                  <p className="text-sm text-[#6A7B68]">Default daily goal is {settings.waterGoal} glasses. Keep your body nourished.</p>
                </div>

                <div className="py-4">
                  <span className="text-5xl font-black text-teal-600">{waterGlasses}</span>
                  <span className="text-xl text-[#7F8C7D] font-medium"> / {settings.waterGoal} glasses</span>
                </div>

                <div className="flex justify-center gap-3">
                  <button
                    onClick={handleDrinkWater}
                    className="px-6 py-3 bg-gradient-to-r from-teal-400 to-teal-600 hover:brightness-105 text-white font-semibold rounded-2xl shadow-[0_10px_30px_-8px_rgba(13,148,136,0.55)] transition"
                  >
                    💧 Drink 1 Glass Now
                  </button>
                  <button
                    onClick={() => setWaterGlasses(0)}
                    className="px-4 py-3 bg-white/70 hover:bg-white text-[#6A7B68] font-medium rounded-2xl border border-[#EBEFE8] transition text-sm"
                  >
                    Reset Today
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-4">
                  {Array.from({ length: settings.waterGoal }).map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-12 rounded-xl flex items-center justify-center transition-all ${
                        idx < waterGlasses
                          ? 'bg-gradient-to-br from-teal-400 to-teal-600 text-white font-bold shadow-[0_6px_16px_-6px_rgba(13,148,136,0.6)]'
                          : 'bg-white/60 border border-[#E2E8DF] text-[#A3B18A]'
                      }`}
                    >
                      {idx + 1}
                    </div>
                  ))}
                </div>
                <SmartWaterPlan
                  onScheduleCreated={(schedule) => {
                    // ignore if the same plan is sent again, so a ringing alarm is never wiped
                    const planKey = JSON.stringify(schedule);
                    if (planKey === scheduleKeyRef.current) return;
                    scheduleKeyRef.current = planKey;
                    const now = new Date();
                    const todayKey = now.toDateString();
                    firedWaterRef.current = new Set();
                    // times that already passed today are skipped, so only upcoming ones ring
                    schedule.forEach((g) => {
                      const t = getScheduledDate(g.time);
                      if (t && t < now) firedWaterRef.current.add(`${g.glassNumber}_${todayKey}`);
                    });
                    setWaterSchedule(schedule);
                  }}
                />
              </div>
            </div>
          )}

          {/* TAB 4: REFILL ALERTS */}
          {activeTab === 'refills' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-[#3A5A40]">Inventory & Refill Alerts</h3>
                <p className="text-xs text-[#6A7B68]">Prescriptions running low below safety thresholds.</p>
              </div>

              {medicines.length === 0 ? (
                <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl border border-white/70 text-center text-[#7F8C7D]">
                  No prescriptions found.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {medicines.map(med => {
                    const isLow = med.currentStock <= med.refillThreshold;
                    return (
                      <div key={med.id} className={`bg-white/80 backdrop-blur-xl p-6 rounded-3xl border ${isLow ? 'border-amber-300 shadow-[0_8px_30px_-18px_rgba(180,83,9,0.35)]' : 'border-white/70 shadow-[0_8px_30px_-18px_rgba(44,62,45,0.35)]'}`}>
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h4 className="text-lg font-bold text-[#3A5A40]">{med.name}</h4>
                            <p className="text-xs text-[#7F8C7D]">{med.dosage} • Threshold: {med.refillThreshold} units</p>
                          </div>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${isLow ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                            {isLow ? 'Refill Required' : 'Sufficient Stock'}
                          </span>
                        </div>

                        <div className="space-y-2 mb-6">
                          <div className="flex justify-between text-xs">
                            <span className="text-[#6A7B68]">Current Stock Level</span>
                            <span className="font-bold text-[#3A5A40]">{med.currentStock} / {med.totalStock}</span>
                          </div>
                          <div className="w-full bg-[#F0F4EC] h-2.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isLow ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-[#6B9A6C] to-[#3A5A40]'}`}
                              style={{ width: `${Math.min(100, (med.currentStock / med.totalStock) * 100)}%` }}
                            />
                          </div>
                        </div>

                        <button
                          onClick={() => handleRefillStock(med.id)}
                          className="w-full py-2.5 bg-gradient-to-r from-[#6B9A6C] to-[#3A5A40] hover:brightness-105 text-white text-xs font-semibold rounded-xl shadow-[0_8px_20px_-8px_rgba(58,90,64,0.5)] transition"
                        >
                          🔄 Restock Full Inventory ({med.totalStock} units)
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: HISTORY LOG */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[#3A5A40]">Audit History Log</h3>
                  <p className="text-xs text-[#6A7B68]">A chronological timeline of all your taken medications and hydration logs.</p>
                </div>
                <button onClick={() => setHistory([])} className="text-xs text-red-600 hover:underline font-medium">
                  Clear History
                </button>
              </div>

              <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-[#4A6B52] shadow-[0_8px_30px_-18px_rgba(44,62,45,0.35)] p-6 space-y-4">
                {history.length === 0 ? (
                  <p className="text-center text-xs text-[#7F8C7D] py-8">No recorded activity yet.</p>
                ) : (
                  history.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/70 border border-[#EBEFE8]">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white ${
                          item.type === 'medicine' ? 'bg-gradient-to-br from-[#6B9A6C] to-[#3A5A40]' : 'bg-gradient-to-br from-teal-400 to-teal-600'
                        }`}>
                          {item.type === 'medicine' ? <Pill className="w-4 h-4" /> : <Droplets className="w-4 h-4" />}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-[#3A5A40]">{item.title}</h4>
                          <p className="text-xs text-[#6A7B68]">{item.detail}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold text-[#3A5A40] block">{item.timestamp}</span>
                        <span className="text-[10px] text-[#7F8C7D]">{item.dateString}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 6: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h3 className="text-lg font-bold text-[#3A5A40]">Companion Settings</h3>
                <p className="text-xs text-[#6A7B68]">Configure your daily targets, reminders, and audio alerts.</p>
              </div>

              <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl border border-[#4A6B52] shadow-[0_8px_30px_-18px_rgba(44,62,45,0.35)] space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-[#3A5A40] mb-1.5">Your Preferred Name</label>
                  <input
                    type="text"
                    value={settings.userName}
                    onChange={(e) => setSettings({ ...settings, userName: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#D5DDD1] bg-white/70 text-sm focus:outline-none focus:ring-2 focus:ring-[#588157]/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#3A5A40] mb-1.5">Daily Water Goal (Glasses)</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={settings.waterGoal}
                    onChange={(e) => setSettings({ ...settings, waterGoal: parseInt(e.target.value) || 8 })}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#D5DDD1] bg-white/70 text-sm focus:outline-none focus:ring-2 focus:ring-[#588157]/30"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div>
                    <h4 className="text-sm font-semibold text-[#3A5A40]">Sound Alerts & Timer Buzzer</h4>
                    <p className="text-xs text-[#6A7B68]">Play repeating timer beeps on alarms</p>
                  </div>
                  <button
                    onClick={() => setSettings({ ...settings, soundEnabled: !settings.soundEnabled })}
                    className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${settings.soundEnabled ? 'bg-gradient-to-r from-[#6B9A6C] to-[#3A5A40]' : 'bg-gray-300'}`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${settings.soundEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="pt-4 border-t border-[#F0F4EC]">
                  <button
                    onClick={() => {
                      playConfirmDing();
                      alert("Settings saved successfully!");
                    }}
                    className="w-full py-3 bg-gradient-to-r from-[#6B9A6C] to-[#3A5A40] hover:brightness-105 text-white font-semibold rounded-xl text-sm transition shadow-[0_10px_30px_-8px_rgba(58,90,64,0.5)]"
                  >
                    Save Settings
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>

        {/* ACTIVE ALARM NOTIFICATION OVERLAY MODAL */}
        {activeAlarm && (
          <div className="fixed inset-0 bg-[#2C3E2D]/50 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] max-w-md w-full p-6 shadow-2xl border border-white text-center space-y-5">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#6B9A6C] to-[#3A5A40] text-white mx-auto flex items-center justify-center shadow-[0_10px_30px_-8px_rgba(58,90,64,0.5)] ring-pulse-anim">
                {activeAlarm.type === 'med' ? <Pill className="w-8 h-8 animate-bounce" /> : <Droplets className="w-8 h-8 animate-bounce" />}
              </div>

              <div>
                <h3 className="text-xl font-extrabold text-[#3A5A40]">{activeAlarm.title}</h3>
                <p className="text-xs text-[#6A7B68] mt-2 whitespace-pre-line bg-white/70 p-3 rounded-xl border border-[#EBEFE8]">
                  {activeAlarm.subtitle}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                {activeAlarm.type === 'med' ? (
                  <button
                    onClick={() => handleTakeMedicine(activeAlarm.medId)}
                    className="w-full py-3 bg-gradient-to-r from-[#6B9A6C] to-[#3A5A40] hover:brightness-105 text-white font-semibold rounded-xl text-sm transition shadow-[0_10px_30px_-8px_rgba(58,90,64,0.5)]"
                  >
                    ✓ Take Now (Stop Buzzer)
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleDrinkWater}
                      className="flex-1 py-3 bg-gradient-to-r from-teal-400 to-teal-600 hover:brightness-105 text-white font-semibold rounded-xl text-sm transition shadow-[0_10px_30px_-8px_rgba(13,148,136,0.55)]"
                    >
                      💧 Drank Glass
                    </button>
                    <button
                      onClick={handleSnoozeWater}
                      className="px-4 py-3 bg-white/70 hover:bg-white text-[#6A7B68] font-medium rounded-xl text-sm border border-[#EBEFE8] transition"
                    >
                      Snooze (10m)
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ADD / EDIT MEDICINE MODAL */}
        {showMedModal && (
          <div className="fixed inset-0 bg-[#2C3E2D]/50 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] max-w-lg w-full p-6 shadow-2xl border border-white space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-[#F0F4EC]">
                <h3 className="text-lg font-extrabold text-[#3A5A40]">
                  {editingMedId ? 'Edit Prescription' : 'Add New Prescription'}
                </h3>
                <button onClick={() => setShowMedModal(false)} className="p-1 rounded-lg text-[#7F8C7D] hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveMed} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#3A5A40] mb-1">Medicine Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Aspirin, Vitamin C"
                    value={medForm.name}
                    onChange={(e) => setMedForm({ ...medForm, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-[#D5DDD1] bg-white/70 text-sm focus:outline-none focus:ring-2 focus:ring-[#588157]/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#3A5A40] mb-1">Dosage</label>
                    <input
                      type="text"
                      placeholder="e.g. 1 tablet, 5ml"
                      value={medForm.dosage}
                      onChange={(e) => setMedForm({ ...medForm, dosage: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-[#D5DDD1] bg-white/70 text-sm focus:outline-none focus:ring-2 focus:ring-[#588157]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#3A5A40] mb-1">Frequency</label>
                    <select
                      value={medForm.frequency}
                      onChange={(e) => setMedForm({ ...medForm, frequency: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-[#D5DDD1] bg-white/70 text-sm focus:outline-none focus:ring-2 focus:ring-[#588157]/30"
                    >
                      <option>Once daily</option>
                      <option>Twice daily</option>
                      <option>Three times daily</option>
                      <option>As needed</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#3A5A40] mb-1">Time Slot</label>
                    <select
                      value={medForm.timeSlot}
                      onChange={(e) => setMedForm({ ...medForm, timeSlot: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl border border-[#D5DDD1] bg-white/70 text-sm focus:outline-none"
                    >
                      <option>Morning</option>
                      <option>Afternoon</option>
                      <option>Evening</option>
                      <option>Night</option>
                      <option>Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#3A5A40] mb-1">Time</label>
                    <input
                      type="text"
                      value={medForm.timeInput}
                      onChange={(e) => setMedForm({ ...medForm, timeInput: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#D5DDD1] bg-white/70 text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#3A5A40] mb-1">AM / PM</label>
                    <select
                      value={medForm.timeAmPm}
                      onChange={(e) => setMedForm({ ...medForm, timeAmPm: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl border border-[#D5DDD1] bg-white/70 text-sm focus:outline-none"
                    >
                      <option>AM</option>
                      <option>PM</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#3A5A40] mb-1">Start Date</label>
                    <input
                      type="date"
                      value={medForm.startDate}
                      onChange={(e) => setMedForm({ ...medForm, startDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#D5DDD1] bg-white/70 text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#3A5A40] mb-1">End Date</label>
                    <input
                      type="date"
                      value={medForm.endDate}
                      onChange={(e) => setMedForm({ ...medForm, endDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#D5DDD1] bg-white/70 text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#3A5A40] mb-1">Current Stock</label>
                    <input
                      type="number"
                      value={medForm.currentStock}
                      onChange={(e) => setMedForm({ ...medForm, currentStock: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#D5DDD1] bg-white/70 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#3A5A40] mb-1">Total Stock</label>
                    <input
                      type="number"
                      value={medForm.totalStock}
                      onChange={(e) => setMedForm({ ...medForm, totalStock: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#D5DDD1] bg-white/70 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#3A5A40] mb-1">Refill Alert At</label>
                    <input
                      type="number"
                      value={medForm.refillThreshold}
                      onChange={(e) => setMedForm({ ...medForm, refillThreshold: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#D5DDD1] bg-white/70 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#3A5A40] mb-1">Special Instructions / Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Take with meals"
                    value={medForm.notes}
                    onChange={(e) => setMedForm({ ...medForm, notes: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-[#D5DDD1] bg-white/70 text-sm"
                  />
                </div>

                <div className="pt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowMedModal(false)}
                    className="flex-1 py-2.5 bg-white/70 hover:bg-white text-[#6A7B68] font-medium rounded-xl text-sm border border-[#EBEFE8]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-gradient-to-r from-[#6B9A6C] to-[#3A5A40] hover:brightness-105 text-white font-semibold rounded-xl text-sm shadow-[0_10px_30px_-8px_rgba(58,90,64,0.5)]"
                  >
                    {editingMedId ? 'Save Changes' : 'Add Prescription'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </>
  );
}