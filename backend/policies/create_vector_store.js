import "dotenv/config";
import OpenAI from "openai";
import fs from "fs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function main() {
  // Upload files
  const f1 = await client.files.create({
    file: fs.createReadStream("asu_ship_extracted.txt"),
    purpose: "assistants"
  });

  const f2 = await client.files.create({
    file: fs.createReadStream("asu_ship_key_value_blocks.txt"),
    purpose: "assistants"
  });

  const f3 = await client.files.create({
    file: fs.createReadStream("asu_short_policy.txt"),
    purpose: "assistants"
  });

  // Create vector store (or reuse an existing one)
  const vs = await client.vectorStores.create({
    name: "ASU SHIP Policy (2025-2026)"
  });

  // Add files to vector store
  await client.vectorStores.files.create(vs.id, { file_id: f1.id });
  await client.vectorStores.files.create(vs.id, { file_id: f2.id });
  await client.vectorStores.files.create(vs.id, { file_id: f3.id });

  console.log("VECTOR_STORE_ID:", vs.id);
}

main();
