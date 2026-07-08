const postgres = require('postgres');

const sql = postgres('postgresql://neondb_owner:npg_5NJrTiRo6zuG@ep-weathered-fog-aoa2ye4d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');

async function main() {
  try {
    // Mark videos as blocked if they have youtubeVideoId but no ytViews after being "uploaded"
    // This is a heuristic: videos uploaded but with 0 views after 24+ hours are likely blocked
    const result = await sql.unsafe(`
      UPDATE video_queue 
      SET status = 'blocked', processing_started_at = NOW()
      WHERE status = 'uploaded' 
        AND youtube_video_id IS NOT NULL
        AND COALESCE(yt_views, 0) = 0
        AND created_at < NOW() - INTERVAL '24 hours'
      RETURNING id, title, youtube_video_id
    `);

    console.log(`Marked ${result.length} videos as blocked:`);
    for (const v of result) {
      console.log(`  - ${v.title} (${v.youtube_video_id})`);
    }

    // Update GCP credentials based on blocked videos
    const gcpUpdates = await sql.unsafe(`
      UPDATE gcp_credentials 
      SET status = 'blocked', blocked_at = NOW()
      WHERE id IN (
        SELECT DISTINCT ch.gcp_credential_id
        FROM channels ch
        JOIN video_queue vq ON vq.target_channel_id = ch.id
        WHERE vq.status = 'blocked' AND ch.gcp_credential_id IS NOT NULL
      )
      AND (status IS NULL OR status = 'active')
      RETURNING id, name
    `);

    console.log(`\nMarked ${gcpUpdates.length} GCP credentials as blocked:`);
    for (const g of gcpUpdates) {
      console.log(`  - ${g.name} (${g.id})`);
    }

    console.log('\nDone!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
