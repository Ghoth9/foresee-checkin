const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  "https://urzrfdkpeakvhalbtmpv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyenJmZGtwZWFrdmhhbGJ0bXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5Mjg2MDUsImV4cCI6MjEwNjUwNDYwNX0.EIe4q6kReYFP1w6s54LeC7RGmBpjFRZkNDLxfaxmBlw"
);

async function run() {
  const { data: checkins, error } = await supabase.from("checkins").select("*");
  if (error) {
    console.error("Error fetching checkins:", error);
    return;
  }
  console.log("Checkins count:", checkins.length);
  for (const c of checkins) {
    const photoCount = Array.isArray(c.photos) ? c.photos.length : 0;
    console.log(`ID: ${c.id} | TaskID: ${c.task_id} | Title: ${c.task_title} | Photos: ${photoCount} | Note: ${c.note}`);
  }
}
run();
