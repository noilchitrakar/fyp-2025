// postgresql://wastesnap_owner:4SQJwuZEKlU0@ep-soft-bush-a5fqr8gh.us-east-2.aws.neon.tech/wastesnap?sslmode=require

import { neon } from "@neondatabase/serverless";

import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL);
//hello world
export const db = drizzle(sql, { schema });
