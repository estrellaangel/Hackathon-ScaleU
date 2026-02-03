import "dotenv/config";
import OpenAI from "openai";
import fs from "fs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function main() {
  // 1) Upload files
  const f1 = await client.files.create({
    file: fs.createReadStream("./asu_ship_extracted_with_pdf.txt"),
    purpose: "assistants"
  });
  const f2 = await client.files.create({
    file: fs.createReadStream("./asu_ship_key_value_blocks_with_pdf.txt"),
    purpose: "assistants"
  });

  // 2) Create vector store
  const vs = await client.vectorStores.create({
    name: "ASU SHIP Policy"
  });

  // 3) Add files to vector store
  await client.vectorStores.files.create(vs.id, { file_id: f1.id });
  await client.vectorStores.files.create(vs.id, { file_id: f2.id });

  console.log("VECTOR_STORE_ID:", vs.id);
}

main();
