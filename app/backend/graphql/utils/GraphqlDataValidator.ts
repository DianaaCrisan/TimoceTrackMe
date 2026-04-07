import type { BackendAppErrorCode } from "app/backend/modules/error-handling/models/BackendAppErrorCode";
import { GraphqlDataValidationError } from "app/backend/modules/error-handling/models/GraphqlDataValidationAppError";

export class GraphqlDataValidator {
  /**
   * Validates that a value is not null, undefined, or an empty string.
   * @param value - The value to validate.
   * @param fieldName - The name of the field for error context.
   * @throws GraphqlDataValidationError if the value is invalid.
   */
  static require(
    value: unknown,
    fieldName: string,
    code: BackendAppErrorCode
  ): void {
    if (value === null || value === undefined || value === "") {
      throw new GraphqlDataValidationError(
        code,
        `${fieldName} should not be null or empty`
      );
    }
  }
}
