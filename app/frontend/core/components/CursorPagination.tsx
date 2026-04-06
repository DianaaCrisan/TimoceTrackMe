import { PageInfo } from "app/types/admin.types";
import { Link } from "react-router";

type CursorPaginationProps = {
  basePath: string;
  pageInfo: PageInfo;
};

export function CursorPagination({
  basePath,
  pageInfo,
}: CursorPaginationProps) {
  const previousUrl =
    pageInfo.hasPreviousPage && pageInfo.startCursor
      ? `${basePath}?before=${encodeURIComponent(pageInfo.startCursor)}`
      : null;

  const nextUrl =
    pageInfo.hasNextPage && pageInfo.endCursor
      ? `${basePath}?after=${encodeURIComponent(pageInfo.endCursor)}`
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
