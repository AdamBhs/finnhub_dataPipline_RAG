import { useCallback, useEffect, useRef, useState } from "react";
import { uid } from "@/lib/uid";
import type { Attachment } from "./types";

const MAX_FILES = 5;
const MAX_SIZE = 10 * 1024 * 1024;

function revoke(items: Attachment[]) {
  items.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
}

export function useAttachments() {
  const [items, setItems] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<Attachment[]>([]);

  // Free preview URLs if the page is left with files still in the draft
  useEffect(() => () => revoke(ref.current), []);

  const add = useCallback((files: File[]) => {
    const room = MAX_FILES - ref.current.length;
    const accepted: Attachment[] = [];
    let problem: string | null = null;

    for (const file of files) {
      if (accepted.length >= room) {
        problem = `You can attach up to ${MAX_FILES} files per message`;
        break;
      }
      if (file.size > MAX_SIZE) {
        problem = `${file.name} is larger than 10 MB`;
        continue;
      }
      accepted.push({
        id: uid(),
        file,
        previewUrl: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : null,
      });
    }

    setError(problem);
    if (accepted.length > 0) {
      ref.current = [...ref.current, ...accepted];
      setItems(ref.current);
    }
  }, []);

  const remove = useCallback((id: string) => {
    const target = ref.current.find((a) => a.id === id);
    if (target) revoke([target]);
    ref.current = ref.current.filter((a) => a.id !== id);
    setItems(ref.current);
    setError(null);
  }, []);

  // Hands the files over to the sent message (URLs stay alive for the thumbnails)
  const takeAll = useCallback(() => {
    const taken = ref.current;
    ref.current = [];
    setItems([]);
    setError(null);
    return taken;
  }, []);

  return { items, error, add, remove, takeAll };
}
