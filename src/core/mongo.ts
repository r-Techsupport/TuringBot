/**
 * @file
 * This file contains the Dependency definition for Mongodb, and may contain interfaces/definitions for db stuff in the future
 */
import {MongoClient, ServerApiVersion} from 'mongodb';
import {botConfig} from './config.js';
import {Dependency} from './modules.js';

/**
 * A connection to MongoDB, as a Dependency
 * @type Db
 */
export const mongo = new Dependency('MongoDB', async () => {
  const mongoConfig = botConfig.secrets.mongodb;

  let connectionString = "placeholder value"
  if (`${mongoConfig.bypassAuth}`) {
    connectionString =
      `${mongoConfig.protocol}` +
      `${mongoConfig.address}:27017`;
  }

  if (!mongoConfig.bypassAuth) {
    // https://www.mongodb.com/docs/manual/reference/connection-string/
    connectionString =
      `${mongoConfig.protocol}${mongoConfig.username}:${mongoConfig.password}` +
    `@${mongoConfig.address}:27017`;
  }

  if (typeof mongoConfig.bypassAuth !== 'boolean') {
    throw new Error("bypassAuth is not a boolean")
  }
  
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

  return mongoClient.db(`${mongoConfig.dbName}`);
});
