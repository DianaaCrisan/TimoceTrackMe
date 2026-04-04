export type OptimusConnectionTestResult = {
  ok: boolean;
  request: {
    endpoint: string;
    payload: Record<string, string>;
  };
  response: {
    status: number;
    rawBody: string;
    parsedBody: unknown;
  };
};
