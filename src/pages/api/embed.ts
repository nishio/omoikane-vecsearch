import { NextApiRequest, NextApiResponse } from "next";
import { embed } from "../../utils/embed";

const handle = async (req: NextApiRequest, res: NextApiResponse) => {
  const textToEmbed = req.body.text;
  const openAIEmbedding = await embed(textToEmbed);
  res.status(200).json(openAIEmbedding);
};
export default handle;
