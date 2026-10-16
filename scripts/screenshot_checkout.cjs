const { spawn } = require('child_process');
const fs = require('fs');

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const edge = spawn(edgePath, [
    '--headless=new',
    '--window-size=1280,1600',
    '--remote-debugging-port=9228',
    '--user-data-dir=' + require('os').tmpdir() + '\\edge_shot_' + Date.now(),
    'http://localhost:4173/?tab=checkout'
  ]);

  let versionData = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch('http://127.0.0.1:9228/json/version');
      versionData = await res.json();
      break;
    } catch (e) {}
  }

  const pagesRes = await fetch('http://127.0.0.1:9228/json/list');
  const pages = await pagesRes.json();
  const page = pages.find(p => p.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  let msgId = 1;
  const pending = new Map();
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve } = pending.get(data.id);
      pending.delete(data.id);
      resolve(data.result);
    }
  };
  await new Promise((resolve) => (ws.onopen = resolve));

  function send(method, params = {}) {
    const id = msgId++;
    return new Promise((resolve) => {
      pending.set(id, { resolve });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');

  await new Promise(r => setTimeout(r, 2200));

  await send('Runtime.evaluate', {
    expression: `(() => {
      const opModal = document.getElementById("selectOperatorModal");
      if (opModal) opModal.remove();

      if (window.state && window.state.activeTasks && window.state.activeTasks.length > 0) {
        window.selectActiveTaskForCheckout(window.state.activeTasks[0].id);
      }
      
      const section = document.getElementById("checkoutOutcomeSection");
      if (section) section.classList.remove("hidden");
    })()`,
    awaitPromise: true
  });

  await new Promise(r => setTimeout(r, 1200));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot && shot.data) {
    fs.writeFileSync('checkout_new_design.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved checkout_new_design.png with 1600 height!');
  }

  ws.close();
  edge.kill();
}

run().catch(console.error);
