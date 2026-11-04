import { ApiError } from "../exceptions/api-error.js";

const PLAYER_ERROR_CODE = "PP001";

const toRpcError = (error: { code?: string; message: string }): Error =>
  error.code === PLAYER_ERROR_CODE
    ? ApiError.BadRequest(error.message)
    : new Error(`Database error: ${error.message}`);

export { toRpcError };
