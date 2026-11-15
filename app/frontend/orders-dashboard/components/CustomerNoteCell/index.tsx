import { useState } from "react";
import {
  hasCustomerNote,
  type CustomerNote,
} from "app/commons/orders/CustomerNote";
import "app/frontend/orders-dashboard/components/CustomerNoteCell/styles.scss";

type CustomerNoteCellProps = {
  customerNote: CustomerNote;
};

/**
 * The customer's note and checkout fields, highlighted so they catch the eye
 * in a long list. Long notes show three lines; a click shows the rest.
 */
export function CustomerNoteCell({ customerNote }: CustomerNoteCellProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!hasCustomerNote(customerNote)) return null;

  const fullText = [
    customerNote.note,
    ...customerNote.attributes.map(({ key, value }) => `${key}: ${value}`),
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <button
      type="button"
      className={`customer-note-cell${isExpanded ? " --expanded" : ""}`}
      title={isExpanded ? undefined : fullText}
      aria-expanded={isExpanded}
      onClick={() => setIsExpanded((expanded) => !expanded)}
    >
      <CustomerNoteText customerNote={customerNote} />
    </button>
  );
}

/** The note, then each checkout field as "key: value". */
export function CustomerNoteText({ customerNote }: CustomerNoteCellProps) {
  return (
    <>
      {customerNote.note ? (
        <span className="customer-note-text__note">{customerNote.note}</span>
      ) : null}
      {customerNote.attributes.map(({ key, value }) => (
        <span key={key} className="customer-note-text__attribute">
          <strong>{key}:</strong> {value}
        </span>
      ))}
    </>
  );
}
