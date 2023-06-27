"use client";

import React, { useEffect } from "react";
import { useState } from "react";
import { app } from "./firebase";
import { collection, getFirestore } from "firebase/firestore";
import { addDoc, serverTimestamp } from "firebase/firestore";
import { SearchResult } from "./SearchResult";
import { User, getAuth, onAuthStateChanged } from "firebase/auth";

export function scrapboxTitle(pageTitle: string) {
  // Replace spaces with underscores and encode special characters
  const encodedTitle = encodeURIComponent(pageTitle.replace(/ /g, "_"));
  return encodedTitle;
}

export function scrapboxUrl(projectName: string, pageTitle: string) {
  // Replace spaces with underscores and encode special characters
  const encodedTitle = encodeURIComponent(pageTitle.replace(/ /g, "_"));
  return `https://scrapbox.io/${projectName}/${encodedTitle}`;
}

export function scrapboxIconUrl(projectName: string, pageTitle: string) {
  // Replace spaces with underscores and encode special characters
  const encodedTitle = encodeURIComponent(pageTitle.replace(/ /g, "_"));
  return `https://scrapbox.io/api/pages/${projectName}/${encodedTitle}/icon`;
}

const Spinner = () => (
  <div className="border-t-2 border-blue-500 rounded-full w-6 h-6 animate-spin"></div>
);

export default function Search() {
  const [result, setResult] = useState([] as any[]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [firebaseID, setFirebaseID] = useState(null as string | null);
  const [query, setQuery] = useState("");

  const onClickSearch = async () => {
    const text = document.getElementById("text") as HTMLTextAreaElement;
    const search = document.getElementById("search") as HTMLButtonElement;
    const query = text.value;

    setLoading(true);
    setError(null);
    setFirebaseID(null);
    setQuery(query);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: query,
          uid: "",
        }),
      });
      const search_result = await res.json();
      console.log(search_result);
      setResult(search_result);

      const db = getFirestore(app);
      const doc = {
        query,
        search_result,
        created: serverTimestamp(),
      };
      addDoc(collection(db, "search_result"), doc)
        .then((docRef) => {
          console.log("success", docRef);
          setFirebaseID(docRef.id);
        })
        .catch((error) => {
          console.error("Error adding document: ", error);
          setError(error.message);
        });
    } catch (err: any) {
      console.log(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const resultDom = SearchResult(result);

  return (
    <div className="ml-4 mr-4 bg-black">
      <textarea
        id="text"
        className="mt-3 p-2 w-full h-20 text-gray-800 bg-white border border-gray-600 rounded"
      ></textarea>
      <button
        id="search"
        onClick={onClickSearch}
        className="mt-3 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        search
      </button>
      {loading && <Spinner />}
      {error && <div className="text-red-500">{error}</div>}
      {!loading && !error && query !== "" && (
        <>
          <h2 className="text-2xl font-bold">Search Result</h2>
          <p>query:</p>
          <p>{query}</p>
        </>
      )}
      {firebaseID && (
        <a
          className="hover:underline"
          href={`/result/${firebaseID}`}
          target="_blank"
        >
          [share result]
        </a>
      )}
      <ul className="mt-5">{resultDom}</ul>
    </div>
  );
}
