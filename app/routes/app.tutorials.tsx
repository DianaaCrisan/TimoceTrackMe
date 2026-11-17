import type { ReactNode } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { TUTORIALS, type TutorialStep } from "app/commons/tutorials/Tutorials";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";
import "app/frontend/tutorials/TutorialsContents.scss";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

const URL_PATTERN = /(https?:\/\/[^\s]+?)(?=[.,]?(?:\s|$))/g;

/**
 * Step-by-step how-tos for the admin: working a pack, and each AWB case
 * (extra label, delivering ourselves, the Optimus website, the monthly
 * bill). The text lives in `app/commons/tutorials/Tutorials.ts`.
 */
export default function TutorialsRoute() {
  const { locale, t } = useI18n();
  const tutorials = TUTORIALS[locale];

  return (
    <s-page heading={t("tutorials.heading")}>
      <s-stack direction="block" gap="base">
        <s-section>
          <s-stack direction="block" gap="small-200">
            <s-paragraph>{t("tutorials.intro")}</s-paragraph>
            <nav className="tutorials-contents">
              {tutorials.map((tutorial, index) => (
                <button
                  key={tutorial.id}
                  type="button"
                  className={`tutorials-contents__card${
                    tutorial.inProgress ? " --in-progress" : ""
                  }`}
                  onClick={() =>
                    document
                      .getElementById(tutorial.id)
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  <span className="tutorials-contents__number">
                    {index + 1}
                  </span>
                  <span className="tutorials-contents__text">
                    <span className="tutorials-contents__title">
                      {tutorial.title}
                    </span>
                    <span className="tutorials-contents__when">
                      {tutorial.inProgress ? null : tutorial.when}
                    </span>
                    {tutorial.inProgress ? (
                      <span className="tutorials-contents__chip">
                        {t("tutorials.inProgress")}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
            </nav>
          </s-stack>
        </s-section>

        {tutorials.map((tutorial, index) => (
          <div key={tutorial.id} id={tutorial.id}>
            <s-section heading={`${index + 1}. ${tutorial.title}`}>
              <s-stack direction="block" gap="base">
                {tutorial.inProgress ? (
                  <s-stack
                    direction="inline"
                    gap="small-200"
                    alignItems="center"
                  >
                    <s-badge tone="warning">
                      {t("tutorials.inProgress")}
                    </s-badge>
                    <s-text color="subdued">{tutorial.when}</s-text>
                  </s-stack>
                ) : (
                  <s-text color="subdued">{tutorial.when}</s-text>
                )}
                {tutorial.steps.length > 0 ? (
                  <s-ordered-list>
                    {tutorial.steps.map((step) => (
                      <s-list-item key={stepText(step)}>
                        {typeof step === "string" ? (
                          withLinks(step)
                        ) : (
                          <>
                            {withLinks(step.text)}
                            <s-unordered-list>
                              {step.bullets.map((bullet) => (
                                <s-list-item key={bullet}>
                                  {withLinks(bullet)}
                                </s-list-item>
                              ))}
                            </s-unordered-list>
                          </>
                        )}
                      </s-list-item>
                    ))}
                  </s-ordered-list>
                ) : null}
                {tutorial.notes ? (
                  <s-banner tone="info" heading={t("tutorials.goodToKnow")}>
                    <s-unordered-list>
                      {tutorial.notes.map((note) => (
                        <s-list-item key={note}>{withLinks(note)}</s-list-item>
                      ))}
                    </s-unordered-list>
                  </s-banner>
                ) : null}
              </s-stack>
            </s-section>
          </div>
        ))}
      </s-stack>
    </s-page>
  );
}

function stepText(step: TutorialStep): string {
  return typeof step === "string" ? step : step.text;
}

/** Text with each URL in it as a link that opens in a new tab. */
function withLinks(text: string): ReactNode {
  const parts = text.split(URL_PATTERN);
  return parts.map((part, index) =>
    // split keeps the captured URLs at the odd places
    index % 2 === 1 ? (
      <s-link key={index} href={part} target="_blank">
        {part}
      </s-link>
    ) : (
      part
    ),
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
