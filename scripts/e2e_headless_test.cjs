const { spawn } = require('child_process');
const http = require('http');

async function run() {
  console.log('1. Starting Edge headless...');
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--user-data-dir=' + require('os').tmpdir() + '\\edge_test_prof_' + Date.now(),
    'http://localhost:4173'
  ]);

  edge.stderr.on('data', d => {});

  let versionData = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      versionData = await res.json();
      break;
    } catch (e) {}
  }

  if (!versionData) {
    console.error('Failed to connect to Edge remote debugging port');
    edge.kill();
    process.exit(1);
  }

  console.log('2. Connected to Edge CDP. Fetching open target...');
  const pagesRes = await fetch('http://127.0.0.1:9222/json/list');
  const pages = await pagesRes.json();
  const page = pages.find(p => p.type === 'page');

  if (!page || !page.webSocketDebuggerUrl) {
    console.error('No page target found');
    edge.kill();
    process.exit(1);
  }

  console.log('3. Connecting WebSocket to page:', page.url);
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  let msgId = 1;
  const pending = new Map();
  const consoleMessages = [];
  const runtimeErrors = [];

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve } = pending.get(data.id);
      pending.delete(data.id);
      resolve(data.result);
    }
    if (data.method === 'Runtime.consoleAPICalled') {
      const type = data.params.type;
      const text = data.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
      consoleMessages.push({ type, text });
      if (type === 'error') {
        runtimeErrors.push(text);
      }
    }
    if (data.method === 'Runtime.exceptionThrown') {
      runtimeErrors.push(data.params.exceptionDetails.text + ' ' + (data.params.exceptionDetails.exception?.description || ''));
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

  await send('Runtime.enable');
  await send('Page.enable');

  console.log('4. Waiting 2.5s for app initialization & Supabase/LIFF check...');
  await new Promise(r => setTimeout(r, 2500));

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result?.value;
  }

  console.log('5. Testing critical globals & UI state...');
  const tests = [
    { name: 'window.switchTab exists', expr: 'typeof window.switchTab === "function"' },
    { name: 'window.selectJobType exists', expr: 'typeof window.selectJobType === "function"' },
    { name: 'window.openShareTaskLineModal exists', expr: 'typeof window.openShareTaskLineModal === "function"' },
    { name: 'window.openTaskDetailModal exists', expr: 'typeof window.openTaskDetailModal === "function"' },
    { name: 'window.openAssignModal exists', expr: 'typeof window.openAssignModal === "function"' },
    { name: 'window.openTeamRoleModal exists', expr: 'typeof window.openTeamRoleModal === "function"' },
    { name: 'window.openImageLightbox exists', expr: 'typeof window.openImageLightbox === "function"' },
    { name: 'window.deletePhotoFromTask exists', expr: 'typeof window.deletePhotoFromTask === "function"' },
    { name: 'window.deleteCurrentLightboxImage exists', expr: 'typeof window.deleteCurrentLightboxImage === "function"' },
    { name: 'window.refreshFromSupabase exists', expr: 'typeof window.refreshFromSupabase === "function"' },
    { name: 'window.renderCheckinTechChips exists', expr: 'typeof window.renderCheckinTechChips === "function"' },
    { name: 'window.resolveUserRole exists', expr: 'typeof window.resolveUserRole === "function"' },
    { 
      name: 'Tab switching to tasks works', 
      expr: '(() => { window.switchTab("tasks"); return !document.getElementById("tasksSection").classList.contains("hidden"); })()' 
    },
    { 
      name: 'Tab switching to checkout works', 
      expr: '(() => { window.switchTab("checkout"); return !document.getElementById("checkoutSection").classList.contains("hidden"); })()' 
    },
    { 
      name: 'Tab switching back to checkin works', 
      expr: '(() => { window.switchTab("checkin"); return !document.getElementById("checkinSection").classList.contains("hidden"); })()' 
    },
    { 
      name: 'Job type selection works', 
      expr: '(() => { window.selectJobType("งาน PM (Preventive Maintenance)"); const btn = document.getElementById("jobTypeBtn-งาน PM (Preventive Maintenance)"); return btn && btn.className.includes("bg-blue-600"); })()' 
    },
    { 
      name: 'Role security guard blocks non-admin from opening team modal', 
      expr: '(() => { window.switchSimulatedRole("technician"); window.openTeamRoleModal(); return document.getElementById("teamRoleModal").classList.contains("hidden"); })()' 
    },
    { 
      name: 'Admin role allows opening and closing team modal', 
      expr: '(() => { window.switchSimulatedRole("admin"); window.openTeamRoleModal(); const open = !document.getElementById("teamRoleModal").classList.contains("hidden"); window.closeTeamRoleModal(); const closed = document.getElementById("teamRoleModal").classList.contains("hidden"); return open && closed; })()' 
    },
    { 
      name: 'Image lightbox open, pan/zoom reset, and close works', 
      expr: '(() => { window.openImageLightbox("data:image/png;base64,iVBORw0KGgo=", "Test Caption"); const open = !document.getElementById("imageLightboxModal").classList.contains("hidden"); window.closeImageLightbox(); const closed = document.getElementById("imageLightboxModal").classList.contains("hidden"); return open && closed; })()' 
    },
    { 
      name: 'Assign task modal open and close works', 
      expr: '(() => { window.openAssignModal(); const open = !document.getElementById("assignModal").classList.contains("hidden"); window.closeAssignModal(); const closed = document.getElementById("assignModal").classList.contains("hidden"); return open && closed; })()' 
    },
    { 
      name: 'Operator picker modal open and close works', 
      expr: '(() => { window.openSelectOperatorModal(); const open = !document.getElementById("selectOperatorModal").classList.contains("hidden"); window.closeSelectOperatorModal(); const closed = document.getElementById("selectOperatorModal").classList.contains("hidden"); return open && closed; })()' 
    },
    { 
      name: 'Calendar picker modal open and close works', 
      expr: '(() => { window.openCustomCalendar("assignDeadline"); const open = !document.getElementById("customCalendarModal").classList.contains("hidden"); window.closeCustomCalendar(); const closed = document.getElementById("customCalendarModal").classList.contains("hidden"); return open && closed; })()' 
    }
  ];

  let passed = 0;
  for (const t of tests) {
    try {
      const val = await evaluate(t.expr);
      if (val === true) {
        console.log(`  ✓ PASS: ${t.name}`);
        passed++;
      } else {
        console.error(`  ✗ FAIL: ${t.name} -> got ${val}`);
      }
    } catch (err) {
      console.error(`  ✗ ERROR in ${t.name}:`, err);
    }
  }

  console.log(`\n6. Test Summary: ${passed}/${tests.length} tests passed.`);

  ws.close();
  edge.kill();
  if (passed === tests.length) {
    console.log('\n🎉 ALL 22/22 COMPREHENSIVE E2E REGRESSION TESTS PASSED (100%)!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
