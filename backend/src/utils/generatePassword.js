// utils/generatePassword.js
const crypto = require('crypto');

/**
 * Generate a secure random password
 * @param {number} length - Password length (default: 12)
 * @param {object} options - Password options
 * @returns {string} Generated password
 */
const generatePassword = (length = 12, options = {}) => {
  const {
    includeUppercase = true,
    includeLowercase = true,
    includeNumbers = true,
    includeSymbols = true,
    excludeSimilar = true, // Exclude similar looking characters like 0, O, l, 1, I
  } = options;

  let charset = '';
  
  if (includeLowercase) {
    charset += excludeSimilar ? 'abcdefghijkmnopqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
  }
  
  if (includeUppercase) {
    charset += excludeSimilar ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  }
  
  if (includeNumbers) {
    charset += excludeSimilar ? '23456789' : '0123456789';
  }
  
  if (includeSymbols) {
    charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  }

  if (charset === '') {
    throw new Error('At least one character type must be included');
  }

  let password = '';
  
  // Ensure at least one character from each selected type
  const requiredChars = [];
  
  if (includeLowercase) {
    const lowerChars = excludeSimilar ? 'abcdefghijkmnopqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
    requiredChars.push(lowerChars[crypto.randomInt(lowerChars.length)]);
  }
  
  if (includeUppercase) {
    const upperChars = excludeSimilar ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    requiredChars.push(upperChars[crypto.randomInt(upperChars.length)]);
  }
  
  if (includeNumbers) {
    const numberChars = excludeSimilar ? '23456789' : '0123456789';
    requiredChars.push(numberChars[crypto.randomInt(numberChars.length)]);
  }
  
  if (includeSymbols) {
    const symbolChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    requiredChars.push(symbolChars[crypto.randomInt(symbolChars.length)]);
  }

  // Add required characters to password
  password += requiredChars.join('');

  // Fill the rest with random characters
  for (let i = password.length; i < length; i++) {
    password += charset[crypto.randomInt(charset.length)];
  }

  // Shuffle the password to avoid predictable patterns
  return password.split('').sort(() => crypto.randomInt(3) - 1).join('');
};

/**
 * Generate a simple password (for user-friendly passwords)
 * @param {number} length - Password length (default: 10)
 * @returns {string} Generated password
 */
const generateSimplePassword = (length = 10) => {
  return generatePassword(length, {
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: false,
    excludeSimilar: true
  });
};

/**
 * Generate a strong password (for high security)
 * @param {number} length - Password length (default: 16)
 * @returns {string} Generated password
 */
const generateStrongPassword = (length = 16) => {
  return generatePassword(length, {
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeSimilar: true
  });
};

module.exports = {
  generatePassword,
  generateSimplePassword,
  generateStrongPassword
};
