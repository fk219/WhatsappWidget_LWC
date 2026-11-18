/**
 * Checks if a string is null, undefined, or consists only of whitespace characters.
 * @param {string} str The string to check.
 * @returns {boolean} True if the string is blank, false otherwise.
 */
const isBlank = (str) => {
    return str === null || str === undefined || String(str).trim() === '';
};

export { isBlank };