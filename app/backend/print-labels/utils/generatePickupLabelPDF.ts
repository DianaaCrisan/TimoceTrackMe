import { renderTwoColumnLabel } from "./renderTwoColumnLabel";

type PickupLabelInput = {
  orderName: string;
  createdAt: string;
  confirmationNumber?: string | null;
  customer: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
  };
};

export async function generatePickupLabelPDF({
  orderName,
  createdAt,
  confirmationNumber,
  customer,
}: PickupLabelInput): Promise<Uint8Array> {
  const fullName = `${customer.firstName ?? ""} ${customer.lastName ?? ""}`;
  const formattedDate = new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(createdAt));

  const leftCol = [
    { prefix: null, name: `Comandă: ${orderName}` },
    {
      prefix: null,
      name: `Număr de confirmare: ${confirmationNumber ?? "-"}`,
    },
    { prefix: null, name: `Nume: ${fullName}` },
  ];

  const rightCol = [
    `Dată comandă: ${formattedDate}`,
    `Email: ${customer.email ?? "-"}`,
    `Telefon: ${customer.phone ?? "-"}`,
  ];

  return renderTwoColumnLabel({
    title: "ETICHETĂ RIDICARE",
    leftLines: leftCol,
    rightLines: rightCol,
  });
}
