const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  "https://urzrfdkpeakvhalbtmpv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyenJmZGtwZWFrdmhhbGJ0bXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5Mjg2MDUsImV4cCI6MjEwNjUwNDYwNX0.EIe4q6kReYFP1w6s54LeC7RGmBpjFRZkNDLxfaxmBlw"
);

async function cleanDuplicates() {
  // Checkins to delete (empty duplicates)
  // For TASK-503: Keep CHK-7587, delete CHK-8428, CHK-4831, CHK-7253
  // For TASK-295: Keep CHK-8676 and CHK-6617 (which have 7 photos and notes), delete CHK-9623, CHK-9223, CHK-2506
  const toDelete = ["CHK-8428", "CHK-4831", "CHK-7253", "CHK-9623", "CHK-9223", "CHK-2506"];
  
  console.log("Deleting duplicate checkin records:", toDelete);
  const { error } = await supabase.from("checkins").delete().in("id", toDelete);
  if (error) {
    console.error("Error deleting duplicates:", error);
  } else {
    console.log("Deleted successfully!");
  }

  const { data: remaining } = await supabase.from("checkins").select("*");
  console.log("Remaining checkins count:", remaining.length);
  remaining.forEach(r => {
    console.log(`ID: ${r.id} | TaskID: ${r.task_id} | Title: ${r.task_title}`);
  });
}

cleanDuplicates();
