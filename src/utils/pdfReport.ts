import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Language } from '../i18n/LanguageContext';
import type { DanubeStation, OverviewResponse, StationDetailPayload } from '../types/hydrology';
import { getBasinRegionName, getBasinShortName, getCountryName, getStatusPresentation } from './statusFormat';

/**
 * Normalizes Romanian diacritics to clean ASCII for jsPDF built-in Helvetica font
 * so every exported PDF renders crisp text with zero encoding glitches.
 */
function asciiRo(text: string): string {
  return text
    .replace(/[ăâ]/g, 'a')
    .replace(/[ĂÂ]/g, 'A')
    .replace(/î/g, 'i')
    .replace(/Î/g, 'I')
    .replace(/[șş]/g, 's')
    .replace(/[ȘŞ]/g, 'S')
    .replace(/[țţ]/g, 't')
    .replace(/[ȚŢ]/g, 'T')
    .replace(/[–—]/g, '-');
}

export function exportStationReportPdf(detail: StationDetailPayload, lang: Language = 'ro'): void {
  const isEn = lang === 'en';
  const { station, forecast3d, forecast14d, history30d, basinZones } = detail;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const statusInfo = getStatusPresentation(station.status, lang);

  // Header band
  doc.setFillColor(3, 105, 161);
  doc.rect(0, 0, 210, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(
    asciiRo(
      isEn
        ? `DANUBE HYDROLOGICAL BULLETIN - ${station.name.toUpperCase()} STATION`
        : `BULETIN HIDROLOGIC DUNARE - STATIA ${station.name.toUpperCase()}`,
    ),
    14,
    12,
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    asciiRo(
      isEn
        ? `River km ${station.km.toFixed(1)} | Country: ${getCountryName(station.country, 'en')} | Source: ${station.agency} | Observation: ${station.observedAt}`
        : `Km fluvial ${station.km.toFixed(1)} | Tara: ${getCountryName(station.country, 'ro')} | Sursa: ${station.agency} | Data observatie: ${station.observedAt}`,
    ),
    14,
    19,
  );

  // Key metrics summary table
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(
    asciiRo(
      isEn
        ? '1. Current Hydro-Meteorological Parameters & Defense Thresholds'
        : '1. Parametri Hidro-Meteorologici Curenti si Cote de Aparare',
    ),
    14,
    35,
  );

  autoTable(doc, {
    startY: 38,
    head: [[
      asciiRo(isEn ? 'Indicator' : 'Indicator'),
      asciiRo(isEn ? 'Value' : 'Valoare'),
      asciiRo(isEn ? 'Reference / Threshold' : 'Referinta / Prag'),
      asciiRo(isEn ? 'Assessment' : 'Evaluare'),
    ]],
    body: [
      [
        asciiRo(isEn ? 'Current water level' : 'Cota curenta'),
        `${station.currentLevelCm} cm`,
        `${isEn ? '24h chg' : 'Var. 24h'}: ${station.change24hCm >= 0 ? '+' : ''}${station.change24hCm} cm`,
        asciiRo(statusInfo.label),
      ],
      [
        asciiRo(isEn ? '10-year annual mean (2016-2025)' : 'Media anuala 10 ani (2016-2025)'),
        `${station.tenYearAvgCm} cm`,
        `Min/Max: ${station.tenYearMinCm} / ${station.tenYearMaxCm} cm`,
        asciiRo(`${isEn ? 'Deviation' : 'Deviatie'}: ${station.deviationFrom10YrCm >= 0 ? '+' : ''}${station.deviationFrom10YrCm} cm`),
      ],
      [
        asciiRo(isEn ? 'Observed / GloFAS discharge' : 'Debit masurat / GloFAS'),
        `${station.dischargeM3s ?? station.glofasDischargeM3s} m3/s`,
        `GloFAS model: ${station.glofasDischargeM3s} m3/s`,
        station.waterTempC !== null
          ? `${isEn ? 'Water temp' : 'Temp. apa'}: ${station.waterTempC} C`
          : `${isEn ? 'Water temp' : 'Temp. apa'}: -`,
      ],
      [
        asciiRo(isEn ? 'Defense thresholds (CA / CI / CP)' : 'Cote de aparare (CA / CI / CP)'),
        `${station.thresholds.ca ?? '-'} / ${station.thresholds.ci ?? '-'} / ${station.thresholds.cp ?? '-'} cm`,
        asciiRo(isEn ? 'Attention / Flood / Danger' : 'Atentie / Inundatie / Pericol'),
        station.thresholds.ci && station.currentLevelCm >= station.thresholds.ci
          ? asciiRo(isEn ? 'FLOOD THRESHOLD EXCEEDED!' : 'DEPASIRE CI!')
          : asciiRo(isEn ? 'Below flood thresholds' : 'Sub praguri inundatie'),
      ],
    ],
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  const afterSummaryY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(
    asciiRo(
      isEn
        ? '2. Short-Term (3-Day) and Long-Term (14-Day Rainfall-Coupled) Forecast'
        : '2. Prognoza pe Termen Scurt (3 Zile) si Termen Lung (14 Zile - Pluviometrie Bazin)',
    ),
    14,
    afterSummaryY,
  );

  autoTable(doc, {
    startY: afterSummaryY + 3,
    head: [[
      isEn ? 'Date' : 'Data',
      isEn ? 'Horizon' : 'Orizont',
      isEn ? 'Forecast (cm)' : 'Cota prognozata (cm)',
      isEn ? 'Range (cm)' : 'Interval (cm)',
      isEn ? 'Est. Q (m3/s)' : 'Debit est. (m3/s)',
      isEn ? 'Local rain (mm)' : 'Ploaie locala (mm)',
      isEn ? 'Upstream (mm)' : 'Aport amonte (mm)',
    ]],
    body: forecast14d.map((f, idx) => [
      f.date,
      idx < 3 ? (isEn ? '3 Days' : '3 Zile') : isEn ? '14 Days' : '14 Zile',
      `${f.predictedCm}`,
      `${f.minCm} .. ${f.maxCm}`,
      `${f.dischargeM3s}`,
      `${f.localPrecipMm.toFixed(1)}`,
      `${f.upstreamBasinPrecipMm.toFixed(1)}`,
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [3, 105, 161], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // Page 2 for Basin Rainfall & Recent 30d History
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(
    asciiRo(
      isEn
        ? '3. 14-Day Cumulative Precipitation Regime Across Danube Sub-Basins'
        : '3. Regimul Pluviometric Cumulat pe 14 Zile in Zonele Bazinului Dunarii',
    ),
    14,
    16,
  );

  autoTable(doc, {
    startY: 19,
    head: [[
      isEn ? 'Basin Zone' : 'Zona Bazin',
      isEn ? 'Region' : 'Regiune',
      isEn ? '14-Day Total (mm)' : 'Cumul 14 zile (mm)',
      isEn ? 'Daily Max (mm)' : 'Max zilnic (mm)',
      isEn ? 'Downstream lag' : 'Timp tranzit spre aval',
    ]],
    body: basinZones.map((z) => [
      asciiRo(isEn ? getBasinShortName(z.id, 'en') : z.name),
      asciiRo(getBasinRegionName(z.id, z.region, lang)),
      `${z.total14dMm.toFixed(1)} mm`,
      `${z.maxDailyMm.toFixed(1)} mm`,
      `${z.lagDaysToLowerDanube} ${isEn ? 'days' : 'zile'}`,
    ]),
    styles: { fontSize: 8.5, cellPadding: 2.3 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
  });

  const afterBasinY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(
    asciiRo(
      isEn
        ? '4. Recent History (Last 14 Observed / Reanalyzed Days)'
        : '4. Istoric Recent (Ultimele 14 zile inregistrate / reanalizate)',
    ),
    14,
    afterBasinY,
  );

  autoTable(doc, {
    startY: afterBasinY + 3,
    head: [[
      isEn ? 'Date' : 'Data',
      isEn ? 'Level (cm)' : 'Cota (cm)',
      isEn ? 'Discharge (m3/s)' : 'Debit (m3/s)',
      isEn ? '10Y Mean (cm)' : 'Media 10 Ani (cm)',
      isEn ? 'Source' : 'Sursa',
    ]],
    body: history30d.slice(-14).map((h) => [
      h.date,
      `${h.levelCm}`,
      `${h.dischargeM3s}`,
      `${h.tenYearClimatologyCm}`,
      h.source,
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      asciiRo(
        isEn
          ? `HidroDunare · This application is not official, but uses information from official sources (OVF Hydroinfo, AFDJ/INHGA, WSV Pegelonline, GloFAS v4, ECMWF) · Page ${i}/${pageCount}`
          : `HidroDunare · Aplicatia nu este oficiala, dar foloseste informatii din surse oficiale (OVF Hydroinfo, AFDJ/INHGA, WSV Pegelonline, GloFAS v4, ECMWF) · Pagina ${i}/${pageCount}`,
      ),
      14,
      290,
    );
  }

  void forecast3d;
  doc.save(`HidroDunare_${station.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportBasinBulletinPdf(
  overview: OverviewResponse,
  stations: DanubeStation[],
  lang: Language = 'ro',
): void {
  const isEn = lang === 'en';
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const floodAlerts = overview.alerts.filter((a) => a.type !== 'below_10yr_avg');

  doc.setFillColor(3, 105, 161);
  doc.rect(0, 0, 297, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(
    asciiRo(
      isEn
        ? 'HYDROLOGICAL BULLETIN - DANUBE WATER LEVELS'
        : 'BULETIN HIDROLOGIC - COTELE APELOR DUNARII',
    ),
    14,
    10.5,
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    asciiRo(
      isEn
        ? `Observation date: ${overview.observedDateLabel} | Stations included: ${stations.length} | Active flood alerts: ${floodAlerts.length} | Generated: ${new Date().toLocaleString('en-GB')}`
        : `Data observatiei: ${overview.observedDateLabel} | Statii incluse: ${stations.length} | Alerte inundatie active: ${floodAlerts.length} | Generat: ${new Date().toLocaleString('ro-RO')}`,
    ),
    14,
    17,
  );

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(
    asciiRo(
      isEn
        ? 'Active Flood Threshold Alerts (CA / CI / CP)'
        : 'Alerte Active (Depasiri Cote de Atentie / Inundatie / Pericol - CA / CI / CP)',
    ),
    14,
    30,
  );

  const topAlerts = floodAlerts.slice(0, 12);
  autoTable(doc, {
    startY: 33,
    head: [[
      isEn ? 'Locality' : 'Localitate',
      'Km',
      isEn ? 'Alert Type' : 'Tip Alerta',
      isEn ? 'Current Level' : 'Cota Curenta',
      isEn ? 'Threshold' : 'Prag (CA/CI/CP)',
      isEn ? 'Exceedance' : 'Depasire',
    ]],
    body:
      topAlerts.length > 0
        ? topAlerts.map((a) => [
            asciiRo(`${a.stationName} (${a.country})`),
            `${a.km.toFixed(1)}`,
            asciiRo(a.type.toUpperCase()),
            `${a.currentLevelCm} cm`,
            `${a.referenceCm} cm`,
            `${a.deltaCm >= 0 ? '+' : ''}${a.deltaCm} cm`,
          ])
        : [[asciiRo(isEn ? 'No active flood alerts currently' : 'Fara alerte de inundatie active in prezent'), '-', '-', '-', '-', '-']],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [185, 28, 28], textColor: 255 },
  });

  const nextY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(
    asciiRo(
      isEn
        ? 'Current Water Levels and Forecasts (3-Day / 14-Day) by Locality'
        : 'Situatia Curenta si Prognozele (3 Zile / 14 Zile) pe Localitati',
    ),
    14,
    nextY,
  );

  autoTable(doc, {
    startY: nextY + 3,
    head: [[
      isEn ? 'Locality' : 'Localitate',
      isEn ? 'Country' : 'Tara',
      'Km',
      isEn ? 'Level (cm)' : 'Cota (cm)',
      isEn ? '24h Chg' : 'Var 24h',
      isEn ? '10Y Avg' : 'Media 10A',
      isEn ? '10Y Dev' : 'Deviatie 10A',
      isEn ? '3D Fcst' : 'Prog 3Z',
      isEn ? '14D Fcst' : 'Prog 14Z',
      'CA / CI / CP',
      'Status',
    ]],
    body: stations.map((s) => [
      asciiRo(s.name),
      s.country,
      s.km.toFixed(0),
      `${s.currentLevelCm}`,
      `${s.change24hCm >= 0 ? '+' : ''}${s.change24hCm}`,
      `${s.tenYearAvgCm}`,
      `${s.deviationFrom10YrCm >= 0 ? '+' : ''}${s.deviationFrom10YrCm}`,
      `${s.forecast3dCm}`,
      `${s.forecast14dCm}`,
      `${s.thresholds.ca ?? '-'}/${s.thresholds.ci ?? '-'}/${s.thresholds.cp ?? '-'}`,
      asciiRo(getStatusPresentation(s.status, lang).shortLabel),
    ]),
    styles: { fontSize: 7.5, cellPadding: 1.8 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  const basinPageCount = doc.getNumberOfPages();
  for (let i = 1; i <= basinPageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      asciiRo(
        isEn
          ? `HidroDunare · This application is not official, but uses information from official sources (OVF Hydroinfo, AFDJ/INHGA, WSV Pegelonline, Copernicus GloFAS v4, ECMWF) · Page ${i}/${basinPageCount}`
          : `HidroDunare · Aplicatia nu este oficiala, dar foloseste informatii din surse oficiale (OVF Hydroinfo, AFDJ/INHGA, WSV Pegelonline, Copernicus GloFAS v4, ECMWF) · Pagina ${i}/${basinPageCount}`,
      ),
      14,
      204,
    );
  }

  doc.save(
    `${isEn ? 'Danube_Water_Levels_Bulletin' : 'Buletin_Cotele_Dunarii'}_${new Date().toISOString().slice(0, 10)}.pdf`,
  );
}
