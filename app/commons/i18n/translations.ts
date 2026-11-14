/**
 * Every text the app shows, in English and Romanian.
 *
 * `{name}` is replaced by the param of that name. An entry with plural forms
 * is picked by the `count` param, using the language's plural rules
 * (Romanian: one = 1, few = 0 and 2–19, other = 20 and up, "de comenzi").
 * A missing form falls back to `other`.
 */
export type PluralForms = { one?: string; few?: string; other: string };
export type TranslationEntry = string | PluralForms;

export const en = {
  // navigation
  "nav.orders": "Orders",
  "nav.unfulfilledReport": "Unfulfilled report",
  "nav.adminPanel": "Admin Panel",

  // landing page
  "landing.welcome": "Welcome to TrackMe!",
  "landing.intro":
    "This app helps you manage your orders in just a few clicks.",
  "landing.featureZip": "Solve missing ZIP codes automatically",
  "landing.featureTracking": "Add tracking numbers in bulk",
  "landing.featureLabels": "Download and print shipping labels",
  "landing.openDashboard": "Open Orders Dashboard",

  // dashboard tabs
  "filter.all": "All",
  "filter.pending_fulfillment": "Pending fulfillment",
  "filter.unprinted": "Unprinted",

  // job names
  "job.solve-zip": "Solve ZIP codes",
  "job.add-tracking": "Add tracking numbers",
  "job.print-labels": "Print labels",
  "job.test": "Test upload",

  // dashboard
  "dashboard.starting": "Starting...",
  "dashboard.dismiss": "Dismiss",
  "dashboard.jobStarted": {
    one: "{title} started for {count} order. When it finishes, the list refreshes and the result appears under Recent jobs.",
    other:
      "{title} started for {count} orders. When it finishes, the list refreshes and the result appears under Recent jobs.",
  },
  "dashboard.jobFinished": "{title} finished: {details}",
  "dashboard.jobFailed": "{title} failed: {details}",
  "dashboard.listRefreshed":
    "The list was refreshed and the selection cleared.",
  "dashboard.allInTabSelected": 'All {count} orders in "{tab}" selected',
  "dashboard.selectedCount": "{count} selected",
  "dashboard.tabTooLarge":
    "{count} orders in this tab, more than one job takes ({max})",
  "dashboard.selectAllInTab": "Select all {count} orders in this tab",
  "dashboard.deselectAll": "Deselect all",
  "dashboard.httpError": "The server answered with HTTP {status}.",

  // orders table
  "table.selectAllVisible": "Select all visible orders",
  "table.selectOrder": "Select order {name}",
  "table.order": "Order",
  "table.date": "Date",
  "table.customer": "Customer",
  "table.total": "Total",
  "table.paymentStatus": "Payment status",
  "table.fulfillmentStatus": "Fulfillment status",
  "table.items": "Items",
  "table.deliveryMethod": "Delivery method",
  "table.zipCode": "ZIP code",
  "table.noOrders": "No orders found.",
  "table.itemCount": { one: "{count} item", other: "{count} items" },
  "table.missingZip": "Missing",

  // Shopify payment statuses
  "financialStatus.AUTHORIZED": "Authorized",
  "financialStatus.EXPIRED": "Expired",
  "financialStatus.PAID": "Paid",
  "financialStatus.PARTIALLY_PAID": "Partially paid",
  "financialStatus.PARTIALLY_REFUNDED": "Partially refunded",
  "financialStatus.PENDING": "Pending",
  "financialStatus.REFUNDED": "Refunded",
  "financialStatus.VOIDED": "Voided",

  // Shopify fulfillment statuses
  "fulfillmentStatus.FULFILLED": "Fulfilled",
  "fulfillmentStatus.IN_PROGRESS": "In progress",
  "fulfillmentStatus.ON_HOLD": "On hold",
  "fulfillmentStatus.OPEN": "Open",
  "fulfillmentStatus.PARTIALLY_FULFILLED": "Partially fulfilled",
  "fulfillmentStatus.PENDING_FULFILLMENT": "Pending fulfillment",
  "fulfillmentStatus.REQUEST_DECLINED": "Request declined",
  "fulfillmentStatus.RESTOCKED": "Restocked",
  "fulfillmentStatus.SCHEDULED": "Scheduled",
  "fulfillmentStatus.UNFULFILLED": "Unfulfilled",

  // Shopify delivery methods
  "deliveryMethod.LOCAL": "Local",
  "deliveryMethod.NONE": "None",
  "deliveryMethod.PICK_UP": "Pick up",
  "deliveryMethod.PICKUP_POINT": "Pickup point",
  "deliveryMethod.RETAIL": "Retail",
  "deliveryMethod.SHIPPING": "Shipping",

  // pagination
  "pagination.previous": "Previous",
  "pagination.next": "Next",
  "pagination.page": "Page {current}",
  "pagination.pageOf": "Page {current} of {total}",
  "pagination.noOrders": "No orders",
  "pagination.showingOnPage": "Showing {range} ({shown} on this page)",
  "pagination.showingOf": "Showing {range} of {total} orders",

  // recent jobs
  "jobs.heading": "Recent jobs",
  "jobs.linksExpire":
    "Download links work for 1 hour. Press Refresh for new ones.",
  "jobs.autoUpdates": "This list updates on its own while a job runs.",
  "jobs.refresh": "Refresh",
  "jobs.empty": "No jobs since the app last started.",
  "jobs.colJob": "Job",
  "jobs.colOrders": "Orders",
  "jobs.colStarted": "Started",
  "jobs.colStatus": "Status",
  "jobs.colResult": "Result",
  "jobs.status.running": "⏳ Running",
  "jobs.status.succeeded": "✅ Done",
  "jobs.status.failed": "❌ Failed",
  "jobs.withErrors": "(with errors)",
  "jobs.downloadErrorFile": "Download error file",
  "jobs.downloadFile": "Download {fileName}",
  "jobs.defaultFileName": "file",

  // job summaries (one line in Recent jobs)
  "summary.succeeded": "{count} succeeded",
  "summary.failed": "{count} failed",
  "summary.skipped": "{count} skipped",
  "summary.noneProcessed": "No orders processed",
  "summary.labels": "{labels} labels for {count} orders",
  "summary.ordersFailed": "{count} orders failed",
  "summary.notMarkedPrinted": "{count} orders not marked as printed",
  "summary.seeErrorsFile": "see {fileName}",
  "summary.testFileUploaded": "Test file uploaded",

  // errors when starting a job
  "startJob.ordersBusy":
    "{count} of these orders are already in a running job. Wait for it to finish, then try again.",
  "startJob.couldNotStart": "Could not start the job: {error}",
  "startJob.invalidOrderIds": "Invalid order IDs: {ids}.",
  "startJob.noOrdersSelected": "No orders were selected.",
  "startJob.noOrdersInTab": 'No orders match the "{tab}" tab.',
  "startJob.tooManyOrders":
    "A job can take at most {max} orders. This selection has more.",

  // admin panel
  "admin.heading": "Admin Panel",
  "admin.credentialsHeading": "Optimus test credentials",
  "admin.credentialsIntro":
    "These values are loaded from environment variables. The API key is masked for safety.",
  "admin.apiUrl": "API URL",
  "admin.username": "Username",
  "admin.apiKey": "API Key",
  "admin.testRequestHeading": "Test request",
  "admin.testRequestIntro":
    "This sends a server-side test request to Optimus using test credentials and a mocked AWB-style payload.",
  "admin.sendTestRequest": "Send test request",
  "admin.responseOutput": "Response output",
  "admin.noRequestYet":
    "No request sent yet.\n\nThe Optimus response will be displayed here after you send a test request.",
  "admin.optimusTestCompleted": "Optimus test request completed",
  "admin.optimusTestFailed": "Optimus test request failed",
  "admin.unknownOptimusError": "Unknown Optimus test error.",
  "admin.s3Heading": "Bulk jobs: S3 setup",
  "admin.s3Intro":
    "Bulk actions store their result files in S3. Every variable below must be set for them to work.",
  "admin.s3Bucket": "S3 bucket",
  "admin.awsRegion": "AWS region",
  "admin.appFolder": "This app's folder in the bucket",
  "admin.notSet": "(not set)",
  "admin.bucketRoot": "(bucket root)",
  "admin.openAppFolder": "Open this app's folder in the S3 console",
  "admin.s3TestIntro":
    "The test uploads a small text file. It then appears under Recent jobs with a link to it in S3.",
  "admin.uploadTestFile": "Upload test file",
  "admin.testUploadStarted": "Test upload started",
  "admin.testUploadCouldNotStart": "Test upload could not start",
  "admin.testUploadStartedDetails":
    "Test upload started. Press Refresh under Recent jobs in a few seconds.",
  "admin.testUploadAlreadyRunning": "A test upload is already running.",
  "admin.unknownTestUploadError": "Unknown test upload error.",

  // unfulfilled report (page and PDF)
  "report.heading": "Unfulfilled orders report",
  "report.intro":
    "Products still to be fulfilled, added up per variant. Every unfulfilled order is included unless you set an order number interval.",
  "report.intervalHeading": "Order interval",
  "report.fromOrder": "From order no.",
  "report.toOrder": "To order no.",
  "report.intervalHint": "Leave empty for all unfulfilled orders.",
  "report.apply": "Apply",
  "report.showAll": "Show all",
  "report.refresh": "Refresh",
  "report.downloadPdf": "Download PDF",
  "report.loading":
    "Collecting unfulfilled orders. With many orders this can take up to a minute.",
  "report.invalidNumber": "Enter a whole order number, e.g. 1250.",
  "report.invalidInterval":
    "The first order number must not be greater than the last one.",
  "report.scopeAll": "All unfulfilled orders",
  "report.scopeBetween": "Orders #{from} – #{to}",
  "report.scopeFrom": "Orders from #{from}",
  "report.scopeTo": "Orders up to #{to}",
  "report.generatedAt": "Generated {date}",
  "report.orderCount": { one: "{count} order", other: "{count} orders" },
  "report.delivery": "Delivery",
  "report.pickup": "Pickup",
  "report.sectionContinued": "{section} (cont.)",
  "report.product": "Product",
  "report.quantity": "Quantity",
  "report.total": "Total",
  "report.orders": "Orders ({count})",
  "report.ordersContinued": "Orders (cont.)",
  "report.noOrders": "No unfulfilled orders.",
  "report.loadFailed": "Could not load the report: {error}",
  "report.pdfFailed": "Could not create the PDF: {error}",
  "report.bulkBusy":
    "Shopify is still busy with another export for this app. Try again in a minute.",
  "report.bulkNotEnabled":
    'This app is not allowed to run bulk queries yet. In the Partner Dashboard, open Apps → TrackMe → API access requests and click "Allow bulk queries" under "Run bulk operations". Shopify turns it off again after 31 days without a bulk query.',
  "report.timedOut":
    "Shopify took too long to collect the orders. Try again in a minute.",

  // shipping and pickup labels PDF
  "labelsPdf.totalsTitle": "Label totals",
  "labelsPdf.deliveryLabels": "Delivery labels",
  "labelsPdf.pickupLabels": "Pickup labels",
  "labelsPdf.totalLabels": "Total labels",
  "labelsPdf.orders": "Orders ({count})",
  "labelsPdf.ordersContinued": "Orders (cont.)",
  "labelsPdf.groupTitle": "{labels} -> {productTypes}",
  "labelsPdf.labelCount": { one: "{count} label", other: "{count} labels" },
  "labelsPdf.productTypeCount": {
    one: "{count} product type",
    other: "{count} product types",
  },
  "pickupLabel.title": "PICKUP LABEL",
  "pickupLabel.order": "Order: {value}",
  "pickupLabel.confirmationNumber": "Confirmation number: {value}",
  "pickupLabel.name": "Name: {value}",
  "pickupLabel.orderDate": "Order date: {value}",
  "pickupLabel.email": "Email: {value}",
  "pickupLabel.phone": "Phone: {value}",

  // exported file names: ASCII only, S3 keys turn anything else into "_"
  "fileName.shippingLabels": "shipping-labels",
  "fileName.pickupLabels": "pickup-labels",
  "fileName.labelsZip": "labels",
  "fileName.printLabelsResults": "print-labels-results",
  "fileName.addTrackingResults": "add-tracking-results",
  "fileName.solveZipResults": "solve-zip-results",
  "fileName.errors": "errors",
  "fileName.failed": "FAILED_{job}",
  "fileName.test": "trackme-test",
  "fileName.unfulfilledReport": "unfulfilled-report",
  "fileName.job.solve-zip": "solve-zip",
  "fileName.job.add-tracking": "add-tracking",
  "fileName.job.print-labels": "print-labels",
  "fileName.job.test": "test",
} satisfies Record<string, TranslationEntry>;

export type TranslationKey = keyof typeof en;

/**
 * Worded like Shopify's own Romanian admin where the same idea appears there
 * ("Neexecutată", "Stare de onorare a comenzii", "Tracking adăugat", ...).
 */
export const ro: Record<TranslationKey, TranslationEntry> = {
  // navigation
  "nav.orders": "Comenzi",
  "nav.unfulfilledReport": "Raport neexecutate",
  "nav.adminPanel": "Panou de administrare",

  // landing page
  "landing.welcome": "Bun venit în TrackMe!",
  "landing.intro":
    "Această aplicație te ajută să îți gestionezi comenzile în doar câteva clicuri.",
  "landing.featureZip": "Completează automat codurile poștale lipsă",
  "landing.featureTracking": "Adaugă numere de tracking în masă",
  "landing.featureLabels": "Descarcă și printează etichetele de expediere",
  "landing.openDashboard": "Deschide panoul de comenzi",

  // dashboard tabs
  "filter.all": "Toate",
  "filter.pending_fulfillment": "Neexecutate",
  "filter.unprinted": "Neprintate",

  // job names
  "job.solve-zip": "Completează codurile poștale",
  "job.add-tracking": "Adaugă numere de tracking",
  "job.print-labels": "Printează etichete",
  "job.test": "Încărcare de test",

  // dashboard
  "dashboard.starting": "Se pornește...",
  "dashboard.dismiss": "Închide",
  "dashboard.jobStarted": {
    one: "{title} a pornit pentru {count} comandă. Când se termină, lista se reîmprospătează, iar rezultatul apare la Sarcini recente.",
    few: "{title} a pornit pentru {count} comenzi. Când se termină, lista se reîmprospătează, iar rezultatul apare la Sarcini recente.",
    other:
      "{title} a pornit pentru {count} de comenzi. Când se termină, lista se reîmprospătează, iar rezultatul apare la Sarcini recente.",
  },
  "dashboard.jobFinished": "{title} s-a terminat: {details}",
  "dashboard.jobFailed": "{title} a eșuat: {details}",
  "dashboard.listRefreshed":
    "Lista a fost reîmprospătată, iar selecția a fost golită.",
  "dashboard.allInTabSelected": {
    one: "{count} comandă din „{tab}” selectată",
    few: "Toate cele {count} comenzi din „{tab}” sunt selectate",
    other: "Toate cele {count} de comenzi din „{tab}” sunt selectate",
  },
  "dashboard.selectedCount": {
    one: "{count} selectată",
    other: "{count} selectate",
  },
  // only shown past the job limit, so always 20 or more: "de comenzi"
  "dashboard.tabTooLarge":
    "{count} de comenzi în acest tab, mai multe decât poate prelua o sarcină ({max})",
  "dashboard.selectAllInTab": {
    one: "Selectează {count} comandă din acest tab",
    few: "Selectează toate cele {count} comenzi din acest tab",
    other: "Selectează toate cele {count} de comenzi din acest tab",
  },
  "dashboard.deselectAll": "Deselectează tot",
  "dashboard.httpError": "Serverul a răspuns cu HTTP {status}.",

  // orders table
  "table.selectAllVisible": "Selectează toate comenzile vizibile",
  "table.selectOrder": "Selectează comanda {name}",
  "table.order": "Comandă",
  "table.date": "Dată",
  "table.customer": "Client",
  "table.total": "Total",
  "table.paymentStatus": "Stare plată",
  "table.fulfillmentStatus": "Stare de onorare a comenzii",
  "table.items": "Articole",
  "table.deliveryMethod": "Metodă de livrare",
  "table.zipCode": "Cod poștal",
  "table.noOrders": "Nu s-au găsit comenzi.",
  "table.itemCount": {
    one: "{count} articol",
    few: "{count} articole",
    other: "{count} de articole",
  },
  "table.missingZip": "Lipsește",

  // Shopify payment statuses
  "financialStatus.AUTHORIZED": "Autorizată",
  "financialStatus.EXPIRED": "Expirată",
  "financialStatus.PAID": "Plătită",
  "financialStatus.PARTIALLY_PAID": "Plătită parțial",
  "financialStatus.PARTIALLY_REFUNDED": "Rambursată parțial",
  "financialStatus.PENDING": "În așteptare",
  "financialStatus.REFUNDED": "Rambursată",
  "financialStatus.VOIDED": "Anulată",

  // Shopify fulfillment statuses
  "fulfillmentStatus.FULFILLED": "Executată",
  "fulfillmentStatus.IN_PROGRESS": "În curs",
  "fulfillmentStatus.ON_HOLD": "Suspendată",
  "fulfillmentStatus.OPEN": "Deschisă",
  "fulfillmentStatus.PARTIALLY_FULFILLED": "Executată parțial",
  "fulfillmentStatus.PENDING_FULFILLMENT": "În așteptarea executării",
  "fulfillmentStatus.REQUEST_DECLINED": "Cerere refuzată",
  "fulfillmentStatus.RESTOCKED": "Readusă în stoc",
  "fulfillmentStatus.SCHEDULED": "Programată",
  "fulfillmentStatus.UNFULFILLED": "Neexecutată",

  // Shopify delivery methods
  "deliveryMethod.LOCAL": "Livrare locală",
  "deliveryMethod.NONE": "Niciuna",
  "deliveryMethod.PICK_UP": "Ridicare personală",
  "deliveryMethod.PICKUP_POINT": "Punct de ridicare",
  "deliveryMethod.RETAIL": "Magazin",
  "deliveryMethod.SHIPPING": "Expediere",

  // pagination
  "pagination.previous": "Anterior",
  "pagination.next": "Următor",
  "pagination.page": "Pagina {current}",
  "pagination.pageOf": "Pagina {current} din {total}",
  "pagination.noOrders": "Nicio comandă",
  "pagination.showingOnPage": "Se afișează {range} ({shown} pe această pagină)",
  "pagination.showingOf": {
    one: "Se afișează {range} din {total} comandă",
    few: "Se afișează {range} din {total} comenzi",
    other: "Se afișează {range} din {total} de comenzi",
  },

  // recent jobs
  "jobs.heading": "Sarcini recente",
  "jobs.linksExpire":
    "Linkurile de descărcare sunt valabile 1 oră. Apasă Reîmprospătează pentru linkuri noi.",
  "jobs.autoUpdates":
    "Lista se actualizează singură cât timp rulează o sarcină.",
  "jobs.refresh": "Reîmprospătează",
  "jobs.empty": "Nicio sarcină de la ultima pornire a aplicației.",
  "jobs.colJob": "Sarcină",
  "jobs.colOrders": "Comenzi",
  "jobs.colStarted": "Pornită",
  "jobs.colStatus": "Stare",
  "jobs.colResult": "Rezultat",
  "jobs.status.running": "⏳ În curs",
  "jobs.status.succeeded": "✅ Gata",
  "jobs.status.failed": "❌ Eșuată",
  "jobs.withErrors": "(cu erori)",
  "jobs.downloadErrorFile": "Descarcă fișierul de eroare",
  "jobs.downloadFile": "Descarcă {fileName}",
  "jobs.defaultFileName": "fișierul",

  // job summaries (one line in Recent jobs); "Label: N" avoids plural agreement
  "summary.succeeded": "Reușite: {count}",
  "summary.failed": "Eșuate: {count}",
  "summary.skipped": "Omise: {count}",
  "summary.noneProcessed": "Nicio comandă procesată",
  "summary.labels": "Etichete: {labels}, comenzi: {count}",
  "summary.ordersFailed": "Comenzi eșuate: {count}",
  "summary.notMarkedPrinted": "Comenzi nemarcate ca printate: {count}",
  "summary.seeErrorsFile": "vezi {fileName}",
  "summary.testFileUploaded": "Fișierul de test a fost încărcat",

  // errors when starting a job
  "startJob.ordersBusy": {
    one: "{count} dintre aceste comenzi este deja într-o sarcină în curs. Așteaptă să se termine, apoi încearcă din nou.",
    other:
      "{count} dintre aceste comenzi sunt deja într-o sarcină în curs. Așteaptă să se termine, apoi încearcă din nou.",
  },
  "startJob.couldNotStart": "Sarcina nu a putut porni: {error}",
  "startJob.invalidOrderIds": "ID-uri de comenzi invalide: {ids}.",
  "startJob.noOrdersSelected": "Nu a fost selectată nicio comandă.",
  "startJob.noOrdersInTab": "Nicio comandă în tabul „{tab}”.",
  "startJob.tooManyOrders":
    "O sarcină poate prelua cel mult {max} de comenzi. Selecția aceasta are mai multe.",

  // admin panel
  "admin.heading": "Panou de administrare",
  "admin.credentialsHeading": "Date de test Optimus",
  "admin.credentialsIntro":
    "Aceste valori sunt încărcate din variabilele de mediu. Cheia API este mascată din motive de securitate.",
  "admin.apiUrl": "URL API",
  "admin.username": "Nume utilizator",
  "admin.apiKey": "Cheie API",
  "admin.testRequestHeading": "Cerere de test",
  "admin.testRequestIntro":
    "Trimite din server o cerere de test către Optimus, cu datele de test și un payload AWB simulat.",
  "admin.sendTestRequest": "Trimite cererea de test",
  "admin.responseOutput": "Răspuns",
  "admin.noRequestYet":
    "Nicio cerere trimisă încă.\n\nRăspunsul Optimus va apărea aici după ce trimiți o cerere de test.",
  "admin.optimusTestCompleted": "Cererea de test Optimus s-a încheiat",
  "admin.optimusTestFailed": "Cererea de test Optimus a eșuat",
  "admin.unknownOptimusError": "Eroare necunoscută la testul Optimus.",
  "admin.s3Heading": "Sarcini în masă: configurare S3",
  "admin.s3Intro":
    "Acțiunile în masă își salvează fișierele rezultat în S3. Toate variabilele de mai jos trebuie setate pentru ca acestea să funcționeze.",
  "admin.s3Bucket": "Bucket S3",
  "admin.awsRegion": "Regiune AWS",
  "admin.appFolder": "Folderul acestei aplicații în bucket",
  "admin.notSet": "(nesetat)",
  "admin.bucketRoot": "(rădăcina bucketului)",
  "admin.openAppFolder": "Deschide folderul aplicației în consola S3",
  "admin.s3TestIntro":
    "Testul încarcă un fișier text mic. Acesta apare apoi la Sarcini recente, cu un link către el în S3.",
  "admin.uploadTestFile": "Încarcă fișierul de test",
  "admin.testUploadStarted": "Încărcarea de test a pornit",
  "admin.testUploadCouldNotStart": "Încărcarea de test nu a putut porni",
  "admin.testUploadStartedDetails":
    "Încărcarea de test a pornit. Apasă Reîmprospătează la Sarcini recente în câteva secunde.",
  "admin.testUploadAlreadyRunning": "O încărcare de test rulează deja.",
  "admin.unknownTestUploadError": "Eroare necunoscută la încărcarea de test.",

  // unfulfilled report (page and PDF)
  "report.heading": "Raport comenzi neexecutate",
  "report.intro":
    "Produsele care mai trebuie onorate, însumate pe variantă. Sunt incluse toate comenzile neexecutate, dacă nu setezi un interval de numere de comandă.",
  "report.intervalHeading": "Interval de comenzi",
  "report.fromOrder": "De la comanda nr.",
  "report.toOrder": "Până la comanda nr.",
  "report.intervalHint": "Lasă gol pentru toate comenzile neexecutate.",
  "report.apply": "Aplică",
  "report.showAll": "Arată toate",
  "report.refresh": "Reîmprospătează",
  "report.downloadPdf": "Descarcă PDF",
  "report.loading":
    "Se adună comenzile neexecutate. La multe comenzi poate dura până la un minut.",
  "report.invalidNumber":
    "Introdu un număr de comandă întreg, de exemplu 1250.",
  "report.invalidInterval":
    "Primul număr de comandă nu poate fi mai mare decât ultimul.",
  "report.scopeAll": "Toate comenzile neexecutate",
  "report.scopeBetween": "Comenzile #{from} – #{to}",
  "report.scopeFrom": "Comenzile de la #{from}",
  "report.scopeTo": "Comenzile până la #{to}",
  "report.generatedAt": "Generat la {date}",
  "report.orderCount": {
    one: "{count} comandă",
    few: "{count} comenzi",
    other: "{count} de comenzi",
  },
  "report.delivery": "Livrare",
  "report.pickup": "Ridicare personală",
  "report.sectionContinued": "{section} (cont.)",
  "report.product": "Produs",
  "report.quantity": "Cantitate",
  "report.total": "Total",
  "report.orders": "Comenzi ({count})",
  "report.ordersContinued": "Comenzi (cont.)",
  "report.noOrders": "Nicio comandă neexecutată.",
  "report.loadFailed": "Raportul nu a putut fi încărcat: {error}",
  "report.pdfFailed": "PDF-ul nu a putut fi creat: {error}",
  "report.bulkBusy":
    "Shopify lucrează încă la un alt export al aplicației. Încearcă din nou peste un minut.",
  "report.bulkNotEnabled":
    "Aplicația nu are încă voie să ruleze interogări în masă (bulk queries). În Partner Dashboard, deschide Apps → TrackMe → API access requests și apasă „Allow bulk queries” la „Run bulk operations”. Shopify o dezactivează din nou după 31 de zile fără nicio interogare în masă.",
  "report.timedOut":
    "Shopify a avut nevoie de prea mult timp pentru a aduna comenzile. Încearcă din nou peste un minut.",

  // shipping and pickup labels PDF
  "labelsPdf.totalsTitle": "Total etichete",
  "labelsPdf.deliveryLabels": "Etichete livrare",
  "labelsPdf.pickupLabels": "Etichete ridicare",
  "labelsPdf.totalLabels": "Nr. total etichete",
  "labelsPdf.orders": "Comenzi ({count})",
  "labelsPdf.ordersContinued": "Comenzi (cont.)",
  "labelsPdf.groupTitle": "{labels} -> {productTypes}",
  "labelsPdf.labelCount": {
    one: "{count} etichetă",
    few: "{count} etichete",
    other: "{count} de etichete",
  },
  "labelsPdf.productTypeCount": {
    one: "{count} tip de produs",
    few: "{count} tipuri de produse",
    other: "{count} de tipuri de produse",
  },
  "pickupLabel.title": "ETICHETĂ RIDICARE",
  "pickupLabel.order": "Comandă: {value}",
  "pickupLabel.confirmationNumber": "Număr de confirmare: {value}",
  "pickupLabel.name": "Nume: {value}",
  "pickupLabel.orderDate": "Dată comandă: {value}",
  "pickupLabel.email": "Email: {value}",
  "pickupLabel.phone": "Telefon: {value}",

  // exported file names: ASCII only, S3 keys turn anything else into "_"
  "fileName.shippingLabels": "etichete-livrare",
  "fileName.pickupLabels": "etichete-ridicare",
  "fileName.labelsZip": "etichete",
  "fileName.printLabelsResults": "rezultate-printare-etichete",
  "fileName.addTrackingResults": "rezultate-adaugare-tracking",
  "fileName.solveZipResults": "rezultate-coduri-postale",
  "fileName.errors": "erori",
  "fileName.failed": "ESUAT_{job}",
  "fileName.test": "trackme-test",
  "fileName.unfulfilledReport": "raport-neexecutate",
  "fileName.job.solve-zip": "coduri-postale",
  "fileName.job.add-tracking": "adaugare-tracking",
  "fileName.job.print-labels": "printare-etichete",
  "fileName.job.test": "test",
};
