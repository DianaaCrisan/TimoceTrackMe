import { PageInfo } from "app/types/admin.types";
import { Link } from "react-router";

type CursorPaginationProps = {
  basePath: string;
  pageInfo: PageInfo;
  queryParams?: Record<string, string>;
};

export function CursorPagination({
  basePath,
  pageInfo,
  queryParams = {},
}: CursorPaginationProps) {
  const buildUrl = (
    cursorParam: "before" | "after",
    cursorValue: string | null,
  ) => {
    if (!cursorValue) return null;

    const searchParams = new URLSearchParams(queryParams);
    searchParams.delete("before");
    searchParams.delete("after");
    searchParams.set(cursorParam, cursorValue);

    return `${basePath}?${searchParams.toString()}`;
  };

  const previousUrl =
    pageInfo.hasPreviousPage && pageInfo.startCursor
      ? buildUrl("before", pageInfo.startCursor)
      : null;

  const nextUrl =
    pageInfo.hasNextPage && pageInfo.endCursor
      ? buildUrl("after", pageInfo.endCursor)
      : null;

  return (
    <s-stack direction="inline" gap="base">
      <div>
        {previousUrl ? (
          <Link to={previousUrl}>
            <s-button>Previous</s-button>
          </Link>
        ) : (
          <s-button disabled>Previous</s-button>
        )}
      </div>

      <div>
        {nextUrl ? (
          <Link to={nextUrl}>
            <s-button>Next</s-button>
          </Link>
        ) : (
          <s-button disabled>Next</s-button>
        )}
      </div>
    </s-stack>
  );
}
