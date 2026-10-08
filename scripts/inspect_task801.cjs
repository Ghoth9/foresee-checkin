const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  "https://urzrfdkpeakvhalbtmpv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyenJmZGtwZWFrdmhhbGJ0bXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5Mjg2MDUsImV4cCI6MjEwNjUwNDYwNX0.EIe4q6kReYFP1w6s54LeC7RGmBpjFRZkNDLxfaxmBlw"
);

async function run() {
  const { data: tasks, error } = await supabase.from("tasks").select("*").eq("id", "TASK-801");
  if (error || !tasks || tasks.length === 0) {
    console.error("Error fetching TASK-801:", error);
    return;
  }
  const task = tasks[0];
  console.log("Task:", task.id, task.title, "Progress:", task.progress);
  console.log("Customer progress_history:", JSON.stringify(task.customer?.progress_history?.map(h => ({
    id: h.id, progress: h.progress, time: h.time, note: h.note, photosCount: h.photos?.length
  })), null, 2));
}
run();
