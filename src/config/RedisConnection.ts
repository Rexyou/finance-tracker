import { createClient } from 'redis';
import { CustomError } from '../utility/CustomError';
import { ErrorMessages } from '../variables/errorCodes';

export let clientInstance: ReturnType<typeof createClient> | null = null;

export const RedisClient = async () => {
    if (clientInstance?.isOpen) return clientInstance;

    try {
        const client = createClient({
            username: process.env.REDIS_USERNAME,
            password: process.env.REDIS_PASSWORD,
            socket: {
                host: process.env.REDIS_SOCKET_HOST,
                port: Number(process.env.REDIS_SOCKET_PORT),
                reconnectStrategy: (retries) => {
                    if (retries > 1) {
                        console.error('[Redis]: Retry limit reached. Giving up.');
                        return new Error('Retry limit reached');
                    }
                    console.warn(`[Redis]: Reconnection attempt #${retries}...`);
                    return 1000; // wait 1 second between attempts
                }
            }
        });

        // Catch redis-level errors to prevent app crash
        client.on('error', (err) => {
            console.error('[Redis]: Client error:', err.message);
        });

        // Try connecting
        await client.connect();

        if (client.isOpen) {
            console.log('[Redis]: Client connected successfully.');
            clientInstance = client;
            return client;
        } else {
            console.warn('[Redis]: Client connection failed.');
        }
    } catch (err: any) {
        console.error(`[Redis]: Connection failed - ${err.message}`);
        // Optional: log to external monitoring or alert
    }

    // Return null gracefully if Redis connection fails
    return null;
};