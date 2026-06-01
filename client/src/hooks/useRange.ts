import { create } from 'zustand';

interface RangeState {
  days: number;
  setDays: (days: number) => void;
}

export const useRange = create<RangeState>((set) => ({
  days: parseInt(localStorage.getItem('rangeDays') ?? '30', 10),
  setDays: (days) => {
    localStorage.setItem('rangeDays', String(days));
    set({ days });
  },
}));
