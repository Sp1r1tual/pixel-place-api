type ToastType = "success" | "error" | "warn" | "warning" | "info";

interface IApiErrorPayload {
  text: string;
  type?: ToastType;
}

class ApiError extends Error {
  status: number;
  errors: unknown;
  payload?: IApiErrorPayload;

  constructor(
    status: number,
    message: string,
    errors: unknown = [],
    payload?: IApiErrorPayload,
  ) {
    super(message);
    this.status = status;
    this.errors = errors;
    if (payload) this.payload = payload;
  }

  static BadRequest(
    message: string | IApiErrorPayload = "Bad request",
    errors: unknown[] = [],
  ) {
    if (typeof message === "string") return new ApiError(400, message, errors);
    return new ApiError(400, message.text, errors, message);
  }

  static UnauthorizedError(message = "User is not authorized") {
    return new ApiError(401, message);
  }

  static Forbidden(message = "Access denied") {
    return new ApiError(403, message);
  }

  static NotFound(message = "Resource not found") {
    return new ApiError(404, message);
  }

  static Conflict(message = "Conflict occurred") {
    return new ApiError(409, message);
  }

  static PayloadTooLarge(message = "Payload too large") {
    return new ApiError(413, message);
  }
}

export { ApiError };
