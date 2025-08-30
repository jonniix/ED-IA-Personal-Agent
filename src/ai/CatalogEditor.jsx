import React from "react";

/**
 * CatalogEditor
 * - value: oggetto aiCatalog (può contenere numeri o stringhe, gestiamo entrambi)
 * - onChange: (nextObj) => void
 * - disabled: boolean (sezione protetta)
 *
 * Editor minimale, ma copre:
 *  - luce (tutte le varianti, con tiers semplice/moderna/design e contextAddons interno/esterno)
 *  - prese_interruttori (unità base)
 *  - wallbox (potenze 11/22, materiali per tipo e distanceBand)
 *  - telefonia, videosorveglianza, domotica, riparazioni, altro (base)
 */

export default function CatalogEditor({ value, onChange, disabled = false }) {
  const catalog = value || {};

  // Deep setter immutabile su path ("a.b.c")
  const setVal = (path, newVal) => {
    const next = JSON.parse(JSON.stringify(catalog));
    const segs = path.split(".");
    let cur = next;
    for (let i = 0; i < segs.length - 1; i++) {
      const k = segs[i];
      if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {};
      cur = cur[k];
    }
    cur[segs[segs.length - 1]] = newVal;
    onChange(next);
  };

  // helper: stringify se numero, altrimenti lascia
  const asStr = (v) => (typeof v === "number" ? String(v) : (v ?? ""));

  const Section = ({ title, children }) => (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</div>
      <div className="grid gap-4">{children}</div>
    </div>
  );

  const Row = ({ label, children }) => (
    <div className="grid gap-2 md:grid-cols-3 items-center">
      <div className="text-sm text-zinc-600 dark:text-zinc-400">{label}</div>
      <div className="md:col-span-2">{children}</div>
    </div>
  );

  const NumInput = ({ path, value, placeholder }) => (
    <input
      disabled={disabled}
      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-zinc-400 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700 dark:bg-zinc-950"
      inputMode="decimal"
      value={asStr(value)}
      placeholder={placeholder}
      onChange={(e) => {
        const v = e.target.value.replace(/[^0-9.,-]/g, "");
        setVal(path, v);
      }}
    />
  );

  // --- LUCE ---
  const luce = catalog.luce || {};
  const luceKeys = ["parete", "plafone", "pavimento", "strisce_led", "binari", "lampioni"];

  // --- PRESE/INTERRUTTORI ---
  const pi = catalog.prese_interruttori || {};
  const piKeys = ["presa_schuko", "interruttore", "dimmer"];

  // --- WALLBOX ---
  const wb = catalog.wallbox || {};
  const wbPowers = ["11", "22"];
  const wbTypeKeys = ["presa", "standard", "smart"];
  const wbBands = ["0-5", "5-10", "10-25", "25-50"];

  // --- SEMPLICI (resto) ---
  const telefonia = catalog.telefonia || {};
  const videosorveglianza = catalog.videosorveglianza || {};
  const domotica = catalog.domotica || {};
  const riparazioni = catalog.riparazioni || {};
  const altro = catalog.altro || {};

  return (
    <div className="grid gap-4">
      {/* LUCE */}
      <Section title="Luce">
        {luceKeys.map((k) => {
          const item = luce[k] || {};
          const ctx = item.contextAddons || {};
          const materials = item.materials || {};
          return (
            <div key={k} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="mb-2 text-sm font-semibold">{item.label || k}</div>
              <Row label="Minuti squadra (per unità)">
                <NumInput path={`luce.${k}.minutesTeamPerUnit`} value={item.minutesTeamPerUnit} />
              </Row>

              {/* Tiers materiali */}
              <div className="mt-2">
                <div className="text-xs font-semibold text-zinc-500 mb-1">Materiali (CHF / unità)</div>
                <div className="grid gap-3 md:grid-cols-3">
                  {Object.entries(materials).map(([tierKey, tier]) => (
                    <div key={tierKey} className="rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
                      <div className="text-sm mb-1">{tier.label || tierKey}</div>
                      <NumInput
                        path={`luce.${k}.materials.${tierKey}.unitCHF`}
                        value={tier.unitCHF}
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Context addons */}
              <div className="mt-2">
                <div className="text-xs font-semibold text-zinc-500 mb-1">Add-on contesto</div>
                <div className="grid gap-3 md:grid-cols-2">
                  {["interno", "esterno"].map((ctxKey) => {
                    const cc = ctx[ctxKey] || {};
                    return (
                      <div key={ctxKey} className="rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
                        <div className="text-sm mb-1 capitalize">{ctxKey}</div>
                        <Row label="Extra minuti">
                          <NumInput
                            path={`luce.${k}.contextAddons.${ctxKey}.extraMinutes`}
                            value={cc.extraMinutes}
                          />
                        </Row>
                        <Row label="Extra CHF">
                          <NumInput
                            path={`luce.${k}.contextAddons.${ctxKey}.extraCHF`}
                            value={cc.extraCHF}
                          />
                        </Row>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </Section>

      {/* PRESE/INTERRUTTORI */}
      <Section title="Prese / Interruttori">
        <div className="grid gap-3">
          {piKeys.map((k) => {
            const item = pi[k] || {};
            const materials = item.materials || {};
            return (
              <div key={k} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="text-sm font-semibold mb-1">{item.label || k}</div>
                <Row label="Minuti squadra (per unità)">
                  <NumInput path={`prese_interruttori.${k}.minutesTeamPerUnit`} value={item.minutesTeamPerUnit} />
                </Row>
                <Row label="Materiale (base)">
                  <NumInput
                    path={`prese_interruttori.${k}.materials.base.unitCHF`}
                    value={materials.base?.unitCHF}
                  />
                </Row>
              </div>
            );
          })}
        </div>
      </Section>

      {/* WALLBOX */}
      <Section title="Wallbox">
        <div className="grid gap-4 md:grid-cols-2">
          {wbPowers.map((pwr) => {
            const node = wb[pwr] || {};
            const mats = node.materials || {};
            const bands = node.distanceBandCHF || {};
            return (
              <div key={pwr} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="text-sm font-semibold mb-1">{node.label || `Wallbox ${pwr} kW`}</div>
                <Row label="Minuti squadra (per unità)">
                  <NumInput path={`wallbox.${pwr}.minutesTeamPerUnit`} value={node.minutesTeamPerUnit} />
                </Row>

                <div className="mt-2">
                  <div className="text-xs font-semibold text-zinc-500 mb-1">Materiale (CHF / tipo)</div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {wbTypeKeys.map((tKey) => (
                      <div key={tKey} className="rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
                        <div className="text-sm mb-1 capitalize">{tKey}</div>
                        <NumInput
                          path={`wallbox.${pwr}.materials.${tKey}.unitCHF`}
                          value={mats[tKey]?.unitCHF}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-2">
                  <div className="text-xs font-semibold text-zinc-500 mb-1">Installazione per distanza (CHF)</div>
                  <div className="grid gap-3 md:grid-cols-4">
                    {wbBands.map((bKey) => (
                      <div key={bKey} className="rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
                        <div className="text-sm mb-1">{bKey} m</div>
                        <NumInput
                          path={`wallbox.${pwr}.distanceBandCHF.${bKey}`}
                          value={bands[bKey]}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* TELEFONIA */}
      <Section title="Telefonia / Internet">
        {Object.entries(telefonia).map(([k, item]) => (
          <div key={k} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="text-sm font-semibold mb-1">{item.label || k}</div>
            <Row label="Minuti squadra (per unità)">
              <NumInput path={`telefonia.${k}.minutesTeamPerUnit`} value={item.minutesTeamPerUnit} />
            </Row>
            <Row label="Materiale (base)">
              <NumInput path={`telefonia.${k}.materials.base.unitCHF`} value={item.materials?.base?.unitCHF} />
            </Row>
          </div>
        ))}
      </Section>

      {/* VIDEOSORVEGLIANZA */}
      <Section title="Videosorveglianza / Sicurezza">
        {Object.entries(videosorveglianza).map(([k, item]) => (
          <div key={k} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="text-sm font-semibold mb-1">{item.label || k}</div>
            <Row label="Minuti squadra (per unità)">
              <NumInput path={`videosorveglianza.${k}.minutesTeamPerUnit`} value={item.minutesTeamPerUnit} />
            </Row>
            <Row label="Materiale (base)">
              <NumInput path={`videosorveglianza.${k}.materials.base.unitCHF`} value={item.materials?.base?.unitCHF} />
            </Row>
          </div>
        ))}
      </Section>

      {/* DOMOTICA */}
      <Section title="Domotica">
        {Object.entries(domotica).map(([k, item]) => (
          <div key={k} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="text-sm font-semibold mb-1">{item.label || k}</div>
            <Row label="Minuti squadra (per unità)">
              <NumInput path={`domotica.${k}.minutesTeamPerUnit`} value={item.minutesTeamPerUnit} />
            </Row>
            <Row label="Materiale (base)">
              <NumInput path={`domotica.${k}.materials.base.unitCHF`} value={item.materials?.base?.unitCHF} />
            </Row>
          </div>
        ))}
      </Section>

      {/* RIPARAZIONI */}
      <Section title="Riparazioni">
        {Object.entries(riparazioni).map(([k, item]) => (
          <div key={k} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="text-sm font-semibold mb-1">{item.label || k}</div>
            <Row label="Minuti squadra (per unità)">
              <NumInput path={`riparazioni.${k}.minutesTeamPerUnit`} value={item.minutesTeamPerUnit} />
            </Row>
            <Row label="Materiale (base)">
              <NumInput path={`riparazioni.${k}.materials.base.unitCHF`} value={item.materials?.base?.unitCHF} />
            </Row>
          </div>
        ))}
      </Section>

      {/* ALTRO */}
      <Section title="Altro">
        {Object.entries(altro).map(([k, item]) => (
          <div key={k} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="text-sm font-semibold mb-1">{item.label || k}</div>
            <Row label="Minuti squadra (per unità)">
              <NumInput path={`altro.${k}.minutesTeamPerUnit`} value={item.minutesTeamPerUnit} />
            </Row>
            <Row label="Materiale (base)">
              <NumInput path={`altro.${k}.materials.base.unitCHF`} value={item.materials?.base?.unitCHF} />
            </Row>
          </div>
        ))}
      </Section>
    </div>
  );
}
