// Shared auth error helpers

/** Map API error codes to user-facing messages for admin login. */
export function getAuthErrorMessage(
  errorCode: string | undefined,
  fallback = 'Something went wrong. Please try again.',
): string {
  switch (errorCode) {
    case 'INVALID_CREDENTIALS':    return 'Invalid email or password.'
    case 'ACCOUNT_DEACTIVATED':    return 'Your account has been deactivated. Contact your administrator.'
    case 'TOO_MANY_ATTEMPTS':      return 'Too many attempts. Please wait a moment and try again.'
    case 'NETWORK_ERROR':          return 'Something went wrong. Please try again.'
    default:                       return fallback
  }
}

/** Map API error codes to user-facing messages for OTP verification. */
export function getOtpErrorMessage(
  errorCode: string | undefined,
  fallback = 'Invalid or expired code.',
): string {
  switch (errorCode) {
    case 'INVALID_OTP':            return 'The code you entered is incorrect.'
    case 'EXPIRED_OTP':            return 'This code has expired. Please request a new one.'
    case 'TOO_MANY_ATTEMPTS':      return 'Too many failed attempts. Please start over.'
    case 'NETWORK_ERROR':          return 'Something went wrong. Please try again.'
    default:                       return fallback
  }
}

/** Returns an error string if password is invalid, null if valid. */
export function validatePassword(value: string): string | null {
  if (!value) return 'Password is required.'
  if (value.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(value)) return 'Password must include at least one uppercase letter.'
  if (!/[0-9]/.test(value)) return 'Password must include at least one number.'
  return null
}

/** Returns an error string if confirm doesn't match password. */
export function validatePasswordMatch(password: string, confirm: string): string | null {
  if (!confirm) return 'Please confirm your password.'
  if (confirm !== password) return 'Passwords do not match.'
  return null
}
