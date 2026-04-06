type ResponseViewerProps = {
  title?: string;
  content: string;
};

export function ResponseViewer({
  title = "Response output",
  content,
}: ResponseViewerProps) {
  return (
    <s-section heading={title}>
      <s-box
        padding="base"
        borderWidth="base"
        borderRadius="base"
        background="subdued"
      >
        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
          <code>{content}</code>
        </pre>
      </s-box>
    </s-section>
  );
}
