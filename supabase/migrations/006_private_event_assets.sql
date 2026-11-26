UPDATE public.song_assets
SET file_url = regexp_replace(
  file_url,
  '^https?://[^/]+/storage/v1/object/public/pentacordis-assets/',
  ''
)
WHERE file_url ~ '^https?://[^/]+/storage/v1/object/public/pentacordis-assets/';

UPDATE storage.buckets
SET public = false
WHERE id = 'pentacordis-assets';

DROP POLICY IF EXISTS pentacordis_assets_authenticated_select ON storage.objects;
DROP POLICY IF EXISTS pentacordis_assets_authenticated_insert ON storage.objects;
DROP POLICY IF EXISTS pentacordis_assets_authenticated_update ON storage.objects;
DROP POLICY IF EXISTS pentacordis_assets_authenticated_delete ON storage.objects;

CREATE POLICY pentacordis_assets_authenticated_select
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'pentacordis-assets');

CREATE POLICY pentacordis_assets_authenticated_insert
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pentacordis-assets');

CREATE POLICY pentacordis_assets_authenticated_update
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'pentacordis-assets')
WITH CHECK (bucket_id = 'pentacordis-assets');

CREATE POLICY pentacordis_assets_authenticated_delete
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'pentacordis-assets');

CREATE OR REPLACE FUNCTION public.get_public_event_by_token(p_token UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', e.id,
    'title', e.title,
    'event_type', e.event_type,
    'event_date', e.event_date,
    'load_in_time', e.load_in_time,
    'soundcheck_time', e.soundcheck_time,
    'start_time', e.start_time,
    'end_time', e.end_time,
    'venue_name', e.venue_name,
    'venue_address', e.venue_address,
    'maps_url', e.maps_url,
    'dress_code', e.dress_code,
    'logistics_notes', e.logistics_notes,
    'lineup', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'role_needed', el.role_needed,
        'stage_name', COALESCE(m.stage_name, m.full_name)
      ) ORDER BY el.role_needed)
      FROM public.event_lineup el
      LEFT JOIN public.musicians m ON m.id = el.musician_id
      WHERE el.event_id = e.id
        AND el.invite_status IN ('convidado', 'confirmado')
    ), '[]'::jsonb),
    'setlist', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'order_index', es.order_index,
        'moment_label', es.moment_label,
        'event_key', es.event_key,
        'performance_notes', es.performance_notes,
        'title', s.title,
        'composer', s.composer,
        'assets', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'asset_type', sa.asset_type,
            'target_role', sa.target_role,
            'file_url', sa.file_url,
            'key_signature', sa.key_signature
          ) ORDER BY sa.asset_type)
          FROM public.song_assets sa
          WHERE sa.song_id = s.id
            AND sa.target_role = 'todos'
        ), '[]'::jsonb)
      ) ORDER BY es.order_index)
      FROM public.event_setlist es
      JOIN public.songs s ON s.id = es.song_id
      WHERE es.event_id = e.id
    ), '[]'::jsonb)
  )
  FROM public.events e
  WHERE e.public_token = p_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_event_by_token(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_event_by_token(UUID) TO anon, authenticated;
