import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DanubeStation, OverviewResponse, StationDetailPayload } from '../types/hydrology';
import { COUNTRY_NAMES_RO, getStatusPresentation } from './statusFormat';

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

export function exportStationReportPdf(detail: StationDetailPayload): void {
  const { station, forecast3d, forecast14d, history30d, basinZones } = detail;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const statusInfo = getStatusPresentation(station.status);

  // Header band
  doc.setFillColor(3, 105, 161);
  doc.rect(0, 0, 210, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(asciiRo(`BULETIN HIDROLOGIC DUNARE - STATIA ${station.name.toUpperCase()}`), 14, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    asciiRo(
      `Km fluvial ${station.km.toFixed(1)} | Tara: ${COUNTRY_NAMES_RO[station.country]} | Sursa: ${station.agency} | Data observatie: ${station.observedAt}`,
    ),
    14,
    19,
  );

  // Key metrics summary table
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(asciiRo('1. Parametri Hidro-Meteorologici Curente si Praguri Oficiale'), 14, 35);

  autoTable(doc, {
    startY: 38,
    head: [[
      asciiRo('Indicator'),
      asciiRo('Valoare'),
      asciiRo('Referinta / Prag'),
      asciiRo('Evaluare'),
    ]],
    body: [
      [asciiRo('Cota curenta'), `${station.currentLevelCm} cm`, `Var. 24h: ${station.change24hCm >= 0 ? '+' : ''}${station.change24hCm} cm`, asciiRo(statusInfo.label)],
      [asciiRo('Media anuala 10 ani (2016-2025)'), `${station.tenYearAvgCm} cm`, `Min/Max: ${station.tenYearMinCm} / ${station.tenYearMaxCm} cm`, asciiRo(`Deviație: ${station.deviationFrom10YrCm >= 0 ? '+' : ''}${station.deviationFrom10YrCm} cm`)],
      [asciiRo('Debit masurat / GloFAS'), `${station.dischargeM3s ?? station.glofasDischargeM3s} m3/s`, `GloFAS model: ${station.glofasDischargeM3s} m3/s`, station.waterTempC !== null ? `Temp. apa: ${station.waterTempC} C` : 'Temp. apa: -'],
      [asciiRo('Cote de aparare (CA / CI / CP)'), `${station.thresholds.ca ?? '-'} / ${station.thresholds.ci ?? '-'} / ${station.thresholds.cp ?? '-'} cm`, asciiRo('Atentie / Inundatie / Pericol'), station.thresholds.ci && station.currentLevelCm >= station.thresholds.ci ? asciiRo('DEPAŞIRE CI!') : asciiRo('Sub praguri inundatie')],
    ],
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  const afterSummaryY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(asciiRo('2. Prognoza pe Termen Scurt (3 Zile) si Termen Lung (14 Zile - Pluviometrie Bazin)'), 14, afterSummaryY);

  autoTable(doc, {
    startY: afterSummaryY + 3,
    head: [[
      'Data',
      'Orizont',
      'Cota prognozata (cm)',
      'Interval (cm)',
      'Debit est. (m3/s)',
      'Ploaie locala (mm)',
      'Aport amonte (mm)',
    ]],
    body: forecast14d.map((f, idx) => [
      f.date,
      idx < 3 ? '3 Zile' : '14 Zile',
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
  doc.text(asciiRo('3. Regimul Pluviometric Cumulat pe 14 Zile in Zonele Bazinului Dunarii'), 14, 16);

  autoTable(doc, {
    startY: 19,
    head: [['Zona Bazin', 'Regiune', 'Cumul 14 zile (mm)', 'Max zilnic (mm)', 'Timp tranzit spre aval']],
    body: basinZones.map((z) => [
      asciiRo(z.name),
      asciiRo(z.region),
      `${z.total14dMm.toFixed(1)} mm`,
      `${z.maxDailyMm.toFixed(1)} mm`,
      `${z.lagDaysToLowerDanube} zile`,
    ]),
    styles: { fontSize: 8.5, cellPadding: 2.3 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
  });

  const afterBasinY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(asciiRo('4. Istoric Recent (Ultimele 14 zile inregistrate / reanalizate)'), 14, afterBasinY);

  autoTable(doc, {
    startY: afterBasinY + 3,
    head: [['Data', 'Cota (cm)', 'Debit (m3/s)', 'Media 10 Ani (cm)', 'Sursa']],
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

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      asciiRo(`HidroDunare · Surse oficiale: OVF Hydroinfo, AFDJ/INHGA, WSV Pegelonline, Copernicus GloFAS v4, ECMWF · Generat: ${new Date().toLocaleString('ro-RO')} · Pagina ${i}/${pageCount}`),
      14,
      290,
    );
  }

  // Note: reference forecast3d count in metadata
  void forecast3d;
  doc.save(`HidroDunare_${station.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportBasinBulletinPdf(overview: OverviewResponse, stations: DanubeStation[]): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFillColor(3, 105, 161);
  doc.rect(0, 0, 297, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(asciiRo('BULETIN HIDROLOGIC OFICIAL - COTELE APELOR DUNARII'), 14, 10.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    asciiRo(
      `Data observatiei: ${overview.observedDateLabel} | Statii incluse: ${stations.length} | Alerte active: ${overview.alerts.length} | Generat: ${new Date().toLocaleString('ro-RO')}`,
    ),
    14,
    17,
  );

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(asciiRo('Alerte Active (Depasiri Cote Inundatie & Scaderi Sub Media pe 10 Ani)'), 14, 30);

  const topAlerts = overview.alerts.slice(0, 12);
  autoTable(doc, {
    startY: 33,
    head: [['Localitate', 'Km', 'Tip Alerta', 'Cota Curenta', 'Prag / Media 10A', 'Diferenta']],
    body:
      topAlerts.length > 0
        ? topAlerts.map((a) => [
            asciiRo(`${a.stationName} (${a.country})`),
            `${a.km.toFixed(1)}`,
            asciiRo(a.type === 'below_10yr_avg' ? 'Sub Media 10 Ani' : a.type.toUpperCase()),
            `${a.currentLevelCm} cm`,
            `${a.referenceCm} cm`,
            `${a.deltaCm >= 0 ? '+' : ''}${a.deltaCm} cm`,
          ])
        : [[asciiRo('Fara alerte active in prezent'), '-', '-', '-', '-', '-']],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [185, 28, 28], textColor: 255 },
  });

  const nextY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(asciiRo('Situatia Curenta si Prognozele (3 Zile / 14 Zile) pe Localitati'), 14, nextY);

  autoTable(doc, {
    startY: nextY + 3,
    head: [[
      'Localitate',
      'Tara',
      'Km',
      'Cota (cm)',
      'Var 24h',
      'Media 10A',
      'Deviație 10A',
      'Prog 3Z',
      'Prog 14Z',
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
      asciiRo(getStatusPresentation(s.status).shortLabel),
    ]),
    styles: { fontSize: 7.5, cellPadding: 1.8 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`Buletin_Cotele_Dunarii_${new Date().toISOString().slice(0, 10)}.pdf`);
}
