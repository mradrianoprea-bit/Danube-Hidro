import type { BasinZoneId, CountryCode, DanubeSector, StationStatus } from '../types/hydrology';

export const COUNTRY_NAMES_RO: Record<CountryCode, string> = {
  DE: 'Germania',
  AT: 'Austria',
  SK: 'Slovacia',
  HU: 'Ungaria',
  HR: 'Croația',
  RS: 'Serbia',
  RO: 'România',
  BG: 'Bulgaria',
};

export const SECTOR_NAMES_RO: Record<DanubeSector, string> = {
  superior: 'Dunărea Superioară',
  mijlociu: 'Dunărea Mijlocie',
  inferior_delta: 'Dunărea Inferioară & Deltă',
};

export const BASIN_SHORT_NAMES: Record<BasinZoneId, string> = {
  upper_de_at: 'Bazin Superior (DE/AT)',
  pannonian_sk_hu: 'Bazin Pannonic (SK/HU)',
  drava_sava_tisza: 'Drava · Sava · Tisa',
  iron_gates_west: 'Porțile de Fier & Banat',
  lower_ro_bg: 'Dunărea Inferioară (RO/BG)',
  delta_siret_prut: 'Delta & Siret–Prut',
};

export interface StatusPresentation {
  label: string;
  shortLabel: string;
  glyph: string;
  textClass: string;
  markerColor: string;
}

export function getStatusPresentation(status: StationStatus): StatusPresentation {
  switch (status) {
    case 'danger':
      return {
        label: 'Depășire Cotă Pericol (CP)',
        shortLabel: 'Pericol CP',
        glyph: '◆',
        textClass: 'text-rose-700 dark:text-rose-400',
        markerColor: '#BE123C',
      };
    case 'flood':
      return {
        label: 'Depășire Cotă Inundație (CI)',
        shortLabel: 'Inundație CI',
        glyph: '■',
        textClass: 'text-red-700 dark:text-red-400',
        markerColor: '#DC2626',
      };
    case 'attention':
      return {
        label: 'Depășire Cotă Atenție (CA)',
        shortLabel: 'Atenție CA',
        glyph: '▲',
        textClass: 'text-amber-700 dark:text-amber-400',
        markerColor: '#D97706',
      };
    case 'below_avg':
      return {
        label: 'Sub Media Anuală 10 Ani',
        shortLabel: 'Sub Media 10A',
        glyph: '▼',
        textClass: 'text-sky-700 dark:text-sky-400',
        markerColor: '#0284C7',
      };
    default:
      return {
        label: 'Regim Hidrologic Nominal',
        shortLabel: 'Nominal',
        glyph: '●',
        textClass: 'text-emerald-700 dark:text-emerald-400',
        markerColor: '#16A34A',
      };
  }
}

export function formatSignedCm(val: number): string {
  if (val > 0) return `+${val} cm`;
  return `${val} cm`;
}
