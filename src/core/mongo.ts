/**
 * @file
 * This file contains the Dependency definition for Mongodb, and may contain interfaces/definitions for db stuff in the future
 */
import {MongoClient, ServerApiVersion} from 'mongodb';
import {botConfig} from './config.js';
import {Dependency} from './modules.js';

export const mongo = new Dependency('MongoDB', async () => {
  const mongoConfig = botConfig.mongodb;
  // https://www.mongodb.com/docs/manual/reference/connection-string/
  const connectionString =
    `${mongoConfig.username}:${mongoConfig.password}` +
    `@${mongoConfig.address}:27017`;

  // https://www.mongodb.com/docs/drivers/node/current/fundamentals/connection/connect/#std-label-node-connect-to-mongodb
  const mongoClient = new MongoClient(connectionString, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    serverSelectionTimeoutMS: 15000,
  });

  await mongoClient.connect().catch(err => {
    throw err;
  });

  return mongoClient.db('turingbot');
});
