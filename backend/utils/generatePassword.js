/**
 * Utility to generate secure random passwords
 */

/**
 * Generate a random password with specified complexity
 * @param {number} length - Length of the password (default: 12)
 * @param {boolean} includeUppercase - Include uppercase letters (default: true)
 * @param {boolean} includeLowercase - Include lowercase letters (default: true)
 * @param {boolean} includeNumbers - Include numbers (default: true)
 * @param {boolean} includeSpecial - Include special characters (default: true)
 * @returns {string} - A random password
 */
function generatePassword(
  length = 12,
  includeUppercase = true,
  includeLowercase = true,
  includeNumbers = true,
  includeSpecial = true
) {
  // Character sets
  const uppercaseChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Removed confusing chars like I, O
  const lowercaseChars = 'abcdefghijkmnopqrstuvwxyz'; // Removed confusing chars like l
  const numberChars = '23456789'; // Removed confusing chars like 0, 1
  const specialChars = '!@#$%^&*_-+=';

  // Build the character set based on options
  let chars = '';
  if (includeUppercase) chars += uppercaseChars;
  if (includeLowercase) chars += lowercaseChars;
  if (includeNumbers) chars += numberChars;
  if (includeSpecial) chars += specialChars;

  // Ensure we have at least some characters
  if (chars.length === 0) {
    chars = lowercaseChars + numberChars;
  }

  // Generate the password
  let password = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    password += chars[randomIndex];
  }

  // Ensure the password has at least one character from each required set
  let missingRequirements = [];
  if (includeUppercase && !/[A-Z]/.test(password)) missingRequirements.push('uppercase');
  if (includeLowercase && !/[a-z]/.test(password)) missingRequirements.push('lowercase');
  if (includeNumbers && !/[0-9]/.test(password)) missingRequirements.push('number');
  if (includeSpecial && !/[!@#$%^&*_\-+=]/.test(password)) missingRequirements.push('special');

  // If we're missing requirements, regenerate the password
  if (missingRequirements.length > 0) {
    return generatePassword(length, includeUppercase, includeLowercase, includeNumbers, includeSpecial);
  }

  return password;
}

module.exports = generatePassword;
