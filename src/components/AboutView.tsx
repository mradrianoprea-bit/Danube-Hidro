import React from 'react';
import { BellRing, Database, FileText, Layers, MapPin, TrendingUp } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export const AboutView: React.FC = () => {
  const { lang } = useLanguage();
  const isEn = lang === 'en';

  if (isEn) {
    return (
      <div className="space-y-6 max-w-4xl">
        {/* Disclaimer */}
        <section className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 rounded-xl px-5 py-3.5 text-sm text-amber-950 dark:text-amber-200">
          <strong>Important notice:</strong> This application is not official, but uses information from official sources.
        </section>

        {/* 1. Official Data Sources */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
            <Database className="w-5 h-5 text-sky-700 dark:text-sky-400 shrink-0" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              1. Official Hydrological &amp; Meteorological Data Sources
            </h2>
          </div>

          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            This application is not official, but uses exclusively information from official hydrological and meteorological sources (76 localities along the entire course of the Danube, including all 26 Romanian ports from Baziaș to Sulina):
          </p>

          <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed list-disc pl-5">
            <li>
              <strong className="text-slate-900 dark:text-slate-100">
                OVF Hydroinfo Danube Exchange
              </strong>{' '}
              (official international hydrological data exchange for the Danube basin — includes daily readings from AFDJ Galați / INHGA, RHMZ Serbia, SHMÚ Slovakia, EAEMDR Bulgaria): current water level (cm), 24h change, discharge (m³/s), water temperature, and ice regime.
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100">
                WSV / VIA DONAU Pegelonline REST API v2
              </strong>
              : high-frequency telemetry (15 min) and real 30-day historical observations for the German and Austrian sectors.
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100">
                Copernicus EMS GloFAS v4 (ECMWF)
              </strong>
              : 10-year daily reanalysis (2016–2025) for calculating the 10-year multi-annual mean at each station and hydrological discharge forecasting.
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100">
                ECMWF / DWD ICON (Open-Meteo)
              </strong>
              : 14-day daily rainfall forecast across the 6 Danube sub-basins (Bavaria/Alps, Pannonian Basin, Drava–Sava–Tisza, Iron Gates &amp; Banat, Lower Danube RO/BG, Delta &amp; Siret–Prut).
            </li>
          </ul>
        </section>

        {/* 2. Key Implemented Features */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
            <Layers className="w-5 h-5 text-sky-700 dark:text-sky-400 shrink-0" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              2. Key Implemented Features
            </h2>
          </div>

          <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-4 h-4 text-sky-700 dark:text-sky-400 mt-1 shrink-0" />
              <p>
                <strong className="text-slate-900 dark:text-slate-100">
                  Current Level, 3-Day Forecast &amp; 14-Day Rainfall-Coupled Forecast:
                </strong>{' '}
                interactive SVG hydrograph with point readout, uncertainty band, 14-day upstream-routed precipitation bars with hydrological travel time, and reference lines for CA / CI / CP thresholds and the 10-Year Mean.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <BellRing className="w-4 h-4 text-sky-700 dark:text-sky-400 mt-1 shrink-0" />
              <p>
                <strong className="text-slate-900 dark:text-slate-100">
                  Real-Time Push Alerts
                </strong>{' '}
                for exceeding Attention, Flood, and Danger thresholds (CA / CI / CP), with locality filters, enable/disable toggle, and instant push notification testing.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-sky-700 dark:text-sky-400 mt-1 shrink-0" />
              <div className="space-y-3">
                <p>
                  <strong className="text-slate-900 dark:text-slate-100">
                    Interactive Map &amp; Detailed History:
                  </strong>{' '}
                  map displaying the Danube river course, distinct markers by hydrological status, 14-day rainfall overlay, 30-day history, and 10-year monthly climatology.
                </p>

                <div className="pl-3 border-l-2 border-slate-200 dark:border-slate-700 space-y-2.5 text-xs sm:text-sm">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      Interactive Map (OpenStreetMap):
                    </div>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>
                        Toggle to display estimated 14-day precipitation zones across the 6 Danube sub-basins.
                      </li>
                    </ul>
                  </div>

                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      Fast Map Filtering &amp; Navigation:
                    </div>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>
                        Direct sector filters: Entire Basin, Romania, Upper, Middle, Lower &amp; Delta (with automatic map centering).
                      </li>
                      <li>
                        Hydrological status filter: All statuses, Flood Alerts (CA/CI/CP), Below 10-Year Mean, Nominal Regime.
                      </li>
                      <li>
                        Quick map search with instant suggestions, automatic zoom, and popup opening on the selected station.
                      </li>
                    </ul>
                  </div>

                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      Full Data Access Directly from Map Points:
                    </div>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>
                        Clicking any map point opens an interactive popup with current water level (cm), 24h variation, 10-year annual mean, 3-day forecast, 2-week forecast, and 3 direct buttons (History, 3 Days, 14 Days) that immediately open the corresponding chart in the detail panel.
                      </li>
                      <li>
                        Below the map, a synchronized telemetry bar displays the selected station&apos;s values together with a 30-day evolution sparkline.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FileText className="w-4 h-4 text-sky-700 dark:text-sky-400 mt-1 shrink-0" />
              <p>
                <strong className="text-slate-900 dark:text-slate-100">PDF Export:</strong> instant generation of PDF bulletins both for the selected station (3D/14D forecasts, basin rainfall, defense thresholds, history) and for the full stations table and active alerts.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Disclaimer */}
      <section className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 rounded-xl px-5 py-3.5 text-sm text-amber-950 dark:text-amber-200">
        <strong>Notă importantă:</strong> Aplicația nu este oficială, dar folosește informații din surse oficiale.
      </section>

      {/* 1. Surse Oficiale de Date */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
          <Database className="w-5 h-5 text-sky-700 dark:text-sky-400 shrink-0" />
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            1. Surse Oficiale de Date Hidrologice și Meteorologice
          </h2>
        </div>

        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          Aplicația nu este oficială, dar folosește exclusiv informații hidrologice și meteorologice din surse oficiale (76 de localități pe întreg cursul Dunării, inclusiv toate cele 26 de porturi din România, de la Baziaș până la Sulina):
        </p>

        <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed list-disc pl-5">
          <li>
            <strong className="text-slate-900 dark:text-slate-100">
              OVF Hydroinfo Danube Exchange
            </strong>{' '}
            (schimbul internațional oficial de date al bazinului Dunării — include cotele zilnice AFDJ Galați / INHGA, RHMZ Serbia, SHMÚ Slovacia, EAEMDR Bulgaria): cotă curentă (cm), variație 24h, debit (m³/s), temperatură apă și regim de gheață.
          </li>
          <li>
            <strong className="text-slate-900 dark:text-slate-100">
              WSV / VIA DONAU Pegelonline REST API v2
            </strong>
            : telemetrie de înaltă frecvență (15 min) și istoric real pe 30 de zile pentru sectorul german și austriac.
          </li>
          <li>
            <strong className="text-slate-900 dark:text-slate-100">
              Copernicus EMS GloFAS v4 (ECMWF)
            </strong>
            : reanaliză zilnică pe 10 ani (2016–2025) pentru calculul mediei anuale multianuale pe 10 ani la fiecare stație și prognoză hidrologică de debit.
          </li>
          <li>
            <strong className="text-slate-900 dark:text-slate-100">
              ECMWF / DWD ICON (Open-Meteo)
            </strong>
            : prognoză pluviometrică zilnică pe 14 zile pentru cele 6 sub-bazine ale Dunării (Bavaria/Alpi, Bazin Pannonic, Drava–Sava–Tisa, Porțile de Fier &amp; Banat, Dunărea Inferioară RO/BG, Delta &amp; Siret–Prut).
          </li>
        </ul>
      </section>

      {/* 2. Funcționalități Principale Implementate */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
          <Layers className="w-5 h-5 text-sky-700 dark:text-sky-400 shrink-0" />
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            2. Funcționalități Principale Implementate
          </h2>
        </div>

        <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-4 h-4 text-sky-700 dark:text-sky-400 mt-1 shrink-0" />
            <p>
              <strong className="text-slate-900 dark:text-slate-100">
                Cotă curentă, Prognoză 3 zile &amp; Prognoză 14 zile pluviometrică:
              </strong>{' '}
              hidrograf interactiv SVG cu citire punctuală, bandă de incertitudine, bare de precipitații pe 14 zile propagate din amonte cu timp de tranzit hidrologic și linii de referință pentru CA / CI / CP și Media 10 Ani.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <BellRing className="w-4 h-4 text-sky-700 dark:text-sky-400 mt-1 shrink-0" />
            <p>
              <strong className="text-slate-900 dark:text-slate-100">
                Alerte Push în Timp Real
              </strong>{' '}
              pentru depășirea cotelor de atenție/inundație/pericol (CA/CI/CP), cu filtre pe localități și butoane de testare imediată a notificărilor push.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-sky-700 dark:text-sky-400 mt-1 shrink-0" />
            <div className="space-y-3">
              <p>
                <strong className="text-slate-900 dark:text-slate-100">
                  Hartă Interactivă &amp; Istoric Detaliat:
                </strong>{' '}
                hartă cu traseul Dunării, markeri cu simboluri distincte pe stări hidrologice, strat de precipitații pe 14 zile, istoric pe 30 de zile și climatologie lunară pe 10 ani.
              </p>

              <div className="pl-3 border-l-2 border-slate-200 dark:border-slate-700 space-y-2.5 text-xs sm:text-sm">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    Hartă Interactivă (OpenStreetMap):
                  </div>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>
                      Toggle pentru afișarea zonelor de precipitații estimate pe 14 zile din cele 6 sub-bazine ale Dunării.
                    </li>
                  </ul>
                </div>

                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    Filtrare &amp; Navigare Rapidă pe Hartă:
                  </div>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>
                      Filtre directe pe sectoare: Tot Bazinul, România, Superior, Mijlociu, Inferior &amp; Deltă (cu centrare automată a hărții).
                    </li>
                    <li>
                      Filtru după stare hidrologică: Toate stările, Alerte Inundație (CA/CI/CP), Sub Media 10 Ani, Regim Nominal.
                    </li>
                    <li>
                      Căutare rapidă pe hartă cu sugestii instantanee și zoom automat, deschiderea popup-ului pe stația selectată.
                    </li>
                  </ul>
                </div>

                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    Acces Complet la Date Direct din Punctele Hărții:
                  </div>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>
                      Click pe orice punct de pe hartă deschide un popup interactiv cu cota curentă (cm), variația 24h, media multianuală pe 10 ani, previziunea pe 3 zile, prognoza pe 2 săptămâni și 3 butoane directe (Istoric, 3 Zile, 14 Zile) care deschid instantaneu graficul corespunzător în panoul de detalii.
                    </li>
                    <li>
                      Sub hartă este afișată o bară sincronizată cu valorile punctului selectat și un mini-grafic al evoluției pe ultimele 30 de zile.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <FileText className="w-4 h-4 text-sky-700 dark:text-sky-400 mt-1 shrink-0" />
            <p>
              <strong className="text-slate-900 dark:text-slate-100">Export PDF:</strong> generare instantanee de buletine PDF atât pentru stația selectată (prognoze 3Z/14Z, pluviometrie, praguri, istoric), cât și pentru întregul tabel de localități și alerte.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
