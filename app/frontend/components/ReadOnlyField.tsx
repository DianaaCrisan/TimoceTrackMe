type ReadOnlyFieldProps = {
  label: string;
  value: string;
};

export function ReadOnlyField({ label, value }: ReadOnlyFieldProps) {
  return (
    <s-stack direction="block">
      <s-text>{label}</s-text>
      <s-box
        padding="base"
        borderWidth="base"
        borderRadius="base"
        background="subdued"
      >
        <span
          style={{
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: "14px",
            wordBreak: "break-all",
          }}
        >
          {value}
        </span>
      </s-box>
    </s-stack>
  );
}
