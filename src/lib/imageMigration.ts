import { useStockStore } from '@/store/stockStore';
import { useFicheTechnicStore } from '@/store/ficheTechnicStore';
import { useProductionStore } from '@/store/productionStore';
import { useComptoirStore } from '@/store/comptoirStore';
import { useSettingsStore } from '@/store/settingsStore';
import { isInlineImage, migrateInlineImage } from './images';
import { STORE_ASSETS_BUCKET } from './supabase';

export interface MigrationReport {
  found: number;
  migrated: number;
  failed: number;
  savedBytes: number;
}

/**
 * Finds every image still stored inline (base64 in the database rows),
 * optimises it and moves it into the Supabase storage bucket. The same
 * picture shared by a fiche, its productions and comptoir items is uploaded
 * only once.
 */
export async function optimizeExistingImages(onProgress?: (done: number, total: number) => void): Promise<MigrationReport> {
  const cache = new Map<string, string>();
  const collect = new Set<string>();

  const stock = useStockStore.getState().products;
  const fiches = useFicheTechnicStore.getState().ficheTechnics;
  const productions = useProductionStore.getState().productions;
  const comptoir = useComptoirStore.getState().items;
  const logo = useSettingsStore.getState().settings.logo;

  [...stock, ...fiches, ...productions, ...comptoir].forEach((x) => { if (isInlineImage(x.image)) collect.add(x.image); });
  const report: MigrationReport = { found: collect.size + (isInlineImage(logo) ? 1 : 0), migrated: 0, failed: 0, savedBytes: 0 };
  let done = 0;
  onProgress?.(0, report.found);

  for (const dataUrl of collect) {
    try {
      const url = await migrateInlineImage(dataUrl, 'migrated');
      cache.set(dataUrl, url);
      report.migrated++;
      report.savedBytes += Math.round(dataUrl.length * 0.75);
    } catch (e) {
      console.error('[images] migration failed', e);
      report.failed++;
    }
    onProgress?.(++done, report.found);
  }

  const swap = <T extends { image?: string | null }>(list: T[]) => {
    let changed = false;
    const next = list.map((x) => {
      const url = x.image ? cache.get(x.image) : undefined;
      if (!url) return x;
      changed = true;
      return { ...x, image: url };
    });
    return changed ? next : list;
  };

  useStockStore.setState({ products: swap(useStockStore.getState().products) });
  useFicheTechnicStore.setState({ ficheTechnics: swap(useFicheTechnicStore.getState().ficheTechnics) });
  useProductionStore.setState({ productions: swap(useProductionStore.getState().productions) });
  useComptoirStore.setState({ items: swap(useComptoirStore.getState().items) });

  if (isInlineImage(logo)) {
    try {
      const url = await migrateInlineImage(logo, 'logo', STORE_ASSETS_BUCKET);
      useSettingsStore.getState().updateSettings({ logo: url });
      report.migrated++;
      report.savedBytes += Math.round(logo.length * 0.75);
    } catch (e) {
      console.error('[images] logo migration failed', e);
      report.failed++;
    }
    onProgress?.(++done, report.found);
  }
  return report;
}
