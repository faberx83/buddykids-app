import TagsClient from "./TagsClient";
import { getTags } from "@/lib/data/tags";

export default async function AdminTagsPage() {
  const tags = await getTags();
  return <TagsClient initialTags={tags} />;
}
