const MAX_EMAIL_LENGTH = 254;

const validateEmail = (value: unknown): boolean =>
  typeof value === "string" &&
  value.length <= MAX_EMAIL_LENGTH &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const validatePassword = (value: unknown): boolean =>
  typeof value === "string" &&
  value.length >= 8 &&
  value.length <= 32 &&
  /[A-Z]/.test(value) &&
  /^[A-Za-z0-9!@#$%^&*()_+\-=]+$/.test(value);

export { validateEmail, validatePassword };
