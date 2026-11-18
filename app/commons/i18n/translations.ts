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
  "nav.packs": "Packs",
  "nav.orders": "Unpacked orders",
  "nav.unfulfilledReport": "Unfulfilled report",
  "nav.awbReport": "AWB report",
  "nav.tutorials": "Tutorials",
  "nav.settings": "Settings",
  "nav.developerPanel": "Developer panel",

  // landing page
  "landing.welcome": "Welcome to TrackMe!",
  "landing.intro":
    "This app helps you manage your orders in just a few clicks.",

  // home page cards
  "home.packs": "Work through orders pack by pack: tracking, labels, closing.",
  "home.orders":
    "Orders that didn't get into a pack. Add them to one from here.",
  "home.unfulfilledReport": "Which products still need preparing.",
  "home.awbReport":
    "The month's AWBs, used and cancelled, to check the Optimus bill.",
  "home.tutorials": "What to do, step by step, in each case.",
  "home.settings": "Parcel weight and pack rules.",
  "home.developerPanel": "Technical checks: Optimus, file storage, jobs.",

  // dashboard tabs
  "filter.all": "All",
  "filter.pending_fulfillment": "Pending fulfillment",
  "filter.zip_to_fix": "ZIP to fix",
  "filter.unprinted": "Unprinted",
  "filter.not_in_pack": "Not in a pack",

  // fulfillment packs
  "pack.name": "Pack {date}/{sequence}",
  "pack.status.OPEN": "Filling",
  "pack.status.LOCKED": "In progress",
  "pack.status.CLOSED": "Closed",
  "pack.status.waiting": "Waiting",
  "pack.status.full": "Full",
  "pack.orderCount": { one: "{count} order", other: "{count} orders" },
  "pack.startedAt": "first order {time}",
  "pack.lockedAt": "started {time}",
  "pack.closedAt": "closed {time}",
  "pack.progress": "{done} of {total} done · {left} left",
  "pack.progressAllDone": "All {total} done",
  "pack.progressUnavailable": "Progress could not be loaded.",
  "pack.tagging": {
    one: "{count} order is being updated in Shopify; the pack's tabs show it once that is done.",
    other:
      "{count} orders are being updated in Shopify; the pack's tabs show them once that is done.",
  },
  "pack.tagFailed": {
    one: "{count} order could not be tagged, so the pack's tabs may not show it right.",
    other:
      "{count} orders could not be tagged, so the pack's tabs may not show them right.",
  },
  "pack.newPack": "New pack",
  "pack.action.lock": "Start working",
  "pack.action.close": "Close pack",
  "pack.action.closeAndMove": "Close and move {count} left",
  "pack.action.reopen": "Reopen",
  "pack.action.delete": "Delete",
  "pack.action.cancel": "Cancel",
  "pack.action.retryTagging": "Retry tagging",
  "pack.action.report": "Unfulfilled items report",
  "pack.action.soldReport": "Sold products report",
  "pack.action.addToPack": "Add to pack…",
  "pack.action.moveToPack": "Move to pack…",
  "pack.action.removeFromPack": "Remove from pack",
  "pack.action.addConfirm": {
    one: "Add {count} order",
    other: "Add {count} orders",
  },
  "pack.action.moveConfirm": {
    one: "Move {count} order",
    other: "Move {count} orders",
  },
  "pack.picker.addTitle": {
    one: "Add {count} order to a pack",
    other: "Add {count} orders to a pack",
  },
  "pack.picker.moveTitle": {
    one: "Move {count} order to another pack",
    other: "Move {count} orders to another pack",
  },
  "pack.picker.noOtherPack": "There is no other pack to move to.",
  // only shown past the limit, so always well above 20
  "pack.picker.overLimit":
    "The pack will have {count} orders, over the limit of {limit}. They all go in; new orders then start a new pack.",
  "pack.confirm.lockTitle": "Start working on {name}?",
  "pack.confirm.lockBody":
    "The pack stops taking new orders: the next order starts a new pack. You can still add orders by hand. Next, print its unfulfilled items report, then add tracking.",
  "pack.confirm.closeTitle": "Close {name}?",
  "pack.confirm.closeBody":
    "Every order is done. The pack leaves the working list; you can reopen it from Closed.",
  "pack.confirm.closeBodyLeftovers": {
    one: "{count} order is not done yet. It moves to the filling pack (a new one is started if none is filling), then this pack closes.",
    other:
      "{count} orders are not done yet. They move to the filling pack (a new one is started if none is filling), then this pack closes.",
  },
  "pack.confirm.closeBodyUnknown":
    "Orders that are not done yet move to the filling pack (a new one is started if none is filling), then this pack closes.",
  "pack.confirm.deleteTitle": "Delete {name}?",
  "pack.confirm.removeTitle": {
    one: "Remove {count} order from the pack?",
    other: "Remove {count} orders from the pack?",
  },
  "pack.confirm.removeBody":
    "They go back to Not in a pack on the Orders page. Orders in a closed pack stay where they are.",
  "pack.done.created": "{name} started.",
  "pack.done.locked": "Pack started. New orders now go to a new pack.",
  "pack.done.closed": "Pack closed.",
  "pack.done.closedAndMoved": {
    one: "Pack closed. {count} order moved to {name}.",
    other: "Pack closed. {count} orders moved to {name}.",
  },
  "pack.done.reopened": "Pack reopened.",
  "pack.done.deleted": "Pack deleted.",
  "pack.done.retryingTags": {
    one: "Tagging {count} order again.",
    other: "Tagging {count} orders again.",
  },
  "pack.done.updatingShopify": "Updating Shopify…",
  "pack.done.added": {
    one: "{count} order added to {name}.",
    other: "{count} orders added to {name}.",
  },
  "pack.done.ofWhichMoved": {
    one: "{count} of them came from another pack.",
    other: "{count} of them came from other packs.",
  },
  "pack.done.skippedClosed": {
    one: "{count} order is in a closed pack and stayed there.",
    other: "{count} orders are in closed packs and stayed there.",
  },
  "pack.done.removed": {
    one: "{count} order removed from its pack.",
    other: "{count} orders removed from their packs.",
  },
  "pack.error.notFound": "This pack no longer exists. Reload the page.",
  "pack.error.alreadyFilling":
    "A pack is already filling. Start working on it before starting a new one.",
  "pack.error.notFilling": "Only a filling pack can be started.",
  "pack.error.lockEmpty": "Add orders to the pack before starting it.",
  "pack.error.closeNotLocked": "Only a pack in progress can be closed.",
  "pack.error.ordersLeft": {
    one: "{count} order is not done yet.",
    other: "{count} orders are not done yet.",
  },
  "pack.error.ordersBusy": {
    one: "A job is running on {count} of this pack's orders. Close the pack once it finishes.",
    other:
      "A job is running on {count} of this pack's orders. Close the pack once it finishes.",
  },
  "pack.error.notClosed": "Only a closed pack can be reopened.",
  "pack.error.deleteNotEmpty": "Only an empty pack can be deleted.",
  "pack.error.targetClosed": "A closed pack cannot take orders.",
  "pack.error.unknownAction": "Unknown pack action.",
  "pack.error.unexpected": "The pack action failed: {error}",
  "packs.heading": "Packs",
  "packs.workingHeading": "Working packs",
  "packs.closedHeading": "Recently closed",
  "packs.intro":
    "New orders go into the filling pack. Start working on a pack to keep its orders together: new orders then start the next pack.",
  "packs.notInPackLink": "Orders not in a pack →",
  "packs.newPack": "New pack",
  "packs.noWorkingPacks":
    "No packs yet. Start one, then add orders to it from the Orders page.",

  // job names
  "job.add-tracking": "Add tracking numbers",
  "job.print-labels": "Print labels",
  "job.test": "Test upload",

  // dashboard
  "dashboard.starting": "Starting...",
  "dashboard.dismiss": "Dismiss",
  "dashboard.loading": "Loading...",
  "dashboard.jobFinished": "{title} finished: {details}",
  "dashboard.jobFailed": "{title} failed: {details}",
  "dashboard.listRefreshed":
    "The list was refreshed and the selection cleared.",
  "dashboard.allInTabSelected": 'All {count} orders in "{tab}" selected',
  "dashboard.selectedCount": "{count} selected",
  "dashboard.goToPacks": "Go to Packs →",
  "dashboard.deselectAll": "Deselect all",
  "dashboard.selectedOfTab": '{count} of {total} orders in "{tab}" selected',
  "dashboard.tagBatchDone": {
    one: "{count} order updated in Shopify.",
    other: "{count} orders updated in Shopify.",
  },
  "dashboard.tagBatchFailed": {
    one: "{count} order could not be tagged; use Retry on its pack.",
    other: "{count} orders could not be tagged; use Retry on their pack.",
  },
  "dashboard.stillUpdating":
    "Shopify is still updating this list. Refresh in a few moments to see the latest.",
  "dashboard.httpError": "The server answered with HTTP {status}.",
  "dashboard.fixZips": {
    one: "Fix {count} ZIP code",
    other: "Fix {count} ZIP codes",
  },

  // orders table
  "table.selectAllInTab": "Select every order in this tab, on all pages",
  "table.selectAllUnknown":
    "The orders in this tab could not be counted, so they cannot all be selected. Tick them by hand.",
  "table.selectAllTooMany":
    "This tab has {count} orders, more than one action takes ({max}). Tick orders by hand.",
  "row.joiningPack": "Being added to {pack}…",
  "row.leavingPack": "Leaving its pack…",
  "row.inJob.add-tracking": "Adding AWB…",
  "row.inJob.print-labels": "Preparing labels…",
  "row.inJob.other": "Being processed…",
  "row.stale": "Updating…",

  // background work in progress
  "activity.addOrders": {
    one: "Adding {count} order to {pack}",
    other: "Adding {count} orders to {pack}",
  },
  "activity.removeOrders": {
    one: "Taking {count} order out of its pack",
    other: "Taking {count} orders out of their pack",
  },
  "activity.close": {
    one: "Moving {count} order left to {pack}",
    other: "Moving {count} orders left to {pack}",
  },
  "activity.retry": {
    one: "Tagging {count} order of {pack} again",
    other: "Tagging {count} orders of {pack} again",
  },
  "activity.somePack": "a pack",
  "activity.progress": "{done} of {total}",
  "activity.failed": "{count} failed",
  "activity.verifying": "Checking that Shopify shows the change…",
  "activity.listUpdatesItself": "The list updates on its own when this is done.",
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
  "table.missingZip": "Add the ZIP code",
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

  // Settings page
  "settings.heading": "Settings",
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
  "settings.packScheduleHeading": "Packs",
  "settings.packMaxOrders": "New pack after",
  "settings.packMaxOrdersSuffix": "orders",
  "settings.packMaxOrdersDetails":
    "The recommended value for the current Shopify plan ({plan}): actions on a whole pack take about a minute. The filling pack then waits and new orders start a new pack. It cannot be changed for now.",
  "settings.packMaxOrdersDetailsNoPlan":
    "The recommended value for the current Shopify plan: actions on a whole pack take about a minute. The filling pack then waits and new orders start a new pack. It cannot be changed for now.",
  "settings.packScheduleSectionHeading": "Scheduled new packs",
  "settings.packScheduleIntro":
    "A new pack always starts when you start working on the filling one. Tick days to also start a new pack at midnight before each of them.",
  "settings.packScheduleDetails":
    "The filling pack then waits for you, and that day's orders go into a new pack. A change applies from the next order. Nothing ticked: packs change only when you start working on one.",
  "weekday.1": "Monday",
  "weekday.2": "Tuesday",
  "weekday.3": "Wednesday",
  "weekday.4": "Thursday",
  "weekday.5": "Friday",
  "weekday.6": "Saturday",
  "weekday.7": "Sunday",
  "settings.invalidWeightLimit":
    "The weight limit must be a number of kg greater than 0, or empty.",

  // "ZIP to fix" tab
  "zipFix.intro":
    "Rows you edit are ticked; a ticked row you did not edit is retried as it is. The header checkbox takes every order in this tab, on all pages, and ZIPs typed on any page are kept.",
  "zipFix.submit": {
    one: "Save & add tracking for {count} order",
    other: "Save & add tracking for {count} orders",
  },
  "zipFix.invalidCount": {
    one: "{count} ZIP code is not 6 digits",
    other: "{count} ZIP codes are not 6 digits",
  },
  "zipFix.submitBreakdown": "({fixed} with a corrected ZIP, {retried} retried as they are)",
  "zipFix.colAddress": "Address",
  "zipFix.colCity": "City",
  "zipFix.colCounty": "County",
  "zipFix.colProblem": "Problem",
  "zipFix.colCorrectZip": "Correct ZIP",
  "zipFix.problemMissing": "Not found automatically: add the ZIP code",
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
  "jobs.linksExpire": "Download links work for 1 hour.",
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
  "startJob.onlyInPacks":
    "Add tracking and print labels only run from a pack. Open the pack on the Packs page.",
  "startJob.ordersNotInPack": {
    one: "{count} selected order is no longer in this pack. Reload the page.",
    other:
      "{count} selected orders are no longer in this pack. Reload the page.",
  },
  "startJob.noOrdersInTab": 'No orders match the "{tab}" tab.',
  "startJob.allOrdersUpdating":
    "Every order in this tab is still being updated in Shopify. Try again in a moment.",
  "startJob.tooManyOrders":
    "A job can take at most {max} orders. This selection has more.",
  "startJob.unreadableManualZips":
    "The ZIP codes you typed could not be read. Reload the page and try again.",
  "startJob.invalidManualZip":
    'ZIP code "{zip}" is not valid: it must have 6 digits.',

  // Developer panel
  "developer.heading": "Developer panel",
  "developer.credentialsHeading": "Optimus test credentials",
  "developer.credentialsIntro":
    "These values are loaded from environment variables. The API key is masked for safety.",
  "developer.apiUrl": "API URL",
  "developer.username": "Username",
  "developer.apiKey": "API Key",
  "developer.testRequestHeading": "Test request",
  "developer.testRequestIntro":
    "This sends a server-side test request to Optimus using test credentials and a mocked AWB-style payload.",
  "developer.sendTestRequest": "Send test request",
  "developer.responseOutput": "Response output",
  "developer.noRequestYet":
    "No request sent yet.\n\nThe Optimus response will be displayed here after you send a test request.",
  "developer.optimusTestCompleted": "Optimus test request completed",
  "developer.optimusTestFailed": "Optimus test request failed",
  "developer.unknownOptimusError": "Unknown Optimus test error.",
  "developer.awbStatusHeading": "AWB status",
  "developer.awbStatusIntro":
    "Asks Optimus for the current status of an AWB and shows the full response. Uses the credentials the app ships with (OPTIMUS_USERNAME / OPTIMUS_API_KEY), not the test ones above: Optimus only knows the AWBs of the account that created them. It only reads, nothing changes.",
  "developer.awbStatusField": "AWB number",
  "developer.awbStatusCheck": "Check status",
  "developer.awbStatusResponse": "AWB status response",
  "developer.awbStatusNoRequestYet":
    "No AWB checked yet.\n\nThe Optimus response will be displayed here after you check an AWB.",
  "developer.awbStatusMissingAwb": "Enter an AWB number.",
  "developer.s3Heading": "Bulk jobs: S3 setup",
  "developer.s3Intro":
    "Bulk actions store their result files in S3. Every variable below must be set for them to work.",
  "developer.s3Bucket": "S3 bucket",
  "developer.awsRegion": "AWS region",
  "developer.appFolder": "This app's folder in the bucket",
  "developer.notSet": "(not set)",
  "developer.bucketRoot": "(bucket root)",
  "developer.openAppFolder": "Open this app's folder in the S3 console",
  "developer.s3TestIntro":
    "The test uploads a small text file. It then appears under Recent jobs with a link to it in S3.",
  "developer.uploadTestFile": "Upload test file",
  "developer.testUploadStarted": "Test upload started",
  "developer.testUploadCouldNotStart": "Test upload could not start",
  "developer.testUploadStartedDetails":
    "Test upload started. Press Refresh under Recent jobs in a few seconds.",
  "developer.testUploadAlreadyRunning": "A test upload is already running.",
  "developer.unknownTestUploadError": "Unknown test upload error.",

  // unfulfilled report (page and PDF)
  "report.heading": "Unfulfilled orders report",
  "report.packIntro":
    "What is left to fulfil for this pack's orders. Print it before adding tracking numbers.",
  "report.backToPack": "← Back to the pack",
  "report.soldHeading": "Sold products report",
  "report.soldPackIntro":
    "Everything this pack's orders sold, per product: cancelled orders and removed items left out. Print it after adding tracking numbers.",
  "report.soldNeedsPack":
    "The sold products report is made for one pack. Open it from the pack on the Packs page.",
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

  // TrackMe on the Shopify order page (extensions)
  "orderAction.invalidOrder": "This is not an order TrackMe can open.",
  "orderAction.notFound": "Shopify has no such order.",
  "orderAction.failed": "TrackMe could not do it: {error}",
  "orderAction.busy":
    "A TrackMe job is working on this order right now. Try again when it's done.",
  "orderAction.nothingToShip":
    "Nothing to ship by courier on this order: no AWB was made.",
  "orderAction.zipSolved": "ZIP code solved automatically: {from} → {to}.",
  "orderAction.noLabel":
    "No label to print: the order has no AWB yet and is not a pickup order. Add tracking first.",

  // tutorials page
  "tutorials.heading": "Tutorials",
  "tutorials.intro": "What to do, step by step, in each case:",
  "tutorials.goodToKnow": "Good to know",
  "tutorials.inProgress": "In progress",

  // AWB report
  "awbReport.heading": "AWB report",
  "awbReport.intro":
    "The month's AWBs, by the day each one was issued, whatever the order's date. Used: on an active fulfillment in Shopify. Cancelled: no longer on one. Optimus doesn't bill an AWB the courier never scanned.",
  "awbReport.tutorialsLink": "What to do in each case →",
  "awbReport.month": "Month",
  "awbReport.syncedAt": "Last read from Shopify: {time}",
  "awbReport.neverSynced":
    'This month hasn\'t been read from Shopify yet. Press "Refresh from Shopify" to bring in the AWBs that are already on orders.',
  "awbReport.refresh": "Refresh from Shopify",
  "awbReport.refreshed": {
    one: "Read {orders} orders from Shopify: {count} AWB added or updated.",
    other: "Read {orders} orders from Shopify: {count} AWBs added or updated.",
  },
  "awbReport.refreshFailed": "Could not read Shopify: {error}",
  "awbReport.addByHand": "Add AWBs by hand",
  "awbReport.downloadExcel": "Download Excel",
  "awbReport.downloadFailed": "Could not create the Excel file: {error}",
  "awbReport.invalidMonth": "Pick a month from the list.",
  "awbReport.unknownAction": "Unknown action. Reload the page.",
  "awbReport.count": { one: "{count} AWB", other: "{count} AWBs" },
  "awbReport.usedHeading": "Used AWBs",
  "awbReport.cancelledHeading": "Cancelled AWBs",
  "awbReport.unknownHeading": "Unrecognised courier",
  "awbReport.cancelledHint":
    "Highlighted: printed before it was cancelled. If that label reached the courier and was scanned, Optimus bills it.",
  "awbReport.unknownHint":
    'The courier on these fulfillments is neither Optimus nor GLS. If it is an Optimus AWB, fix the courier in Shopify (Edit tracking), then press "Refresh from Shopify".',
  "awbReport.emptyTable": "None in {month}.",
  "awbReport.printed": "Printed",
  "awbReport.delete": "Delete",
  "awbReport.cancel": "Cancel",
  "awbReport.deleteTitle": "Delete AWB {awb}?",
  "awbReport.deleteBody":
    "It was added by hand, so it only disappears from this report. You can add it again.",
  "awbReport.deleted": "AWB {awb} deleted.",
  "awbReport.deleteNotAllowed": "Only AWBs added by hand can be deleted.",
  "awbReport.add.title": "Add AWBs by hand",
  "awbReport.add.intro":
    'For AWBs the app can\'t find on its own: ones whose tracking was removed before this report existed, or ones booked on Optimus for a parcel outside Shopify. Press "Refresh from Shopify" first: AWBs that are on orders show up by themselves.',
  "awbReport.add.status": "Status",
  "awbReport.add.day": "Issue date",
  "awbReport.add.dayDetails": "Decides the month the AWBs are listed in.",
  "awbReport.add.awbs": "AWBs, one per line",
  "awbReport.add.awbsDetails":
    "You can add the order number after the AWB, e.g. 6256347789 1022.",
  "awbReport.add.note": "Note (optional)",
  "awbReport.add.submit": "Add",
  "awbReport.add.saved": {
    one: "{count} AWB added.",
    other: "{count} AWBs added.",
  },
  "awbReport.add.alreadyInReport":
    "Already in the report, left as they were: {awbs}",
  "awbReport.add.empty": "Type at least one AWB.",
  "awbReport.add.tooMany": "At most {max} AWBs at a time.",
  "awbReport.add.badDay": "Pick the issue date.",
  "awbReport.add.badStatus": "Pick Used or Cancelled.",
  "awbReport.add.lineErrorsIntro":
    "Nothing was saved. Fix these lines and press Add again:",
  "awbReport.add.lineError": "Line {line} ({text}): {reason}",
  "awbReport.add.reason.badAwb": "not an AWB",
  "awbReport.add.reason.badOrder": "the order number is not valid",
  "awbReport.add.reason.tooManyParts":
    "write only the AWB and the order number",
  "awbReport.add.reason.duplicate": "already on an earlier line",
  "awbReport.add.reason.orderNotFound": "Shopify has no such order",
  "awbReport.colIndex": "No.",
  "awbReport.colAwb": "AWB",
  "awbReport.colOrder": "Order",
  "awbReport.colSource": "Source",
  "awbReport.colParcel": "Parcel",
  "awbReport.colWeight": "Weight (kg)",
  "awbReport.colOrderDate": "Order date",
  "awbReport.colIssuedAt": "Issued",
  "awbReport.colCancelledAt": "Cancelled",
  "awbReport.colReason": "Reason",
  "awbReport.colCourier": "Courier in Shopify",
  "awbReport.colStatus": "Status",
  "awbReport.colNote": "Note",
  "awbReport.colPrintedAt": "First printed",
  "awbReport.colPrintCount": "Prints",
  "awbReport.source.TRACKME": "TrackMe",
  "awbReport.source.SHOPIFY": "Shopify",
  "awbReport.source.IMPORT": "Added by hand",
  "awbReport.status.USED": "Used",
  "awbReport.status.CANCELLED": "Cancelled",
  "awbReport.reason.FULFILLMENT_CANCELLED": "Fulfillment cancelled in Shopify",
  "awbReport.reason.TRACKING_REMOVED": "Tracking removed in Shopify",
  "awbReport.reason.NEVER_ON_SHOPIFY": "Never reached Shopify",
  "awbReport.reason.SET_BY_HAND": "Added by hand as cancelled",

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
  "fileName.soldReport": "sold-products-report",
  "fileName.awbReport": "awb-report",
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
  "nav.packs": "Pachete",
  "nav.orders": "Comenzi fără pachet",
  "nav.unfulfilledReport": "Raport neexecutate",
  "nav.awbReport": "Raport AWB",
  "nav.tutorials": "Tutoriale",
  "nav.settings": "Setări",
  "nav.developerPanel": "Panou pentru dezvoltatori",

  // landing page
  "landing.welcome": "Bun venit în TrackMe!",
  "landing.intro":
    "Această aplicație te ajută să îți gestionezi comenzile în doar câteva clicuri.",

  // carduri pe pagina principală
  "home.packs": "Lucrezi comenzile pe pachete: tracking, etichete, închidere.",
  "home.orders":
    "Comenzile care nu au intrat în niciun pachet. Le adaugi într-unul de aici.",
  "home.unfulfilledReport": "Ce produse mai trebuie pregătite.",
  "home.awbReport":
    "AWB-urile lunii, folosite și anulate, pentru verificarea facturii Optimus.",
  "home.tutorials": "Ce faci, pas cu pas, în fiecare caz.",
  "home.settings": "Greutatea coletelor și regulile pachetelor.",
  "home.developerPanel":
    "Verificări tehnice: Optimus, stocarea fișierelor, sarcini.",

  // dashboard tabs
  "filter.all": "Toate",
  "filter.pending_fulfillment": "Neexecutate",
  "filter.zip_to_fix": "Cod poștal de corectat",
  "filter.unprinted": "Neprintate",
  "filter.not_in_pack": "Fără pachet",

  // fulfillment packs
  "pack.name": "Pachet {date}/{sequence}",
  "pack.status.OPEN": "Se umple",
  "pack.status.LOCKED": "În lucru",
  "pack.status.CLOSED": "Închis",
  "pack.status.waiting": "În așteptare",
  "pack.status.full": "Plin",
  "pack.orderCount": {
    one: "{count} comandă",
    few: "{count} comenzi",
    other: "{count} de comenzi",
  },
  "pack.startedAt": "prima comandă {time}",
  "pack.lockedAt": "început {time}",
  "pack.closedAt": "închis {time}",
  "pack.progress": "{done} din {total} gata · {left} rămase",
  "pack.progressAllDone": "Toate cele {total} sunt gata",
  "pack.progressUnavailable": "Progresul nu a putut fi încărcat.",
  "pack.tagging": {
    one: "{count} comandă se actualizează în Shopify; taburile pachetului o arată după aceea.",
    few: "{count} comenzi se actualizează în Shopify; taburile pachetului le arată după aceea.",
    other:
      "{count} de comenzi se actualizează în Shopify; taburile pachetului le arată după aceea.",
  },
  "pack.tagFailed": {
    one: "{count} comandă nu a putut fi etichetată, așa că taburile pachetului s-ar putea să nu o arate corect.",
    few: "{count} comenzi nu au putut fi etichetate, așa că taburile pachetului s-ar putea să nu le arate corect.",
    other:
      "{count} de comenzi nu au putut fi etichetate, așa că taburile pachetului s-ar putea să nu le arate corect.",
  },
  "pack.newPack": "Pachet nou",
  "pack.action.lock": "Începe lucrul",
  "pack.action.close": "Închide pachetul",
  "pack.action.closeAndMove": "Închide și mută cele {count} rămase",
  "pack.action.reopen": "Redeschide",
  "pack.action.delete": "Șterge",
  "pack.action.cancel": "Anulează",
  "pack.action.retryTagging": "Reîncearcă etichetarea",
  "pack.action.report": "Raport produse neexecutate",
  "pack.action.soldReport": "Raport produse vândute",
  "pack.action.addToPack": "Adaugă în pachet…",
  "pack.action.moveToPack": "Mută în alt pachet…",
  "pack.action.removeFromPack": "Scoate din pachet",
  "pack.action.addConfirm": {
    one: "Adaugă {count} comandă",
    few: "Adaugă {count} comenzi",
    other: "Adaugă {count} de comenzi",
  },
  "pack.action.moveConfirm": {
    one: "Mută {count} comandă",
    few: "Mută {count} comenzi",
    other: "Mută {count} de comenzi",
  },
  "pack.picker.addTitle": {
    one: "Adaugă {count} comandă într-un pachet",
    few: "Adaugă {count} comenzi într-un pachet",
    other: "Adaugă {count} de comenzi într-un pachet",
  },
  "pack.picker.moveTitle": {
    one: "Mută {count} comandă în alt pachet",
    few: "Mută {count} comenzi în alt pachet",
    other: "Mută {count} de comenzi în alt pachet",
  },
  "pack.picker.noOtherPack": "Nu există alt pachet în care să le muți.",
  // only shown past the limit, so always well above 20: "de comenzi"
  "pack.picker.overLimit":
    "Pachetul va avea {count} de comenzi, peste limita de {limit}. Intră toate; comenzile noi pornesc apoi un pachet nou.",
  "pack.confirm.lockTitle": "Începi lucrul la {name}?",
  "pack.confirm.lockBody":
    "Pachetul nu mai primește comenzi noi: următoarea comandă pornește un pachet nou. Poți adăuga în continuare comenzi manual. Apoi printează raportul de produse neexecutate și adaugă tracking-ul.",
  "pack.confirm.closeTitle": "Închizi {name}?",
  "pack.confirm.closeBody":
    "Toate comenzile sunt gata. Pachetul iese din lista de lucru; îl poți redeschide din Închise.",
  "pack.confirm.closeBodyLeftovers": {
    one: "{count} comandă nu este gata. Se mută în pachetul care se umple (se pornește unul nou dacă nu există), apoi pachetul acesta se închide.",
    few: "{count} comenzi nu sunt gata. Se mută în pachetul care se umple (se pornește unul nou dacă nu există), apoi pachetul acesta se închide.",
    other:
      "{count} de comenzi nu sunt gata. Se mută în pachetul care se umple (se pornește unul nou dacă nu există), apoi pachetul acesta se închide.",
  },
  "pack.confirm.closeBodyUnknown":
    "Comenzile care nu sunt gata se mută în pachetul care se umple (se pornește unul nou dacă nu există), apoi pachetul acesta se închide.",
  "pack.confirm.deleteTitle": "Ștergi {name}?",
  "pack.confirm.removeTitle": {
    one: "Scoți {count} comandă din pachet?",
    few: "Scoți {count} comenzi din pachet?",
    other: "Scoți {count} de comenzi din pachet?",
  },
  "pack.confirm.removeBody":
    "Revin în tabul Fără pachet de pe pagina Comenzi. Comenzile dintr-un pachet închis rămân unde sunt.",
  "pack.done.created": "{name} a pornit.",
  "pack.done.locked":
    "Lucrul a început. Comenzile noi merg acum într-un pachet nou.",
  "pack.done.closed": "Pachet închis.",
  "pack.done.closedAndMoved": {
    one: "Pachet închis. {count} comandă a fost mutată în {name}.",
    few: "Pachet închis. {count} comenzi au fost mutate în {name}.",
    other: "Pachet închis. {count} de comenzi au fost mutate în {name}.",
  },
  "pack.done.reopened": "Pachet redeschis.",
  "pack.done.deleted": "Pachet șters.",
  "pack.done.retryingTags": {
    one: "Se reetichetează {count} comandă.",
    few: "Se reetichetează {count} comenzi.",
    other: "Se reetichetează {count} de comenzi.",
  },
  "pack.done.updatingShopify": "Se actualizează în Shopify…",
  "pack.done.added": {
    one: "{count} comandă adăugată în {name}.",
    few: "{count} comenzi adăugate în {name}.",
    other: "{count} de comenzi adăugate în {name}.",
  },
  "pack.done.ofWhichMoved": {
    one: "{count} dintre ele a venit din alt pachet.",
    few: "{count} dintre ele au venit din alte pachete.",
    other: "{count} dintre ele au venit din alte pachete.",
  },
  "pack.done.skippedClosed": {
    one: "{count} comandă este într-un pachet închis și a rămas acolo.",
    few: "{count} comenzi sunt în pachete închise și au rămas acolo.",
    other: "{count} de comenzi sunt în pachete închise și au rămas acolo.",
  },
  "pack.done.removed": {
    one: "{count} comandă scoasă din pachet.",
    few: "{count} comenzi scoase din pachete.",
    other: "{count} de comenzi scoase din pachete.",
  },
  "pack.error.notFound": "Pachetul nu mai există. Reîncarcă pagina.",
  "pack.error.alreadyFilling":
    "Un pachet se umple deja. Începe lucrul la el înainte să pornești altul.",
  "pack.error.notFilling": "Doar un pachet care se umple poate fi început.",
  "pack.error.lockEmpty": "Adaugă comenzi în pachet înainte să începi lucrul.",
  "pack.error.closeNotLocked": "Doar un pachet în lucru poate fi închis.",
  "pack.error.ordersLeft": {
    one: "{count} comandă nu este gata.",
    few: "{count} comenzi nu sunt gata.",
    other: "{count} de comenzi nu sunt gata.",
  },
  "pack.error.ordersBusy": {
    one: "O sarcină rulează pe {count} comandă din pachet. Închide pachetul după ce se termină.",
    few: "O sarcină rulează pe {count} comenzi din pachet. Închide pachetul după ce se termină.",
    other:
      "O sarcină rulează pe {count} de comenzi din pachet. Închide pachetul după ce se termină.",
  },
  "pack.error.notClosed": "Doar un pachet închis poate fi redeschis.",
  "pack.error.deleteNotEmpty": "Doar un pachet gol poate fi șters.",
  "pack.error.targetClosed": "Un pachet închis nu poate primi comenzi.",
  "pack.error.unknownAction": "Acțiune necunoscută pentru pachet.",
  "pack.error.unexpected": "Acțiunea pe pachet a eșuat: {error}",
  "packs.heading": "Pachete",
  "packs.workingHeading": "Pachete în lucru",
  "packs.closedHeading": "Închise recent",
  "packs.intro":
    "Comenzile noi intră în pachetul care se umple. Începe lucrul la un pachet ca să-i ții comenzile împreună: comenzile noi pornesc atunci următorul pachet.",
  "packs.notInPackLink": "Comenzi fără pachet →",
  "packs.newPack": "Pachet nou",
  "packs.noWorkingPacks":
    "Niciun pachet încă. Pornește unul, apoi adaugă comenzi din pagina Comenzi.",

  // job names
  "job.add-tracking": "Adaugă numere de tracking",
  "job.print-labels": "Printează etichete",
  "job.test": "Încărcare de test",

  // dashboard
  "dashboard.starting": "Se pornește...",
  "dashboard.dismiss": "Închide",
  "dashboard.loading": "Se încarcă...",
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
  "dashboard.goToPacks": "Mergi la Pachete →",
  "dashboard.deselectAll": "Deselectează tot",
  "dashboard.selectedOfTab": "{count} din {total} comenzi din „{tab}” selectate",
  "dashboard.tagBatchDone": {
    one: "{count} comandă actualizată în Shopify.",
    few: "{count} comenzi actualizate în Shopify.",
    other: "{count} de comenzi actualizate în Shopify.",
  },
  "dashboard.tagBatchFailed": {
    one: "{count} comandă nu a putut fi etichetată; folosește Reîncearcă din pachetul ei.",
    few: "{count} comenzi nu au putut fi etichetate; folosește Reîncearcă din pachetul lor.",
    other:
      "{count} de comenzi nu au putut fi etichetate; folosește Reîncearcă din pachetul lor.",
  },
  "dashboard.stillUpdating":
    "Shopify încă actualizează lista. Reîmprospătează peste câteva momente ca să vezi ultima variantă.",
  "dashboard.httpError": "Serverul a răspuns cu HTTP {status}.",
  "dashboard.fixZips": {
    one: "Corectează {count} cod poștal",
    few: "Corectează {count} coduri poștale",
    other: "Corectează {count} de coduri poștale",
  },

  // orders table
  "table.selectAllInTab": "Selectează toate comenzile din acest tab, de pe toate paginile",
  "table.selectAllUnknown":
    "Comenzile din acest tab nu au putut fi numărate, deci nu pot fi selectate toate. Bifează-le manual.",
  // only shown past the job limit, so always 20 or more: "de comenzi"
  "table.selectAllTooMany":
    "Acest tab are {count} de comenzi, mai multe decât poate prelua o acțiune ({max}). Bifează comenzile manual.",
  "row.joiningPack": "Se adaugă în {pack}…",
  "row.leavingPack": "Se scoate din pachet…",
  "row.inJob.add-tracking": "Se adaugă AWB…",
  "row.inJob.print-labels": "Se pregătesc etichetele…",
  "row.inJob.other": "Se procesează…",
  "row.stale": "Se actualizează…",

  // background work in progress
  "activity.addOrders": {
    one: "Se adaugă {count} comandă în {pack}",
    few: "Se adaugă {count} comenzi în {pack}",
    other: "Se adaugă {count} de comenzi în {pack}",
  },
  "activity.removeOrders": {
    one: "Se scoate {count} comandă din pachet",
    few: "Se scot {count} comenzi din pachet",
    other: "Se scot {count} de comenzi din pachet",
  },
  "activity.close": {
    one: "Se mută {count} comandă rămasă în {pack}",
    few: "Se mută {count} comenzi rămase în {pack}",
    other: "Se mută {count} de comenzi rămase în {pack}",
  },
  "activity.retry": {
    one: "Se reetichetează {count} comandă din {pack}",
    few: "Se reetichetează {count} comenzi din {pack}",
    other: "Se reetichetează {count} de comenzi din {pack}",
  },
  "activity.somePack": "un pachet",
  "activity.progress": "{done} din {total}",
  "activity.failed": "{count} eșuate",
  "activity.verifying": "Se verifică dacă Shopify arată schimbarea…",
  "activity.listUpdatesItself": "Lista se actualizează singură când se termină.",
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
  "table.missingZip": "Adaugă codul poștal",
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

  // pagina Setări
  "settings.heading": "Setări",
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
  "settings.packScheduleHeading": "Pachete",
  "settings.packMaxOrders": "Pachet nou după",
  "settings.packMaxOrdersSuffix": "comenzi",
  "settings.packMaxOrdersDetails":
    "Valoarea recomandată pentru planul Shopify actual ({plan}): acțiunile pe un pachet întreg durează în jur de un minut. Pachetul care se umple așteaptă apoi, iar comenzile noi pornesc un pachet nou. Nu poate fi modificată deocamdată.",
  "settings.packMaxOrdersDetailsNoPlan":
    "Valoarea recomandată pentru planul Shopify actual: acțiunile pe un pachet întreg durează în jur de un minut. Pachetul care se umple așteaptă apoi, iar comenzile noi pornesc un pachet nou. Nu poate fi modificată deocamdată.",
  "settings.packScheduleSectionHeading": "Pachete noi programate",
  "settings.packScheduleIntro":
    "Un pachet nou pornește mereu când începi lucrul la cel care se umple. Bifează zile ca să pornească un pachet nou și la miezul nopții dinaintea fiecăreia.",
  "settings.packScheduleDetails":
    "Pachetul care se umple te așteaptă atunci, iar comenzile din ziua aceea intră într-un pachet nou. O schimbare se aplică de la următoarea comandă. Nimic bifat: pachetele se schimbă doar când începi lucrul la unul.",
  "weekday.1": "Luni",
  "weekday.2": "Marți",
  "weekday.3": "Miercuri",
  "weekday.4": "Joi",
  "weekday.5": "Vineri",
  "weekday.6": "Sâmbătă",
  "weekday.7": "Duminică",
  "settings.invalidWeightLimit":
    "Greutatea maximă trebuie să fie un număr de kg mai mare decât 0, sau gol.",

  // tabul „Cod poștal de corectat”
  "zipFix.intro":
    "Rândurile editate se bifează singure; un rând bifat needitat se reîncearcă așa cum e. Bifa din antet ia toate comenzile din acest tab, de pe toate paginile, iar codurile scrise pe orice pagină se păstrează.",
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
  "zipFix.submitBreakdown": "({fixed} cu cod poștal corectat, {retried} reîncercate așa cum sunt)",
  "zipFix.colAddress": "Adresă",
  "zipFix.colCity": "Localitate",
  "zipFix.colCounty": "Județ",
  "zipFix.colProblem": "Problemă",
  "zipFix.colCorrectZip": "Cod poștal corect",
  "zipFix.problemMissing": "Negăsit automat: adaugă codul poștal",
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
  "jobs.linksExpire": "Linkurile de descărcare sunt valabile 1 oră.",
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
  "startJob.onlyInPacks":
    "Tracking-ul și printarea etichetelor se fac doar dintr-un pachet. Deschide pachetul din pagina Pachete.",
  "startJob.ordersNotInPack": {
    one: "{count} comandă selectată nu mai este în acest pachet. Reîncarcă pagina.",
    few: "{count} comenzi selectate nu mai sunt în acest pachet. Reîncarcă pagina.",
    other:
      "{count} de comenzi selectate nu mai sunt în acest pachet. Reîncarcă pagina.",
  },
  "startJob.noOrdersInTab": "Nicio comandă în tabul „{tab}”.",
  "startJob.allOrdersUpdating":
    "Toate comenzile din acest tab se actualizează încă în Shopify. Încearcă din nou în câteva momente.",
  "startJob.tooManyOrders":
    "O sarcină poate prelua cel mult {max} de comenzi. Selecția aceasta are mai multe.",
  "startJob.unreadableManualZips":
    "Codurile poștale introduse nu au putut fi citite. Reîncarcă pagina și încearcă din nou.",
  "startJob.invalidManualZip":
    "Codul poștal „{zip}” nu este valid: trebuie să aibă 6 cifre.",

  // Developer panel
  "developer.heading": "Panou pentru dezvoltatori",
  "developer.credentialsHeading": "Date de test Optimus",
  "developer.credentialsIntro":
    "Aceste valori sunt încărcate din variabilele de mediu. Cheia API este mascată din motive de securitate.",
  "developer.apiUrl": "URL API",
  "developer.username": "Nume utilizator",
  "developer.apiKey": "Cheie API",
  "developer.testRequestHeading": "Cerere de test",
  "developer.testRequestIntro":
    "Trimite din server o cerere de test către Optimus, cu datele de test și un payload AWB simulat.",
  "developer.sendTestRequest": "Trimite cererea de test",
  "developer.responseOutput": "Răspuns",
  "developer.noRequestYet":
    "Nicio cerere trimisă încă.\n\nRăspunsul Optimus va apărea aici după ce trimiți o cerere de test.",
  "developer.optimusTestCompleted": "Cererea de test Optimus s-a încheiat",
  "developer.optimusTestFailed": "Cererea de test Optimus a eșuat",
  "developer.unknownOptimusError": "Eroare necunoscută la testul Optimus.",
  "developer.awbStatusHeading": "Status AWB",
  "developer.awbStatusIntro":
    "Cere de la Optimus statusul actual al unui AWB și afișează răspunsul complet. Folosește datele cu care lucrează aplicația (OPTIMUS_USERNAME / OPTIMUS_API_KEY), nu cele de test de mai sus: Optimus cunoaște doar AWB-urile contului care le-a creat. Doar citește, nu modifică nimic.",
  "developer.awbStatusField": "Număr AWB",
  "developer.awbStatusCheck": "Verifică statusul",
  "developer.awbStatusResponse": "Răspuns status AWB",
  "developer.awbStatusNoRequestYet":
    "Niciun AWB verificat încă.\n\nRăspunsul Optimus va apărea aici după ce verifici un AWB.",
  "developer.awbStatusMissingAwb": "Introdu un număr AWB.",
  "developer.s3Heading": "Sarcini în masă: configurare S3",
  "developer.s3Intro":
    "Acțiunile în masă își salvează fișierele rezultat în S3. Toate variabilele de mai jos trebuie setate pentru ca acestea să funcționeze.",
  "developer.s3Bucket": "Bucket S3",
  "developer.awsRegion": "Regiune AWS",
  "developer.appFolder": "Folderul acestei aplicații în bucket",
  "developer.notSet": "(nesetat)",
  "developer.bucketRoot": "(rădăcina bucketului)",
  "developer.openAppFolder": "Deschide folderul aplicației în consola S3",
  "developer.s3TestIntro":
    "Testul încarcă un fișier text mic. Acesta apare apoi la Sarcini recente, cu un link către el în S3.",
  "developer.uploadTestFile": "Încarcă fișierul de test",
  "developer.testUploadStarted": "Încărcarea de test a pornit",
  "developer.testUploadCouldNotStart": "Încărcarea de test nu a putut porni",
  "developer.testUploadStartedDetails":
    "Încărcarea de test a pornit. Apasă Reîmprospătează la Sarcini recente în câteva secunde.",
  "developer.testUploadAlreadyRunning": "O încărcare de test rulează deja.",
  "developer.unknownTestUploadError":
    "Eroare necunoscută la încărcarea de test.",

  // unfulfilled report (page and PDF)
  "report.heading": "Raport comenzi neexecutate",
  "report.packIntro":
    "Ce mai este de executat pentru comenzile acestui pachet. Printează-l înainte de a adăuga numerele de tracking.",
  "report.backToPack": "← Înapoi la pachet",
  "report.soldHeading": "Raport produse vândute",
  "report.soldPackIntro":
    "Tot ce s-a vândut în comenzile acestui pachet, pe produs: fără comenzile anulate și produsele scoase. Printează-l după ce adaugi numerele de tracking.",
  "report.soldNeedsPack":
    "Raportul de produse vândute se face pentru un pachet. Deschide-l din pachet, de pe pagina Pachete.",
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

  // TrackMe pe pagina comenzii din Shopify (extensii)
  "orderAction.invalidOrder":
    "Aceasta nu este o comandă pe care TrackMe o poate deschide.",
  "orderAction.notFound": "Comanda nu există în Shopify.",
  "orderAction.failed": "TrackMe nu a reușit: {error}",
  "orderAction.busy":
    "O sarcină TrackMe lucrează acum la această comandă. Încearcă din nou după ce se termină.",
  "orderAction.nothingToShip":
    "Comanda nu are nimic de trimis prin curier: nu s-a făcut niciun AWB.",
  "orderAction.zipSolved": "Cod poștal completat automat: {from} → {to}.",
  "orderAction.noLabel":
    "Nicio etichetă de printat: comanda nu are încă AWB și nu este cu ridicare personală. Adaugă întâi tracking.",

  // tutorials page
  "tutorials.heading": "Tutoriale",
  "tutorials.intro": "Ce faci, pas cu pas, în fiecare caz:",
  "tutorials.goodToKnow": "Bine de știut",
  "tutorials.inProgress": "În lucru",

  // AWB report
  "awbReport.heading": "Raport AWB",
  "awbReport.intro":
    "AWB-urile lunii, după ziua în care a fost emis fiecare, indiferent de data comenzii. Folosit: este pe o onorare activă în Shopify. Anulat: nu mai este pe niciuna. Optimus nu facturează un AWB pe care curierul nu l-a scanat.",
  "awbReport.tutorialsLink": "Ce faci în fiecare caz →",
  "awbReport.month": "Luna",
  "awbReport.syncedAt": "Citit ultima dată din Shopify: {time}",
  "awbReport.neverSynced":
    "Luna aceasta nu a fost citită încă din Shopify. Apasă „Reîmprospătează din Shopify” ca să aduci AWB-urile care sunt deja pe comenzi.",
  "awbReport.refresh": "Reîmprospătează din Shopify",
  "awbReport.refreshed": {
    one: "Am citit {orders} comenzi din Shopify: {count} AWB adăugat sau actualizat.",
    few: "Am citit {orders} comenzi din Shopify: {count} AWB-uri adăugate sau actualizate.",
    other:
      "Am citit {orders} comenzi din Shopify: {count} de AWB-uri adăugate sau actualizate.",
  },
  "awbReport.refreshFailed": "Shopify nu a putut fi citit: {error}",
  "awbReport.addByHand": "Adaugă AWB-uri de mână",
  "awbReport.downloadExcel": "Descarcă Excel",
  "awbReport.downloadFailed": "Fișierul Excel nu a putut fi creat: {error}",
  "awbReport.invalidMonth": "Alege o lună din listă.",
  "awbReport.unknownAction": "Acțiune necunoscută. Reîncarcă pagina.",
  "awbReport.count": {
    one: "{count} AWB",
    few: "{count} AWB-uri",
    other: "{count} de AWB-uri",
  },
  "awbReport.usedHeading": "AWB-uri folosite",
  "awbReport.cancelledHeading": "AWB-uri anulate",
  "awbReport.unknownHeading": "Curier nerecunoscut",
  "awbReport.cancelledHint":
    "Evidențiate: printate înainte să fie anulate. Dacă eticheta a ajuns la curier și a fost scanată, Optimus o facturează.",
  "awbReport.unknownHint":
    "Curierul de pe aceste onorări nu este nici Optimus, nici GLS. Dacă este un AWB Optimus, corectează curierul în Shopify (Edit tracking), apoi apasă „Reîmprospătează din Shopify”.",
  "awbReport.emptyTable": "Niciunul în {month}.",
  "awbReport.printed": "Printat",
  "awbReport.delete": "Șterge",
  "awbReport.cancel": "Renunță",
  "awbReport.deleteTitle": "Ștergi AWB-ul {awb}?",
  "awbReport.deleteBody":
    "A fost adăugat de mână, deci dispare doar din acest raport. Îl poți adăuga din nou.",
  "awbReport.deleted": "AWB-ul {awb} a fost șters.",
  "awbReport.deleteNotAllowed":
    "Doar AWB-urile adăugate de mână pot fi șterse.",
  "awbReport.add.title": "Adaugă AWB-uri de mână",
  "awbReport.add.intro":
    "Pentru AWB-urile pe care aplicația nu le găsește singură: cele cu tracking-ul șters înainte să existe acest raport, sau cele făcute pe Optimus pentru un colet din afara Shopify. Apasă întâi „Reîmprospătează din Shopify”: AWB-urile care sunt pe comenzi apar singure.",
  "awbReport.add.status": "Stare",
  "awbReport.add.day": "Data emiterii",
  "awbReport.add.dayDetails": "Stabilește luna în care apar AWB-urile.",
  "awbReport.add.awbs": "AWB-uri, câte unul pe rând",
  "awbReport.add.awbsDetails":
    "Poți scrie și numărul comenzii după AWB, de exemplu 6256347789 1022.",
  "awbReport.add.note": "Notă (opțional)",
  "awbReport.add.submit": "Adaugă",
  "awbReport.add.saved": {
    one: "{count} AWB adăugat.",
    few: "{count} AWB-uri adăugate.",
    other: "{count} de AWB-uri adăugate.",
  },
  "awbReport.add.alreadyInReport":
    "Erau deja în raport și au rămas cum erau: {awbs}",
  "awbReport.add.empty": "Scrie cel puțin un AWB.",
  "awbReport.add.tooMany": "Cel mult {max} AWB-uri odată.",
  "awbReport.add.badDay": "Alege data emiterii.",
  "awbReport.add.badStatus": "Alege Folosit sau Anulat.",
  "awbReport.add.lineErrorsIntro":
    "Nu s-a salvat nimic. Corectează aceste rânduri și apasă din nou Adaugă:",
  "awbReport.add.lineError": "Rândul {line} ({text}): {reason}",
  "awbReport.add.reason.badAwb": "nu este un AWB",
  "awbReport.add.reason.badOrder": "numărul comenzii nu este valid",
  "awbReport.add.reason.tooManyParts": "scrie doar AWB-ul și numărul comenzii",
  "awbReport.add.reason.duplicate": "apare deja pe un rând de mai sus",
  "awbReport.add.reason.orderNotFound": "comanda nu există în Shopify",
  "awbReport.colIndex": "Nr.",
  "awbReport.colAwb": "AWB",
  "awbReport.colOrder": "Comandă",
  "awbReport.colSource": "Sursă",
  "awbReport.colParcel": "Colet",
  "awbReport.colWeight": "Greutate (kg)",
  "awbReport.colOrderDate": "Dată comandă",
  "awbReport.colIssuedAt": "Emis",
  "awbReport.colCancelledAt": "Anulat",
  "awbReport.colReason": "Motiv",
  "awbReport.colCourier": "Curier în Shopify",
  "awbReport.colStatus": "Stare",
  "awbReport.colNote": "Notă",
  "awbReport.colPrintedAt": "Printat prima dată",
  "awbReport.colPrintCount": "Printări",
  "awbReport.source.TRACKME": "TrackMe",
  "awbReport.source.SHOPIFY": "Shopify",
  "awbReport.source.IMPORT": "Adăugat de mână",
  "awbReport.status.USED": "Folosit",
  "awbReport.status.CANCELLED": "Anulat",
  "awbReport.reason.FULFILLMENT_CANCELLED":
    "Onorarea a fost anulată în Shopify",
  "awbReport.reason.TRACKING_REMOVED": "Tracking-ul a fost șters în Shopify",
  "awbReport.reason.NEVER_ON_SHOPIFY": "Nu a ajuns pe Shopify",
  "awbReport.reason.SET_BY_HAND": "Adăugat de mână ca anulat",

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
  "fileName.soldReport": "raport-produse-vandute",
  "fileName.awbReport": "raport-awb",
  "fileName.job.add-tracking": "adaugare-tracking",
  "fileName.job.print-labels": "printare-etichete",
  "fileName.job.test": "test",
};
