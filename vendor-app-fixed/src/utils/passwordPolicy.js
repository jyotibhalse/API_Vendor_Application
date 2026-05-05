export const PASSWORD_POLICY_TEXT =
  "Use 6-15 characters with one uppercase letter, one number, and one special character."

export function validatePasswordPolicy(password) {
  if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,15}$/.test(password)) {
    return PASSWORD_POLICY_TEXT
  }

  return ""
}
