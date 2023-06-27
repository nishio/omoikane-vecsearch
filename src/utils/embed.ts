import axios from "axios";

export const embed = async (textToEmbed: string) => {
  const model = "text-embedding-ada-002";
  const URL = "https://api.openai.com/v1/embeddings";
  // Call OpenAI Embedding API
  const openAIResponse = await axios.post(
    URL,
    { input: textToEmbed, model: model },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  const openAIEmbedding = openAIResponse.data.data[0].embedding; // assuming the embedding is in this path
  return openAIEmbedding;
};
