import { useI18n } from "app/frontend/core/i18n/I18nProvider";

type ResponseViewerProps = {
  title?: string;
  content: string;
};

export function ResponseViewer({ title, content }: ResponseViewerProps) {
  const { t } = useI18n();

  return (
    <s-section heading={title ?? t("admin.responseOutput")}>
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
