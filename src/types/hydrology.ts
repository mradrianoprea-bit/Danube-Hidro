export type CountryCode = 'DE' | 'AT' | 'SK' | 'HU' | 'HR' | 'RS' | 'RO' | 'BG';

export type DanubeSector = 'superior' | 'mijlociu' | 'inferior_delta';

export type BasinZoneId =
  | 'upper_de_at'
  | 'pannonian_sk_hu'
  | 'drava_sava_tisza'
  | 'iron_gates_west'
  | 'lower_ro_bg'
  | 'delta_siret_prut';

export type StationStatus = 'danger' | 'flood' | 'attention' | 'below_avg' | 'nominal';

export interface FloodThresholds {
  ca: number | null; // Cota de Atenție (cm)
  ci: number | null; // Cota de Inundație (cm)
  cp: number | null; // Cota de Pericol (cm)
}

export interface DanubeStation {
  id: string;
  code: string;
  name: string;
  country: CountryCode;
  sector: DanubeSector;
  basinZoneId: BasinZoneId;
  km: number;
  lat: number;
  lon: number;
  agency: string;
  sourceUrl: string;
  currentLevelCm: number;
  yesterdayMorningCm: number | null;
  yesterdayEveningCm: number | null;
  change24hCm: number;
  dischargeM3s: number | null;
  glofasDischargeM3s: number;
  waterTempC: number | null;
  iceCondition: string | null;
  thresholds: FloodThresholds;
  tenYearAvgCm: number;
  tenYearMinCm: number;
  tenYearMaxCm: number;
  deviationFrom10YrCm: number;
  forecast3dCm: number;
  forecast14dCm: number;
  status: StationStatus;
  observedAt: string;
  pegelUuid?: string;
}

export interface ForecastPoint {
  date: string;
  predictedCm: number;
  minCm: number;
  maxCm: number;
  dischargeM3s: number;
  localPrecipMm: number;
  upstreamBasinPrecipMm: number;
  horizon: 'short_3d' | 'long_14d';
}

export interface HistoricalPoint {
  date: string;
  levelCm: number;
  dischargeM3s: number;
  tenYearClimatologyCm: number;
  source: 'pegelonline_15m' | 'hydroinfo_obs' | 'glofas_reanalysis';
}

export interface MonthlyClimatologyPoint {
  month: string;
  avgCm: number;
  minCm: number;
  maxCm: number;
}

export interface BasinPrecipitationZone {
  id: BasinZoneId;
  name: string;
  region: string;
  lat: number;
  lon: number;
  total14dMm: number;
  maxDailyMm: number;
  lagDaysToLowerDanube: number;
  daily: Array<{
    date: string;
    precipitationMm: number;
  }>;
}

export interface StationDetailPayload {
  station: DanubeStation;
  forecast3d: ForecastPoint[];
  forecast14d: ForecastPoint[];
  history30d: HistoricalPoint[];
  monthlyClimatology10Yr: MonthlyClimatologyPoint[];
  basinZones: BasinPrecipitationZone[];
  methodologyNote: string;
}

export interface PushAlertItem {
  id: string;
  stationId: string;
  stationName: string;
  country: CountryCode;
  km: number;
  type: 'flood_cp' | 'flood_ci' | 'flood_ca' | 'below_10yr_avg';
  severity: 'critical' | 'high' | 'warning' | 'info';
  currentLevelCm: number;
  referenceCm: number;
  deltaCm: number;
  message: string;
  timestamp: string;
}

export interface OverviewResponse {
  observedDateLabel: string;
  fetchedAt: string;
  sources: Array<{
    name: string;
    authority: string;
    url: string;
    status: 'live' | 'cached';
  }>;
  stations: DanubeStation[];
  alerts: PushAlertItem[];
  basinZones: BasinPrecipitationZone[];
}
