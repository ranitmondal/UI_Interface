/**
 * Sanitizes text data to be stored in PostgreSQL by removing null bytes
 * and other problematic characters
 */
export function sanitizeForPostgres(text: string | null | undefined): string {
    if (text === null || text === undefined) {
        return '';
    }
    
    // Remove null bytes
    let sanitized = text.replace(/\u0000/g, '');
    
    // Remove other potentially problematic control characters
    sanitized = sanitized.replace(/[\u0001-\u0008\u000B-\u000C\u000E-\u001F]/g, '');
    
    return sanitized;
}

/**
 * Recursively sanitizes all string values in an object
 */
export function sanitizeObjectForPostgres<T extends object>(obj: T): T {
    const sanitized: any = Array.isArray(obj) ? [] : {};
    
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            sanitized[key] = sanitizeForPostgres(value);
        } else if (value && typeof value === 'object') {
            sanitized[key] = sanitizeObjectForPostgres(value);
        } else {
            sanitized[key] = value;
        }
    }
    
    return sanitized as T;
}
