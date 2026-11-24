import React from 'react';
import { BellRing, Database, FileText, Layers, MapPin, TrendingUp } from 'lucide-react';

export const AboutView: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* 1. Surse Oficiale de Date */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
          <Database className="w-5 h-5 text-sky-700 dark:text-sky-400 shrink-0" />
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            1. Surse Oficiale de Date Hidrologice și Meteorologice
          </h2>
        </div>

        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          Sunt utilizate exclusiv date hidrologice și meteorologice oficiale (76 de localități pe întreg cursul Dunării, inclusiv toate cele 26 de porturi oficiale din România, de la Baziaș până la Sulina):
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
