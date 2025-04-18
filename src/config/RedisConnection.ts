import { createClient } from 'redis';
import { CustomError } from '../utility/CustomError';
import { ErrorMessages } from '../variables/errorCodes';

export let clientInstance: ReturnType<typeof createClient> | null = null;

export const RedisClient = async () => {
    if (clientInstance?.isOpen)
        return clientInstance

    const client = createClient({
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD,
        socket: {
            host: process.env.REDIS_SOCKET_HOST,
            port: Number(process.env.REDIS_SOCKET_PORT)
        }
    });

    await client.connect();
    if(client.isOpen) {
        console.log("Redis client connected successfully.");
    }
    else {
        console.log("Redis client connection failed.");
        throw new CustomError(ErrorMessages.UnknownError)
    }

    clientInstance = client;
  
    return client;
}