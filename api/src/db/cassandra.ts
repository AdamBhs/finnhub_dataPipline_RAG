
import "dotenv/config";
import { Client } from "cassandra-driver";

const cassandra = new Client({
  contactPoints: [
    process.env.CASSANDRA_CONTACT_POINTS ?? "127.0.0.1",
  ],
  localDataCenter:
    process.env.CASSANDRA_LOCAL_DATACENTER ?? "datacenter1",
  keyspace: process.env.CASSANDRA_KEYSPACE ?? "finnhub",
  protocolOptions: {
    port: Number(process.env.CASSANDRA_PORT ?? 9042),
  },
});

export async function connectCassandra(): Promise<void> {
  await cassandra.connect();
  console.log("Connected to Cassandra");
}

export default cassandra;
