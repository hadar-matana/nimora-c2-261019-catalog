import {useEffect, useRef} from "react";
import {set, useClient, useFormValue, type SlugInputProps} from "sanity";
import {fallbackProductSlug, productSlugify} from "../lib/slug";

const apiVersion = "2025-02-19";

export function AutoSlugInput(props: SlugInputProps) {
  const name = useFormValue(["name"]);
  const documentId = useFormValue(["_id"]);
  const client = useClient({apiVersion});
  const lastGeneratedFor = useRef<string | null>(null);

  useEffect(() => {
    const title = typeof name === "string" ? name.trim() : "";
    const current = props.value?.current;

    if (!title || current || lastGeneratedFor.current === title) return;
    lastGeneratedFor.current = title;

    let cancelled = false;

    async function generateSlug() {
      const rawId = typeof documentId === "string" ? documentId : undefined;
      const publishedId = rawId?.replace(/^drafts\./, "");
      const draftId = publishedId ? `drafts.${publishedId}` : undefined;
      const base = productSlugify(title, fallbackProductSlug(rawId));
      const candidates = [
        base,
        `${base}-${Date.now().toString(36).slice(-4)}`,
        fallbackProductSlug(rawId)
      ];

      for (const candidate of candidates) {
        const isAvailable = await client.fetch<boolean>(
          `!defined(*[
            _type == "product" &&
            slug.current == $slug &&
            !(_id in [$publishedId, $draftId])
          ][0]._id)`,
          {slug: candidate, publishedId, draftId}
        );

        if (isAvailable && !cancelled) {
          props.onChange(set({_type: "slug", current: candidate}));
          return;
        }
      }
    }

    generateSlug().catch((error: unknown) => {
      console.error("Failed to auto-generate product slug", error);
    });

    return () => {
      cancelled = true;
    };
  }, [client, documentId, name, props]);

  return props.renderDefault(props);
}
