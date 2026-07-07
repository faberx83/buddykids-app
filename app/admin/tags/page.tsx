import { categories } from "@/lib/mock-data";
import TagsClient from "./TagsClient";

export default function AdminTagsPage() {
  return <TagsClient initialTags={categories} />;
}
