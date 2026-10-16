async function test() {
  const res = await fetch('https://foresee-checkin.vercel.app/');
  const html = await res.text();
  const match = html.match(/src="([^"]+index[^"]+\.js)"/);
  console.log('Live bundle:', match ? match[1] : 'not found');
  if (match) {
    const jsRes = await fetch('https://foresee-checkin.vercel.app' + match[1]);
    const js = await jsRes.text();
    console.log('Contains auto-login string?:', js.includes('Inside LINE client and not logged in'));
    console.log('Contains MY_LIFF_ID?:', js.includes('2011782806-0If1jko9'));
  }
}
test();
