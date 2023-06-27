import { NextApiRequest, NextApiResponse } from "next";
import { embed } from "../../utils/embed";
import { QdrantClient } from "@qdrant/js-client-rest";

const handle = async (req: NextApiRequest, res: NextApiResponse) => {
  const textToEmbed = req.body.text;
  const uid = req.body.uid;
  const openAIEmbedding = await embed(textToEmbed);

  const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME!;

  const client = new QdrantClient({
    url: process.env.QDRANT_ENDPOINT,
    apiKey: process.env.QDRANT_API_KEY,
  });

  const qdrantResult = await client.search(COLLECTION_NAME, {
    vector: openAIEmbedding,
    limit: 30,
  });
  res.status(200).json(qdrantResult);
};
export default handle;
