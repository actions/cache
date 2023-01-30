/**
 * Options to control cache restore
 */
export interface RestoreOptions {
    /**
     * Weather to skip downloading the cache entry.
     * If lookupOnly is set to true, the restore function will only check if
     * a matching cache entry exists.
     */
    lookupOnly?: boolean;
}
