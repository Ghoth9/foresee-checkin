const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  "https://urzrfdkpeakvhalbtmpv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyenJmZGtwZWFrdmhhbGJ0bXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5Mjg2MDUsImV4cCI6MjEwNjUwNDYwNX0.EIe4q6kReYFP1w6s54LeC7RGmBpjFRZkNDLxfaxmBlw"
);

async function run() {
  const { data, error } = await supabase
    .from("checkins")
    .update({
      photos: [],
      note: "เช็กอินเข้าปฏิบัติงานเวลา 11:07 น."
    })
    .eq("id", "CHK-4921")
    .select();

  if (error) {
    console.error("Error updating CHK-4921:", error);
  } else {
    console.log("Updated CHK-4921 successfully:", data);
  }
}
run();
