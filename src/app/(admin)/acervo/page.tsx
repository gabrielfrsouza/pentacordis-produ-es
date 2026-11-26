import { createClient } from "@/lib/supabase/server";
import { AcervoManager } from "@/components/acervo/acervo-manager";

export const instant = false;

export default async function AcervoPage() {
  const supabase = await createClient();
  const [songsResult, assetsResult] = await Promise.all([
    supabase.from("songs").select("*").order("title"),
    supabase.from("song_assets").select("*").order("asset_type"),
  ]);
  if (songsResult.error) throw new Error(`Não foi possível carregar as músicas: ${songsResult.error.message}`);
  if (assetsResult.error) throw new Error(`Não foi possível carregar os arquivos: ${assetsResult.error.message}`);

  const initialAssets = await Promise.all(assetsResult.data.map(async (asset) => {
    if (!asset.file_url.startsWith("songs/")) return { ...asset, signed_url: asset.file_url };
    const result = await supabase.storage.from("pentacordis-assets").createSignedUrl(asset.file_url, 3600);
    if (result.error) throw new Error(`Não foi possível abrir o arquivo do acervo: ${result.error.message}`);
    return { ...asset, signed_url: result.data.signedUrl };
  }));

  return <AcervoManager initialSongs={songsResult.data} initialAssets={initialAssets} />;
}
