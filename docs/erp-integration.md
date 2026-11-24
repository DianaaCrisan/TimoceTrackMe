# Shopify → ERP integration

How we plan to send online shop orders to your ERP: we use the `IInterfacesBO3.asmx` web service (`LogIn` → `Import` → `LogOut`)

Please check the examples and answer the questions at the end :D

**Legend**

- normal value → we are sure (in theory)
- 🟡 → our guess, please confirm
- ❓ → we don't know, please tell us

## Flow

| Shopify event                    | What we send                                     | Stock                |
| -------------------------------- | ------------------------------------------------ | -------------------- |
| 1\. Order placed                 | `Client` (new customers only) + `Comanda`        | reserved             |
| 2\. Order fulfilled              | `Factura` from the Comanda + we download the PDF | goes down            |
| 3\. Cancelled after fulfillment  | `FacturaStorno`                                  | goes back up         |
| 4\. Cancelled before fulfillment | ❓                                               | reservation released |

Rules on our side:

- We save every ID you return to never send the same document twice
- Shopify SKU = your product code (`Cod`)
- Quantities and prices: exactly what the customer paid in Shopify; prices include VAT
- One invoice per order, when the whole order is fulfilled
- We email the invoice PDF to the customer

---

## 1. Order placed

**Step 1:** `Import("Client", ...)`: only the first time we see this customer

```xml
<Client>
  <Antet>
    <Cod>SHOP-7012345678</Cod>              <!-- Shopify customer ID -->
    <Denumire>Ion Popescu</Denumire>
    <TipTert>1</TipTert>                    <!-- Client -->
    <PersoanaFizica>1</PersoanaFizica>      <!-- 🟡 companies: 0 + CodFiscal (we don't yet have companies as clients)-->
    <Judet>Cluj</Judet>
    <Localitate>Cluj-Napoca</Localitate>
    <Adresa>Str. Exemplu 10</Adresa>
    <CodPostal>400000</CodPostal>
    <Telefon>0712345678</Telefon>
    <Email>ion@example.com</Email>
  </Antet>
</Client>
```

We save the returned `Tert_ID`

**Step 2:** `Import("Comanda", ...)`

```xml
<Comanda>
  <Antet>
    <TipDoc>11</TipDoc>                     <!-- 🟡 FPM, because prices include VAT? FP is "factura proforma", but what is FPM? -->
    <Gestiune_ID>❓</Gestiune_ID>           <!-- ❓ -->
    <Referinta>#1234</Referinta>            <!-- Shopify order number -->
    <Tert_ID>5678</Tert_ID>                 <!-- from step 1 -->
    <Data>24/11/2026 14:30:00</Data>
    <EvidentiereDiscount>0</EvidentiereDiscount>  <!-- price already has the discount -->
    <TipPlataFC_ID>3</TipPlataFC_ID>        <!-- 2 = Ramburs, 3 = Card -->
    <Observatii>Customer note from Shopify</Observatii>
    <Adresa>Str. Exemplu 10</Adresa>        <!-- delivery address -->
    <Judet>Cluj</Judet>
    <Localitate>Cluj-Napoca</Localitate>
    <CodPostal>400000</CodPostal>
    <Tara_ID>❓</Tara_ID>                    <!-- ❓ ID for Romania -->
    <Contact>Ion Popescu</Contact>
    <Telefon>0712345678</Telefon>
    <Email>ion@example.com</Email>
    <Utilizator>❓</Utilizator>              <!-- ❓ identificator client? -->
  </Antet>
  <Detaliu>
    <Linie>
      <GrupID>0</GrupID>
      <NomGeneral_ID>❓</NomGeneral_ID>      <!-- ❓ is this SKU? if so, where is the product name? -->
      <Cantitate>2</Cantitate>
      <PretUnitar>45.50</PretUnitar>        <!-- with VAT, after discount -->
      <TipOperatieStoc>1</TipOperatieStoc>  <!-- 🟡 1 = Rezerva stoc -->
    </Linie>
    <Linie>
      <GrupID>0</GrupID>
      <NomGeneral_ID>❓</NomGeneral_ID>      <!-- ❓ shipping ("Transport") product -->
      <Cantitate>1</Cantitate>
      <PretUnitar>20.00</PretUnitar>
    </Linie>
  </Detaliu>
</Comanda>
```

We save the returned `FP_ID`.

---

## 2. Order fulfilled

**Step 1:** `Import("Factura", ...)`

```xml
<Factura>
  <Antet>
    <TipDoc>2</TipDoc>                      <!-- FCDM from FPM (FCDM = normal invoice + prices with VAT included?) -->
    <FP_ID>98765</FP_ID>                    <!-- from "Order placed" (previous step) -->
    <InchideFP>1</InchideFP>
    <Gestiune_ID>❓</Gestiune_ID>            <!-- ❓ same as the order -->
    <Serie>AUTO</Serie>                     <!-- 🟡 -->
    <Tert_ID>5678</Tert_ID>
    <Data>25/11/2026 09:00:00</Data>
    <Utilizator>❓</Utilizator>             <!-- ❓ identificator client? -->
  </Antet>
  <Detaliu>
    <Linie>
      <NomGeneral_ID>❓</NomGeneral_ID>      <!-- ❓ same lines as the order -->
      <Cantitate>2</Cantitate>
    </Linie>
    <Linie>
      <NomGeneral_ID>❓</NomGeneral_ID>      <!-- ❓ shipping -->
      <Cantitate>1</Cantitate>
    </Linie>
  </Detaliu>
</Factura>
```

We save the returned invoice ID (`FC_ID`).

**Step 2: get the PDF**

```
SalvareRaportDocumentEx(token, "❓ source", "❓ group", "❓ entity", FC_ID)  →  FileToken
GET http://❓/GetFile.ashx?InterfaceNumber=3&ClientToken=...&FileToken=...
```

We email the PDF to the customer.

---

## 3. Cancelled after fulfillment

`Import("FacturaStorno", ...)`

```xml
<FacturaStorno>
  <Antet>
    <TipDoc>11</TipDoc>                     <!-- 🟡 FCMS, because the invoice was FCDM -->
    <Gestiune_ID>❓</Gestiune_ID>
    <Serie>AUTO</Serie>                     <!-- 🟡 -->
    <Tert_ID>5678</Tert_ID>
    <Data>26/11/2026 10:00:00</Data>
    <Observatii>Storno order #1234</Observatii>  <!-- ❓ how do we link it to the original invoice? -->
    <Utilizator>❓</Utilizator>                  <!-- ❓ identificator client? -->
  </Antet>
  <Detaliu>
    <Linie>
      <NomGeneral_ID>❓</NomGeneral_ID>
      <Cantitate>-2</Cantitate>             <!-- 🟡 negative or positive? -->
      <Pret>45.50</Pret>
    </Linie>
    <Linie>
      <NomGeneral_ID>❓</NomGeneral_ID>      <!-- 🟡 storno shipping too? -->
      <Cantitate>-1</Cantitate>
      <Pret>20.00</Pret>
    </Linie>
  </Detaliu>
</FacturaStorno>
```

Then we get its PDF (like in step 2) and email it to the customer. 🟡

---

## 4. Cancelled before fulfillment

We have `FP_ID = 98765`. We need to cancel or close it and release the reserved stock.

❓ What do we call? We found no method for this in the documentation.

---

## Questions

**Connection**

1. WSDL URL, company name (`pstrNumeFirma`), API user and password?
2. Is there a test environment or test company?
3. Can our server reach yours? HTTPS? Do you need our IP?

**Products**

4. Shopify quantities are in pieces (e.g. 2 × 500 g pack). Are your products in pieces too, or in kg?
5. Which product do we use for shipping?

**IDs**

7. `Gestiune_ID`, `Utilizator`, and `Tara_ID` for Romania?

**Customers**

8. If a `Client` with the same `Cod` already exists, does `Import` return its ID or an error? What if the customer changes the billing details from one order to another?

**Stock**

9.  Reserve (`TipOperatieStoc = 1`) or block (`5`)? What is the difference for you?
10. Cancel before fulfillment: see section 4.
11. Later: can you set up an `ExportEx` with available stock per product, so we can sync it to Shopify?

**Invoices**

12. `TipDoc` 11 (FPM) → 2 (FCDM) → 11 (FCMS): is this the right chain for prices with VAT?
13. Source / group / entity for the invoice PDF?
14. Storno: how do we link it to the original invoice? Does it work for a partial refund (only some lines)?
