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
  "filter.zip_to_fix": "ZIP to fix",
  "filter.unprinted": "Unprinted",

  // job names
  "job.add-tracking": "Add tracking numbers",
  "job.print-labels": "Print labels",
  "job.test": "Test upload",

  // dashboard
  "dashboard.starting": "Starting...",
  "dashboard.dismiss": "Dismiss",
  "dashboard.loading": "Loading...",
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
  "dashboard.fixZips": {
    one: "Fix {count} ZIP code",
    other: "Fix {count} ZIP codes",
  },

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
  "table.customerNote": "Customer note",
  "table.weight": "Weight",

  // order weight, against the limit per parcel
  "weight.overLimit": "Over {limit}",
  "weight.willSplit": "Will be split into parcels",
  "weight.splitInto": {
    one: "Shipped in {count} parcel",
    other: "Split into {count} parcels",
  },
  "weight.limitTitle": "Over the {limit} limit per parcel",
  "trackingReview.overWeightLimit":
    "Over the {limit} limit per parcel. Automatic split is off, so it will ship as one parcel.",

  // settings in the admin panel
  "settings.parcelWeightHeading": "Parcel weight",
  "settings.parcelWeightIntro":
    "Orders heavier than the limit are highlighted on the Orders page. With automatic split on, adding tracking ships them as several parcels, each with its own shipping label marked 1/3, 2/3 and so on.",
  "settings.weightLimit": "Weight limit per parcel",
  "settings.weightLimitDetails":
    "Leave empty to turn the check off. Set it a few kg below the courier's maximum: products sold by weight often weigh more than listed.",
  "settings.autoSplit": "Split heavy orders automatically",
  "settings.autoSplitDetails":
    "When adding tracking, an order over the limit is packed into several parcels, each with its own AWB. When off, heavy orders are only highlighted, and listed for a check before adding tracking.",
  "settings.save": "Save",
  "settings.saved": "Settings saved",
  "settings.invalidWeightLimit":
    "The weight limit must be a number of kg greater than 0, or empty.",

  // "ZIP to fix" tab
  "zipFix.intro":
    "Add tracking stopped on these orders because of their ZIP code. Correct the ZIPs, then add tracking again. Rows you edit are ticked; tick a row without editing it to retry it as it is.",
  "zipFix.submit": {
    one: "Save & add tracking for {count} order",
    other: "Save & add tracking for {count} orders",
  },
  "zipFix.invalidCount": {
    one: "{count} ZIP code is not 6 digits",
    other: "{count} ZIP codes are not 6 digits",
  },
  "zipFix.selectAll": "Select all orders on this page",
  "zipFix.colAddress": "Address",
  "zipFix.colCity": "City",
  "zipFix.colCounty": "County",
  "zipFix.colProblem": "Problem",
  "zipFix.colCorrectZip": "Correct ZIP",
  "zipFix.problemMissing": "Missing, not found automatically",
  "zipFix.problemRejected": "{zip} rejected by Optimus",
  "zipFix.zipInputLabel": "Correct ZIP for order {name}",
  "zipFix.invalidZip": "A ZIP code has 6 digits",
  "zipFix.search": "Search",
  "zipFix.searchTitle": "Look up the ZIP code of this address on Google",
  "zipFix.inProgress": "Adding tracking...",
  "zipFix.empty":
    "No ZIP codes to fix. When add tracking stops on an order because of its ZIP, the order shows up here.",

  // customer notes, checked before add tracking
  "trackingReview.checking": "Checking orders...",
  "trackingReview.couldNotLoad": "Could not check the orders: {error}",
  "trackingReview.dialogTitle": "Check these orders first",
  "trackingReview.dialogIntro": {
    one: "{count} of the selected orders has a customer note or is over the weight limit. Untick it to leave it out of add tracking, e.g. if the customer asks you to wait.",
    other:
      "{count} of the selected orders have a customer note or are over the weight limit. Untick an order to leave it out of add tracking, e.g. if the customer asks you to wait.",
  },
  "trackingReview.include": "Add tracking",
  "trackingReview.leftOut": {
    one: "{count} order left out",
    other: "{count} orders left out",
  },
  "trackingReview.confirm": {
    one: "Add tracking for {count} order",
    other: "Add tracking for {count} orders",
  },
  "trackingReview.cancel": "Cancel",
  "trackingReview.loadFailedTitle": "The orders could not be checked",
  "trackingReview.addWithoutChecking": "Add tracking without checking",

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
  "summary.zipToFix": {
    one: "{count} needs a ZIP fix",
    other: "{count} need a ZIP fix",
  },

  // errors when starting a job
  "startJob.ordersBusy":
    "{count} of these orders are already in a running job. Wait for it to finish, then try again.",
  "startJob.couldNotStart": "Could not start the job: {error}",
  "startJob.invalidOrderIds": "Invalid order IDs: {ids}.",
  "startJob.noOrdersSelected": "No orders were selected.",
  "startJob.noOrdersInTab": 'No orders match the "{tab}" tab.',
  "startJob.tooManyOrders":
    "A job can take at most {max} orders. This selection has more.",
  "startJob.unreadableManualZips":
    "The ZIP codes you typed could not be read. Reload the page and try again.",
  "startJob.invalidManualZip":
    'ZIP code "{zip}" is not valid: it must have 6 digits.',

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
  "fileName.errors": "errors",
  "fileName.failed": "FAILED_{job}",
  "fileName.test": "trackme-test",
  "fileName.unfulfilledReport": "unfulfilled-report",
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
  "filter.zip_to_fix": "Cod poștal de corectat",
  "filter.unprinted": "Neprintate",

  // job names
  "job.add-tracking": "Adaugă numere de tracking",
  "job.print-labels": "Printează etichete",
  "job.test": "Încărcare de test",

  // dashboard
  "dashboard.starting": "Se pornește...",
  "dashboard.dismiss": "Închide",
  "dashboard.loading": "Se încarcă...",
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
  "dashboard.fixZips": {
    one: "Corectează {count} cod poștal",
    few: "Corectează {count} coduri poștale",
    other: "Corectează {count} de coduri poștale",
  },

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
  "table.customerNote": "Notă client",
  "table.weight": "Greutate",

  // greutatea comenzii, față de limita pe colet
  "weight.overLimit": "Peste {limit}",
  "weight.willSplit": "Se va împărți în colete",
  "weight.splitInto": {
    one: "Expediată într-un colet",
    few: "Împărțită în {count} colete",
    other: "Împărțită în {count} de colete",
  },
  "weight.limitTitle": "Peste limita de {limit} pe colet",
  "trackingReview.overWeightLimit":
    "Peste limita de {limit} pe colet. Împărțirea automată este oprită, așa că va pleca într-un singur colet.",

  // setări în panoul de administrare
  "settings.parcelWeightHeading": "Greutatea coletelor",
  "settings.parcelWeightIntro":
    "Comenzile mai grele decât limita sunt evidențiate pe pagina Comenzi. Cu împărțirea automată pornită, la adăugarea tracking-ului pleacă în mai multe colete, fiecare cu eticheta lui de expediere, marcată 1/3, 2/3 și așa mai departe.",
  "settings.weightLimit": "Greutate maximă pe colet",
  "settings.weightLimitDetails":
    "Lasă gol ca să oprești verificarea. Pune câteva kg sub maximul curierului: produsele vândute la kilogram cântăresc des mai mult decât e trecut.",
  "settings.autoSplit": "Împarte automat comenzile grele",
  "settings.autoSplitDetails":
    "La adăugarea tracking-ului, o comandă peste limită e împărțită în mai multe colete, fiecare cu AWB-ul lui. Când e oprită, comenzile grele sunt doar evidențiate și afișate pentru verificare înainte de adăugarea tracking-ului.",
  "settings.save": "Salvează",
  "settings.saved": "Setările au fost salvate",
  "settings.invalidWeightLimit":
    "Greutatea maximă trebuie să fie un număr de kg mai mare decât 0, sau gol.",

  // tabul „Cod poștal de corectat”
  "zipFix.intro":
    "Adăugarea tracking-ului s-a oprit la aceste comenzi din cauza codului poștal. Corectează codurile, apoi adaugă din nou tracking-ul. Rândurile editate se bifează singure; bifează un rând needitat ca să-l reîncerci așa cum e.",
  "zipFix.submit": {
    one: "Salvează și adaugă tracking pentru {count} comandă",
    few: "Salvează și adaugă tracking pentru {count} comenzi",
    other: "Salvează și adaugă tracking pentru {count} de comenzi",
  },
  "zipFix.invalidCount": {
    one: "{count} cod poștal nu are 6 cifre",
    few: "{count} coduri poștale nu au 6 cifre",
    other: "{count} de coduri poștale nu au 6 cifre",
  },
  "zipFix.selectAll": "Selectează toate comenzile de pe pagină",
  "zipFix.colAddress": "Adresă",
  "zipFix.colCity": "Localitate",
  "zipFix.colCounty": "Județ",
  "zipFix.colProblem": "Problemă",
  "zipFix.colCorrectZip": "Cod poștal corect",
  "zipFix.problemMissing": "Lipsește, negăsit automat",
  "zipFix.problemRejected": "{zip} respins de Optimus",
  "zipFix.zipInputLabel": "Codul poștal corect pentru comanda {name}",
  "zipFix.invalidZip": "Un cod poștal are 6 cifre",
  "zipFix.search": "Caută",
  "zipFix.searchTitle": "Caută pe Google codul poștal al acestei adrese",
  "zipFix.inProgress": "Se adaugă tracking...",
  "zipFix.empty":
    "Niciun cod poștal de corectat. Când adăugarea tracking-ului se oprește la o comandă din cauza codului poștal, comanda apare aici.",

  // note client, verificate înainte de adăugarea tracking-ului
  "trackingReview.checking": "Se verifică comenzile...",
  "trackingReview.couldNotLoad": "Comenzile nu au putut fi verificate: {error}",
  "trackingReview.dialogTitle": "Verifică întâi aceste comenzi",
  "trackingReview.dialogIntro": {
    one: "{count} dintre comenzile selectate are o notă de la client sau depășește greutatea maximă. Debifeaz-o ca să o lași în afara adăugării tracking-ului, de ex. dacă clientul cere să aștepți.",
    few: "{count} dintre comenzile selectate au o notă de la client sau depășesc greutatea maximă. Debifează o comandă ca să o lași în afara adăugării tracking-ului, de ex. dacă clientul cere să aștepți.",
    other:
      "{count} dintre comenzile selectate au o notă de la client sau depășesc greutatea maximă. Debifează o comandă ca să o lași în afara adăugării tracking-ului, de ex. dacă clientul cere să aștepți.",
  },
  "trackingReview.include": "Adaugă tracking",
  "trackingReview.leftOut": {
    one: "{count} comandă lăsată deoparte",
    few: "{count} comenzi lăsate deoparte",
    other: "{count} de comenzi lăsate deoparte",
  },
  "trackingReview.confirm": {
    one: "Adaugă tracking pentru {count} comandă",
    few: "Adaugă tracking pentru {count} comenzi",
    other: "Adaugă tracking pentru {count} de comenzi",
  },
  "trackingReview.cancel": "Anulează",
  "trackingReview.loadFailedTitle": "Comenzile nu au putut fi verificate",
  "trackingReview.addWithoutChecking": "Adaugă tracking fără verificare",

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
  "summary.zipToFix": "Coduri poștale de corectat: {count}",

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
  "startJob.unreadableManualZips":
    "Codurile poștale introduse nu au putut fi citite. Reîncarcă pagina și încearcă din nou.",
  "startJob.invalidManualZip":
    "Codul poștal „{zip}” nu este valid: trebuie să aibă 6 cifre.",

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
  "fileName.errors": "erori",
  "fileName.failed": "ESUAT_{job}",
  "fileName.test": "trackme-test",
  "fileName.unfulfilledReport": "raport-neexecutate",
  "fileName.job.add-tracking": "adaugare-tracking",
  "fileName.job.print-labels": "printare-etichete",
  "fileName.job.test": "test",
};
