import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CaisseReport, CaisseReportType } from '@/types';
import { uid, todayISO, nowTime } from '@/lib/utils';
import { getCurrentUsername } from './authStore';

interface CaisseReportState {
  reports: CaisseReport[];
  addReport: (data: {
    description: string;
    declaredAmount: number;
    reportType?: CaisseReportType;
    date?: string;
    endDate?: string;
    hour?: string;
  }) => CaisseReport;
  updateReport: (id: string, data: Partial<CaisseReport>) => void;
  deleteReport: (id: string) => void;
}

export const DEMO_CAISSE_REPORTS: CaisseReport[] = [
  {
    id: 'crep-1',
    reportType: 'day',
    date: '2026-07-14',
    hour: '19:45',
    description: 'Bilan de fin de journée - caisse équilibrée',
    declaredAmount: 22800,
    createdAt: '2026-07-14T19:45:00Z',
    createdBy: 'yacine'
  },
  {
    id: 'crep-2',
    reportType: 'day',
    date: '2026-07-15',
    hour: '20:00',
    description: 'Rapport caisse du 15 Juillet',
    declaredAmount: 31500,
    createdAt: '2026-07-15T20:00:00Z',
    createdBy: 'yacine'
  }
];

export const useCaisseReportStore = create<CaisseReportState>()(
  persist(
    (set, get) => ({
      reports: DEMO_CAISSE_REPORTS,

      addReport: ({ description, declaredAmount, reportType, date, endDate, hour }) => {
        const type: CaisseReportType = reportType || 'day';
        const report: CaisseReport = {
          id: uid('crep'),
          reportType: type,
          date: date || todayISO(),
          endDate: type === 'period' ? (endDate || date || todayISO()) : undefined,
          hour: hour || nowTime(),
          description,
          declaredAmount,
          createdAt: new Date().toISOString(),
          createdBy: getCurrentUsername(),
        };
        set({ reports: [report, ...get().reports] });
        return report;
      },

      updateReport: (id, data) =>
        set({ reports: get().reports.map((r) => (r.id === id ? { ...r, ...data } : r)) }),

      deleteReport: (id) => set({ reports: get().reports.filter((r) => r.id !== id) }),
    }),
    {
      name: 'boulengerie-caisse-reports',
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<CaisseReportState>;
        return {
          ...current,
          ...p,
          reports: p.reports && p.reports.length ? p.reports : DEMO_CAISSE_REPORTS,
        };
      },
    }
  )
);
