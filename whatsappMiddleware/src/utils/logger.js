// Logging utility with different log levels and formatting

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

const getTimestamp = () => {
    return new Date().toISOString();
};

const formatMessage = (message, data = null) => {
    const timestamp = getTimestamp();
    let logMessage = `[${timestamp}] ${message}`;
    
    if (data) {
        if (typeof data === 'object') {
            try {
                logMessage += `\n${JSON.stringify(data, null, 2)}`;
            } catch (e) {
                logMessage += ` ${String(data)}`;
            }
        } else {
            logMessage += ` ${String(data)}`;
        }
    }
    
    return logMessage;
};

const logger = {
    error: (message, data = null) => {
        const formattedMessage = formatMessage(message, data);
        console.error(`${colors.red}${formattedMessage}${colors.reset}`);
        
        // In a production environment, you might want to send errors to a monitoring service
        // e.g., Sentry, LogRocket, etc.
        if (process.env.NODE_ENV === 'production') {
            // Add error reporting integration here
        }
    },
    
    warn: (message, data = null) => {
        const formattedMessage = formatMessage(message, data);
        console.warn(`${colors.yellow}${formattedMessage}${colors.reset}`);
    },
    
    info: (message, data = null) => {
        const formattedMessage = formatMessage(message, data);
        console.log(`${colors.cyan}${formattedMessage}${colors.reset}`);
    },
    
    debug: (message, data = null) => {
        if (process.env.NODE_ENV === 'development') {
            const formattedMessage = formatMessage(message, data);
            console.debug(`${colors.dim}${formattedMessage}${colors.reset}`);
        }
    },
    
    log: (message, data = null) => {
        const formattedMessage = formatMessage(message, data);
        console.log(formattedMessage);
    }
};

// Export individual log levels as named exports
export const logError = logger.error;
export const logWarning = logger.warn;
export const logInfo = logger.info;
export const logDebug = logger.debug;

// Export default logger with all methods
export default logger;
