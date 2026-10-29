export const PASSWORD_PATTERN = '(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9\\s]).{8,}';

export function getPasswordRequirements(password = '') {
  const value = typeof password === 'string' ? password : '';
  return [
    { label: '8–50 characters', valid: value.length >= 8 && value.length <= 50 },
    { label: 'An uppercase letter', valid: /[A-Z]/.test(value) },
    { label: 'A lowercase letter', valid: /[a-z]/.test(value) },
    { label: 'A number', valid: /[0-9]/.test(value) },
    { label: 'A symbol', valid: /[^A-Za-z0-9\s]/.test(value) }
  ];
}
