import { Queue } from 'bullmq';

export const fileQueue = new Queue('fileCompression', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost', // Configure Redis connection
    port: parseInt(process.env.REDIS_PORT || '6379'), // Port
    // ... any other Redis options (password, etc.)
  },
});
