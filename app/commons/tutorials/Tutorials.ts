import type { Locale } from "../i18n/Locale";

export const TUTORIALS_PATH = "/app/tutorials";

/** Where AWBs are booked by hand, e.g. with cash on delivery. */
export const OPTIMUS_WEBSITE_URL = "https://awb.optimuscourier.ro/home/";

/** A step, or a step with a few bullet points under it. */
export type TutorialStep = string | { text: string; bullets: string[] };

export type Tutorial = {
  /** Anchor on the page, e.g. `#extra-label`. */
  id: string;
  title: string;
  /** When to follow it, one short sentence. */
  when: string;
  steps: TutorialStep[];
  /** "Good to know", shown under the steps. */
  notes?: string[];
  /** Not written yet: the page shows it as in progress, without steps. */
  inProgress?: boolean;
};

/** Shopify admin buttons and fields the tutorials name. */
type ShopifyLabels = {
  fulfilledCard: string;
  cancelFulfillment: string;
  fulfillItems: string;
  trackingNumber: string;
  shippingCarrier: string;
  editTracking: string;
  save: string;
  markAsPickedUp: string;
};

/**
 * Shopify's names, in the language the admin uses Shopify in (the same one
 * TrackMe follows).
 *
 * TODO: the Romanian names still need to be copied from the Romanian Shopify
 * admin; until then they are the English ones.
 */
const SHOPIFY_LABELS: Record<Locale, ShopifyLabels> = {
  en: {
    fulfilledCard: "Fulfilled",
    cancelFulfillment: "Cancel fulfillment",
    fulfillItems: "Fulfill items",
    trackingNumber: "Tracking number",
    shippingCarrier: "Shipping carrier",
    editTracking: "Edit tracking",
    save: "Save",
    markAsPickedUp: "Mark as picked up",
  },
  ro: {
    fulfilledCard: "Fulfilled",
    cancelFulfillment: "Cancel fulfillment",
    fulfillItems: "Fulfill items",
    trackingNumber: "Tracking number",
    shippingCarrier: "Shipping carrier",
    editTracking: "Edit tracking",
    save: "Save",
    markAsPickedUp: "Mark as picked up",
  },
};

const ro = SHOPIFY_LABELS.ro;
const en = SHOPIFY_LABELS.en;

/**
 * The admin's how-tos, step by step, in plain words, in the admin's language.
 * Button names are written exactly as they appear: TrackMe's from its
 * translations, Shopify's from `SHOPIFY_LABELS`. Links in the text are made
 * clickable by the page.
 */
export const TUTORIALS: Record<Locale, Tutorial[]> = {
  ro: [
    {
      id: "pack",
      title: "Începi să lucrezi la un pachet de comenzi",
      when: "În fiecare zi de livrare. Pașii sunt în ordinea în care se fac.",
      steps: [
        "Deschide Pachete. Pachetul „Se umple” strânge singur comenzile noi.",
        "Pe pachet, apasă „Începe lucrul”. Comenzile care vin de acum intră într-un pachet nou.",
        "Apasă „Raport produse neexecutate”. Descarcă PDF-ul și pregătește produsele.",
        {
          text: "Deschide pachetul. Tab-ul „Neexecutate” → bifează tot → „Adaugă numere de tracking”.",
          bullets: [
            "Dacă apare „Verifică întâi aceste comenzi”, uită-te la fiecare și alege care primesc tracking.",
            "Sarcina merge în fundal. O vezi la „Sarcini recente”.",
            "Când e gata, descarcă raportul și citește erorile.",
          ],
        },
        "Dacă tab-ul „Cod poștal de corectat” are comenzi: corectează codurile, apoi adaugă din nou tracking pentru ele.",
        {
          text: "Tab-ul „Neprintate” → bifează tot → „Printează etichete”.",
          bullets: [
            "Din „Sarcini recente” descarcă arhiva.",
            "Printează PDF-ul cu etichete. Etichetele de ridicare personală sunt tot aici.",
          ],
        },
        {
          text: "Poți descărca și „Raport produse vândute”.",
          bullets: [
            "Folosește-l mai ales dacă ai uitat să descarci „Raport produse neexecutate” la început.",
            "După ce primesc tracking, comenzile sunt executate și nu mai apar în raportul de neexecutate.",
            "Raportul de vândute arată în continuare toate produsele din pachet, executate sau nu.",
          ],
        },
        "Lipește etichetele pe colete și predă coletele curierului.",
        `Ridicare personală: când vine clientul, marchează comanda ridicată în Shopify („${ro.markAsPickedUp}”).`,
        {
          text: "Când pachetul arată „Toate cele … sunt gata”, apasă „Închide pachetul”.",
          bullets: [
            "Au rămas comenzi și vrei totuși să închizi? „Închide și mută cele … rămase” le trece în pachetul următor.",
          ],
        },
      ],
      notes: [
        "O comandă e gata când e anulată, sau executată și cu eticheta printată.",
        "Ridicarea personală e gata când e marcată ridicată.",
        "Shopify vede tag-urile noi după câteva secunde. Dacă o comandă nu apare încă într-un tab, reîncarcă pagina.",
      ],
    },
    {
      id: "extra-label",
      title: "O comandă are nevoie de încă o etichetă",
      when: "Comanda are deja AWB, dar nu încape într-un singur colet.",
      steps: [
        `Deschide comanda în Shopify. Copiază AWB-ul de pe cardul „${ro.fulfilledCard}”.`,
        `Pe același card: „⋯” → „${ro.cancelFulfillment}”. Articolele redevin neexecutate.`,
        {
          text: `Apasă „${ro.fulfillItems}”.`,
          bullets: [
            "Lasă doar cantitățile din primul colet.",
            `La „${ro.trackingNumber}” pune AWB-ul copiat.`,
            `La „${ro.shippingCarrier}” alege GLS din listă.`,
            "Debifează notificarea către client: clientul are deja AWB-ul.",
            `Apasă „${ro.fulfillItems}”.`,
          ],
        },
        "În TrackMe, în pachet, tab-ul „Toate”: bifează comanda → „Adaugă numere de tracking”. Restul articolelor primesc un AWB nou.",
        "Bifează din nou comanda → „Printează etichete”. PDF-ul are ambele etichete: pune-o doar pe cea nouă, pe al doilea colet.",
      ],
      notes: [
        "În Raport AWB, AWB-ul vechi apare puțin timp la anulate, apoi revine la folosite. E normal.",
      ],
    },
    {
      id: "deliver-ourselves",
      title: "Livrăm noi o comandă care are deja AWB",
      when: "Eticheta e făcută, dar coletul nu mai pleacă prin curier.",
      steps: [
        "Deschide comanda în Shopify.",
        `Pe cardul „${ro.fulfilledCard}”: „${ro.editTracking}”.`,
        "Șterge numărul de tracking. Lasă câmpul gol.",
        `Debifează notificarea către client. Apasă „${ro.save}”.`,
        "Comanda rămâne executată. În Raport AWB, AWB-ul trece la anulate („Tracking-ul a fost șters în Shopify”).",
        "Nu da curierului coletul cu eticheta aceea. Dacă e lipită, scoate-o.",
      ],
      notes: [
        "Optimus nu facturează un AWB pe care curierul nu l-a scanat. Nu trebuie anulat nimic la Optimus.",
      ],
    },
    {
      id: "optimus-website",
      title: "Faci eticheta direct pe site-ul Optimus",
      when: "Când îți trebuie ceva ce TrackMe nu știe încă, de exemplu plata ramburs.",
      steps: [
        `Intră pe ${OPTIMUS_WEBSITE_URL} și fă AWB-ul.`,
        "Copiază numărul AWB. Printează eticheta de acolo.",
        {
          text: `În Shopify, deschide comanda → „${ro.fulfillItems}”.`,
          bullets: [
            `La „${ro.trackingNumber}” lipește AWB-ul.`,
            `La „${ro.shippingCarrier}” alege GLS din listă. Altfel AWB-ul apare la „Curier nerecunoscut”.`,
            `Apasă „${ro.fulfillItems}”.`,
          ],
        },
        "Nu folosi „Adaugă numere de tracking” din TrackMe pentru comanda asta: ar face încă un AWB.",
      ],
      notes: [
        "AWB-ul apare singur în Raport AWB, la folosite, cu sursa „Shopify”.",
      ],
    },
    {
      id: "monthly-bill",
      title: "Verifici factura Optimus la sfârșit de lună",
      when: "În lucru. Va fi definitivat ulterior.",
      inProgress: true,
      steps: [],
    },
  ],
  en: [
    {
      id: "pack",
      title: "Start working on a pack of orders",
      when: "Every delivery day. The steps are in the order you do them.",
      steps: [
        'Open Packs. The "Filling" pack collects new orders by itself.',
        'On the pack, press "Start working". Orders that arrive from now on go to a new pack.',
        'Press "Unfulfilled items report". Download the PDF and prepare the products.',
        {
          text: 'Open the pack. "Pending fulfillment" tab → select all → "Add tracking numbers".',
          bullets: [
            'If "Check these orders first" appears, look at each one and choose which get tracking.',
            'The job runs in the background. You\'ll see it under "Recent jobs".',
            "When it's done, download the report and read the errors.",
          ],
        },
        'If the "ZIP to fix" tab has orders: fix the ZIP codes, then add tracking for them again.',
        {
          text: '"Unprinted" tab → select all → "Print labels".',
          bullets: [
            'Download the archive from "Recent jobs".',
            "Print the labels PDF. The pickup labels are in it too.",
          ],
        },
        {
          text: 'You can also download the "Sold products report".',
          bullets: [
            'Use it especially if you forgot to download the "Unfulfilled items report" at the start.',
            "Once they get tracking, orders are fulfilled and drop out of the unfulfilled report.",
            "The sold report still shows every product in the pack, fulfilled or not.",
          ],
        },
        "Stick the labels on the parcels and hand them to the courier.",
        `Pickup orders: when the customer comes, mark the order as picked up in Shopify ("${en.markAsPickedUp}").`,
        {
          text: 'When the pack shows "All … done", press "Close pack".',
          bullets: [
            'Orders left and you still want to close? "Close and move … left" moves them to the next pack.',
          ],
        },
      ],
      notes: [
        "An order is done when it is cancelled, or fulfilled with its label printed.",
        "A pickup order is done once it is marked as picked up.",
        "Shopify sees new tags a few seconds late. If an order isn't in a tab yet, reload the page.",
      ],
    },
    {
      id: "extra-label",
      title: "An order needs one more label",
      when: "The order already has an AWB, but it doesn't fit in one parcel.",
      steps: [
        `Open the order in Shopify. Copy the AWB from the "${en.fulfilledCard}" card.`,
        `On the same card: "⋯" → "${en.cancelFulfillment}". The items are unfulfilled again.`,
        {
          text: `Press "${en.fulfillItems}".`,
          bullets: [
            "Keep only the quantities of the first parcel.",
            `Under "${en.trackingNumber}", enter the copied AWB.`,
            `Under "${en.shippingCarrier}", pick GLS from the list.`,
            "Untick the customer notification: they already have the AWB.",
            `Press "${en.fulfillItems}".`,
          ],
        },
        'In TrackMe, in the pack, "All" tab: select the order → "Add tracking numbers". The remaining items get a new AWB.',
        'Select the order again → "Print labels". The PDF has both labels: use only the new one, on the second parcel.',
      ],
      notes: [
        "In the AWB report, the old AWB shows as cancelled for a moment, then goes back to used. That's expected.",
      ],
    },
    {
      id: "deliver-ourselves",
      title: "We deliver an order that already has an AWB",
      when: "The label is made, but the parcel no longer goes with the courier.",
      steps: [
        "Open the order in Shopify.",
        `On the "${en.fulfilledCard}" card: "${en.editTracking}".`,
        "Delete the tracking number. Leave the field empty.",
        `Untick the customer notification. Press "${en.save}".`,
        'The order stays fulfilled. In the AWB report, the AWB moves to cancelled ("Tracking removed in Shopify").',
        "Don't give the courier the parcel with that label. If it's stuck on, remove it.",
      ],
      notes: [
        "Optimus doesn't bill an AWB the courier never scanned. Nothing needs cancelling at Optimus.",
      ],
    },
    {
      id: "optimus-website",
      title: "Make the label on the Optimus website",
      when: "When you need something TrackMe can't do yet, such as cash on delivery.",
      steps: [
        `Go to ${OPTIMUS_WEBSITE_URL} and make the AWB.`,
        "Copy the AWB number. Print the label from there.",
        {
          text: `In Shopify, open the order → "${en.fulfillItems}".`,
          bullets: [
            `Under "${en.trackingNumber}", paste the AWB.`,
            `Under "${en.shippingCarrier}", pick GLS from the list. Otherwise the AWB shows under "Unrecognised courier".`,
            `Press "${en.fulfillItems}".`,
          ],
        },
        "Don't use TrackMe's \"Add tracking numbers\" for this order: it would make a second AWB.",
      ],
      notes: [
        'The AWB shows up in the AWB report by itself, as used, with source "Shopify".',
      ],
    },
    {
      id: "monthly-bill",
      title: "Check the Optimus bill at the end of the month",
      when: "In progress. It will be finished later.",
      inProgress: true,
      steps: [],
    },
  ],
};
