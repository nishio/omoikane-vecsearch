// pages/result/[id].js
import { GetServerSideProps } from "next";
import "../../app/globals.css";
import Link from "next/link";
import { StoredSearchResult } from "../../components/StoredSearchResult";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export type SearchResultProps = {
  id: string;
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params as { id: string };
  return {
    props: { id }, // will be passed to the page component as props
  };
};

const Page: React.FC<SearchResultProps> = ({ id }) => {
  return (
    <>
      <Header />
      <div className="ml-2 mr-2 bg-black">
        <Link href="/" className="hover:underline">
          [new search]
        </Link>
      </div>
      <StoredSearchResult id={id} />
      <Footer />
    </>
  );
};

export default Page;
