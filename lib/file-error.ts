/** Expected refusals from file storage that callers can show without exposing infrastructure details. */
export class FileError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 | 422) {
    super(message);
    this.name = "FileError";
  }
}
