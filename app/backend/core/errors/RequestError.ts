/** A problem with the request itself, reported to the user with this HTTP status. */
export class RequestError extends Error {
  constructor(
    readonly status: 400 | 409 | 422,
    message: string,
  ) {
    super(message);
    this.name = "RequestError";
  }
}
