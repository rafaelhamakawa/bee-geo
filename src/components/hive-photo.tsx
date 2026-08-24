import { useEffect, useState } from "react";
import { Box } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { HIVE_PHOTO_BUCKET } from "@/lib/hives";
import { cn } from "@/lib/utils";

const cache = new Map<string, string>();

export function useHivePhotoUrl(path?: string | null) {
  const [url, setUrl] = useState<string | null>(path ? (cache.get(path) ?? null) : null);

  useEffect(() => {
    let alive = true;
    if (!path) {
      setUrl(null);
      return;
    }
    const cached = cache.get(path);
    if (cached) {
      setUrl(cached);
      return;
    }
    supabase.storage
      .from(HIVE_PHOTO_BUCKET)
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (!alive || !data?.signedUrl) return;
        cache.set(path, data.signedUrl);
        setUrl(data.signedUrl);
      });
    return () => {
      alive = false;
    };
  }, [path]);

  return url;
}

export function HivePhoto({
  path,
  alt,
  className,
}: {
  path?: string | null;
  alt: string;
  className?: string;
}) {
  const url = useHivePhotoUrl(path);
  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-xl border border-border bg-muted",
        className,
      )}
    >
      {url ? (
        <img src={url} alt={alt} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <Box className="h-6 w-6 text-muted-foreground" aria-hidden />
      )}
    </div>
  );
}
