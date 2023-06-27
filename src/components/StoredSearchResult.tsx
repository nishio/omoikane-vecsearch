"use client";
import { useEffect, useState } from "react";
import { app } from "./firebase";
import { getFirestore } from "firebase/firestore";
import { doc, getDoc } from "firebase/firestore";
import { SearchResult } from "@/components/SearchResult";
import { SearchResultProps } from "../pages/result/[id]";

export const StoredSearchResult: React.FC<SearchResultProps> = ({ id }) => {
  const [loading, setLoading] = useState(true);
  const [searchResult, setSearchResult] = useState(null as any);

  useEffect(() => {
    const fetchSearchResult = async () => {
      const db = getFirestore(app);

      const docRef = doc(db, "search_result", id);
      setLoading(true);
      setSearchResult(null);

      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        console.log("Document data:", docSnap.data());
        setSearchResult(docSnap.data()!);
      } else {
        // docSnap.data() will be undefined in this case
        console.log("No such document!");
      }

      setLoading(false);
    };

    fetchSearchResult();
  }, [id]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!searchResult) {
    return <div>No data found</div>;
  }

  const query = searchResult.query ?? "";
  const resultDom = SearchResult(searchResult.search_result);

  return (
    <div className="ml-2 mr-2 bg-black">
      <h2 className="text-2xl font-bold mt-5">Search Result</h2>
      <p>query:</p>
      <p>{query}</p>

      <ul className="mt-5">{resultDom}</ul>
    </div>
  );
};
