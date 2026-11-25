import type { Language } from '../i18n/LanguageContext';
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

export const COUNTRY_NAMES_EN: Record<CountryCode, string> = {
  DE: 'Germany',
  AT: 'Austria',
  SK: 'Slovakia',
  HU: 'Hungary',
  HR: 'Croatia',
  RS: 'Serbia',
  RO: 'Romania',
  BG: 'Bulgaria',
};

export function getCountryName(code: CountryCode, lang: Language = 'ro'): string {
  return lang === 'en' ? COUNTRY_NAMES_EN[code] : COUNTRY_NAMES_RO[code];
}

export const SECTOR_NAMES_RO: Record<DanubeSector, string> = {
  superior: 'Dunărea Superioară',
  mijlociu: 'Dunărea Mijlocie',
  inferior_delta: 'Dunărea Inferioară & Deltă',
};

export const SECTOR_NAMES_EN: Record<DanubeSector, string> = {
  superior: 'Upper Danube',
  mijlociu: 'Middle Danube',
  inferior_delta: 'Lower Danube & Delta',
};

export function getSectorName(sector: DanubeSector, lang: Language = 'ro'): string {
  return lang === 'en' ? SECTOR_NAMES_EN[sector] : SECTOR_NAMES_RO[sector];
}

export const BASIN_SHORT_NAMES: Record<BasinZoneId, string> = {
  upper_de_at: 'Bazin Superior (DE/AT)',
  pannonian_sk_hu: 'Bazin Pannonic (SK/HU)',
  drava_sava_tisza: 'Drava · Sava · Tisa',
  iron_gates_west: 'Porțile de Fier & Banat',
  lower_ro_bg: 'Dunărea Inferioară (RO/BG)',
  delta_siret_prut: 'Delta & Siret–Prut',
};

export const BASIN_SHORT_NAMES_EN: Record<BasinZoneId, string> = {
  upper_de_at: 'Upper Basin (DE/AT)',
  pannonian_sk_hu: 'Pannonian Basin (SK/HU)',
  drava_sava_tisza: 'Drava · Sava · Tisza',
  iron_gates_west: 'Iron Gates & Banat',
  lower_ro_bg: 'Lower Danube (RO/BG)',
  delta_siret_prut: 'Delta & Siret–Prut',
};

export const BASIN_REGION_NAMES_EN: Record<BasinZoneId, string> = {
  upper_de_at: 'Bavaria / Alps (DE · AT)',
  pannonian_sk_hu: 'Slovakia / Hungary (SK · HU)',
  drava_sava_tisza: 'Croatia / Serbia (HR · RS)',
  iron_gates_west: 'Iron Gates & Banat (RO · RS)',
  lower_ro_bg: 'Lower Danube (RO · BG)',
  delta_siret_prut: 'Danube Delta & Siret–Prut (RO)',
};

export function getBasinShortName(zoneId: BasinZoneId, lang: Language = 'ro'): string {
  return lang === 'en' ? BASIN_SHORT_NAMES_EN[zoneId] : BASIN_SHORT_NAMES[zoneId];
}

export function getBasinRegionName(zoneId: BasinZoneId, fallbackRo: string, lang: Language = 'ro'): string {
  return lang === 'en' ? BASIN_REGION_NAMES_EN[zoneId] : fallbackRo;
}

const MONTH_MAP_EN: Record<string, string> = {
  Ian: 'Jan',
  Feb: 'Feb',
  Mar: 'Mar',
  Apr: 'Apr',
  Mai: 'May',
  Iun: 'Jun',
  Iul: 'Jul',
  Aug: 'Aug',
  Sep: 'Sep',
  Oct: 'Oct',
  Nov: 'Nov',
  Dec: 'Dec',
};

export function translateMonthLabel(month: string, lang: Language = 'ro'): string {
  if (lang === 'en') return MONTH_MAP_EN[month] ?? month;
  return month;
}

export interface StatusPresentation {
  label: string;
  shortLabel: string;
  glyph: string;
  textClass: string;
  markerColor: string;
}

export function getStatusPresentation(status: StationStatus, lang: Language = 'ro'): StatusPresentation {
  switch (status) {
    case 'danger':
      return {
        label: lang === 'en' ? 'Danger Threshold Exceeded (CP)' : 'Depășire Cotă Pericol (CP)',
        shortLabel: lang === 'en' ? 'Danger CP' : 'Pericol CP',
        glyph: '◆',
        textClass: 'text-rose-700 dark:text-rose-400',
        markerColor: '#BE123C',
      };
    case 'flood':
      return {
        label: lang === 'en' ? 'Flood Threshold Exceeded (CI)' : 'Depășire Cotă Inundație (CI)',
        shortLabel: lang === 'en' ? 'Flood CI' : 'Inundație CI',
        glyph: '■',
        textClass: 'text-red-700 dark:text-red-400',
        markerColor: '#DC2626',
      };
    case 'attention':
      return {
        label: lang === 'en' ? 'Attention Threshold Exceeded (CA)' : 'Depășire Cotă Atenție (CA)',
        shortLabel: lang === 'en' ? 'Attention CA' : 'Atenție CA',
        glyph: '▲',
        textClass: 'text-amber-700 dark:text-amber-400',
        markerColor: '#D97706',
      };
    case 'below_avg':
      return {
        label: lang === 'en' ? 'Below 10-Year Annual Mean' : 'Sub Media Anuală 10 Ani',
        shortLabel: lang === 'en' ? 'Below 10Y Avg' : 'Sub Media 10A',
        glyph: '▼',
        textClass: 'text-sky-700 dark:text-sky-400',
        markerColor: '#0284C7',
      };
    default:
      return {
        label: lang === 'en' ? 'Nominal Hydrological Regime' : 'Regim Hidrologic Nominal',
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
