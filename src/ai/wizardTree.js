// Catalogo & struttura del questionario per l'Assistente AI.
// Solo dati (niente logica).

export const WIZARD_TREE = {
  categories: [
    {
      key: "luce",
      label: "Luce",
      steps: [
        {
          key: "tipoLuce",
          label: "Che tipo di luce?",
          choices: [
            { key: "parete", label: "Lampada a parete" },
            { key: "plafone", label: "Lampada a plafone" },
            { key: "pavimento", label: "Lampada a pavimento" },
            { key: "strisce_led", label: "Strisce LED" },
            { key: "binari", label: "Binari elettrificati" },
            { key: "lampioni", label: "Lampioni esterni" }
          ]
        },
        {
          key: "ambiente",
          label: "Ambiente?",
          choices: [
            { key: "interno", label: "Interno" },
            { key: "esterno", label: "Esterno" }
          ]
        },
        {
          key: "stile",
          label: "Stile/Classe prodotto?",
          choices: [
            { key: "semplice", label: "Semplice" },
            { key: "moderna", label: "Moderna" },
            { key: "design", label: "Design" }
          ]
        },
        {
          key: "quantita",
          label: "Quante unità?",
          type: "number"
        }
      ]
    },

    {
      key: "prese_interruttori",
      label: "Prese / Interruttori",
      steps: [
        {
          key: "tipoPunto",
          label: "Cosa serve?",
          choices: [
            { key: "presa_schuko", label: "Presa Schuko" },
            { key: "interruttore", label: "Interruttore" },
            { key: "dimmer", label: "Dimmer luce" }
          ]
        },
        {
          key: "quantita",
          label: "Quante unità?",
          type: "number"
        }
      ]
    },

    {
      key: "wallbox",
      label: "Wallbox",
      steps: [
        {
          key: "potenza",
          label: "Potenza wallbox?",
          choices: [
            { key: "11", label: "11 kW" },
            { key: "22", label: "22 kW" }
          ]
        },
        {
          key: "tipoWB",
          label: "Tipo punto di ricarica?",
          choices: [
            { key: "presa", label: "Presa semplice" },
            { key: "standard", label: "Wallbox standard" },
            { key: "smart", label: "Wallbox smart" }
          ]
        },
        {
          key: "distanza",
          label: "Distanza dal quadro (stimata)",
          choices: [
            { key: "0-5", label: "0–5 m" },
            { key: "5-10", label: "5–10 m" },
            { key: "10-25", label: "10–25 m" },
            { key: "25-50", label: "25–50 m" }
          ]
        },
        {
          key: "quantita",
          label: "Quanti punti?",
          type: "number"
        }
      ]
    },

    {
      key: "telefonia",
      label: "Telefonia / Internet",
      steps: [
        {
          key: "tipo",
          label: "Cosa serve?",
          choices: [
            { key: "presa_rj45", label: "Presa dati RJ45" },
            { key: "access_point", label: "Access Point" }
          ]
        },
        { key: "quantita", label: "Quante unità?", type: "number" }
      ]
    },

    {
      key: "videosorveglianza",
      label: "Videosorveglianza / Sicurezza",
      steps: [
        {
          key: "tipo",
          label: "Cosa serve?",
          choices: [
            { key: "telecamera", label: "Telecamera" },
            { key: "videocitofono", label: "Videocitofono" }
          ]
        },
        { key: "quantita", label: "Quante unità?", type: "number" }
      ]
    },

    {
      key: "domotica",
      label: "Domotica",
      steps: [
        {
          key: "tipo",
          label: "Cosa serve?",
          choices: [
            { key: "modulo_rele", label: "Modulo relè smart" },
            { key: "hub_domotico", label: "Hub domotico" }
          ]
        },
        { key: "quantita", label: "Quante unità?", type: "number" }
      ]
    },

    {
      key: "riparazioni",
      label: "Riparazioni",
      steps: [
        {
          key: "tipo",
          label: "Area intervento?",
          choices: [
            { key: "corto_circuito", label: "Ricerca guasto/CC" },
            { key: "ripristino_linea", label: "Ripristino linea" }
          ]
        },
        { key: "quantita", label: "Numero attività", type: "number" }
      ]
    },

    {
      key: "altro",
      label: "Altro",
      steps: [
        { key: "descrizione", label: "Descrivi la richiesta", type: "text" },
        { key: "quantita", label: "Quante unità?", type: "number" }
      ]
    }
  ]
};

export default WIZARD_TREE;
