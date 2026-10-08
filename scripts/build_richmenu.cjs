const fs = require('fs');
const path = require('path');

const fontB64 = fs.readFileSync(path.join(__dirname, '..', 'prompt_bold_b64.txt'), 'utf8').trim();

const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<style>
  @font-face {
    font-family: 'Prompt';
    src: url('data:font/truetype;charset=utf-8;base64,${fontB64}') format('truetype');
    font-weight: 700;
    font-style: normal;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    width: 2500px;
    height: 1686px;
    overflow: hidden;
    font-family: 'Prompt', sans-serif;
    background: #020617;
    display: flex;
    flex-direction: column;
    user-select: none;
    -webkit-font-smoothing: antialiased;
  }

  /* ========================================================
     TOP AREA A: 2500 x 843 px (CHECK-IN)
     ======================================================== */
  .area-a {
    width: 2500px;
    height: 843px;
    position: relative;
    background: linear-gradient(135deg, #021a36 0%, #03437a 40%, #0284c7 100%);
    border-bottom: 6px solid #0f172a;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 140px;
    overflow: hidden;
  }

  .glow-a-right {
    position: absolute;
    right: 80px;
    top: 50%;
    transform: translateY(-50%);
    width: 850px;
    height: 850px;
    background: radial-gradient(circle, rgba(56, 189, 248, 0.45) 0%, rgba(2, 132, 199, 0.15) 55%, transparent 75%);
    pointer-events: none;
  }

  .glow-a-left {
    position: absolute;
    left: -100px;
    top: -100px;
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(14, 165, 233, 0.25) 0%, transparent 70%);
    pointer-events: none;
  }

  .a-content {
    position: relative;
    z-index: 10;
    max-width: 1550px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .a-badge {
    display: inline-flex;
    align-items: center;
    gap: 16px;
    background: rgba(255, 255, 255, 0.2);
    border: 3px solid rgba(255, 255, 255, 0.45);
    backdrop-filter: blur(14px);
    padding: 14px 40px;
    border-radius: 9999px;
    font-size: 36px;
    font-weight: 700;
    color: #e0f2fe;
    letter-spacing: 2px;
    margin-bottom: 24px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  }

  .dot-pulse {
    width: 18px;
    height: 18px;
    background: #38bdf8;
    border-radius: 50%;
    box-shadow: 0 0 16px #38bdf8;
  }

  .a-title {
    font-size: 185px;
    font-weight: 700;
    color: #ffffff;
    line-height: 1.1;
    letter-spacing: -2px;
    text-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
    margin-bottom: 18px;
  }

  .a-sub {
    font-size: 56px;
    font-weight: 700;
    color: #bae6fd;
    line-height: 1.35;
    margin-bottom: 34px;
    text-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }

  .a-touch {
    display: inline-flex;
    align-items: center;
    gap: 18px;
    background: rgba(255, 255, 255, 0.25);
    border: 3px solid rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(16px);
    padding: 16px 48px;
    border-radius: 9999px;
    font-size: 42px;
    font-weight: 700;
    color: #ffffff;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.25);
  }

  .a-touch svg {
    width: 38px;
    height: 38px;
    stroke: #ffffff;
    stroke-width: 3.5;
    fill: none;
  }

  .a-art-wrap {
    position: relative;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .art-circle {
    width: 480px;
    height: 480px;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.05) 100%);
    border: 5px solid rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(24px);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 35px 80px rgba(0, 0, 0, 0.45);
  }


  /* ========================================================
     BOTTOM ROW: 2 EQUAL BLOCKS (1250 x 843 px)
     ======================================================== */
  .bottom-row {
    width: 2500px;
    height: 843px;
    display: flex;
  }

  /* AREA B: Bottom-Left (1250 x 843 px) */
  .area-b {
    width: 1250px;
    height: 843px;
    position: relative;
    background: linear-gradient(145deg, #022c1e 0%, #065f46 50%, #059669 100%);
    border-right: 6px solid #0f172a;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 60px;
    text-align: center;
    overflow: hidden;
  }

  .glow-b {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 850px;
    height: 850px;
    background: radial-gradient(circle, rgba(16, 185, 129, 0.35) 0%, transparent 65%);
    pointer-events: none;
  }

  /* AREA C: Bottom-Right (1250 x 843 px) */
  .area-c {
    width: 1250px;
    height: 843px;
    position: relative;
    background: linear-gradient(145deg, #150f38 0%, #3730a3 50%, #4f46e5 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 60px;
    text-align: center;
    overflow: hidden;
  }

  .glow-c {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 850px;
    height: 850px;
    background: radial-gradient(circle, rgba(129, 140, 248, 0.35) 0%, transparent 65%);
    pointer-events: none;
  }

  .bot-inner {
    position: relative;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .bot-icon-plate {
    width: 250px;
    height: 250px;
    margin-bottom: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bot-title {
    font-size: 135px;
    font-weight: 700;
    color: #ffffff;
    line-height: 1.15;
    letter-spacing: -1.5px;
    text-shadow: 0 10px 32px rgba(0, 0, 0, 0.6);
    margin-bottom: 14px;
  }

  .bot-sub {
    font-size: 52px;
    font-weight: 700;
    line-height: 1.35;
    margin-bottom: 28px;
    text-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }

  .sub-emerald {
    color: #a7f3d0;
  }

  .sub-violet {
    color: #c7d2fe;
  }

  .bot-touch {
    display: inline-flex;
    align-items: center;
    gap: 16px;
    background: rgba(255, 255, 255, 0.22);
    border: 3px solid rgba(255, 255, 255, 0.55);
    backdrop-filter: blur(14px);
    padding: 16px 48px;
    border-radius: 9999px;
    font-size: 38px;
    font-weight: 700;
    color: #ffffff;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  }

  .bot-touch svg {
    width: 34px;
    height: 34px;
    stroke: #ffffff;
    stroke-width: 3.5;
    fill: none;
  }

</style>
</head>
<body>

  <!-- =========================================
       AREA A: บนเต็มจอ (2500 x 843 px) - CHECK-IN
       ========================================= -->
  <div class="area-a">
    <div class="glow-a-right"></div>
    <div class="glow-a-left"></div>

    <div class="a-content">
      <div class="a-badge">
        <span class="dot-pulse"></span>
        <span>ระบบบันทึกเวลา • FORESEE TECH</span>
      </div>
      <div class="a-title">เช็กอินหน้างาน</div>
      <div class="a-sub">บันทึกเวลาเข้างาน • ระบุพิกัด GPS • ถ่ายรูปยืนยัน</div>
      <div class="a-touch">
        <span>แตะเพื่อเริ่มเช็กอิน</span>
        <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </div>
    </div>

    <div class="a-art-wrap">
      <div class="art-circle">
        <!-- 3D GPS Pin Illustration with Ripple Rays -->
        <svg width="400" height="400" viewBox="0 0 300 300">
          <defs>
            <linearGradient id="pinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#38bdf8"/>
              <stop offset="45%" stop-color="#0284c7"/>
              <stop offset="100%" stop-color="#0369a1"/>
            </linearGradient>
            <linearGradient id="pinGleam" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85"/>
              <stop offset="60%" stop-color="#ffffff" stop-opacity="0"/>
            </linearGradient>
            <filter id="glow3d" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="24" stdDeviation="18" flood-color="#000000" flood-opacity="0.5"/>
            </filter>
          </defs>

          <!-- Outer Radar Rings -->
          <circle cx="150" cy="140" r="130" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="3" stroke-dasharray="12 12"/>
          <circle cx="150" cy="140" r="105" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.3)" stroke-width="4"/>

          <!-- The 3D Pin -->
          <g filter="url(#glow3d)">
            <path d="M150 25 C100 25 60 65 60 115 C60 172 150 260 150 260 C150 260 240 172 240 115 C240 65 200 25 150 25 Z" fill="url(#pinGrad)" stroke="#ffffff" stroke-width="6"/>
            <path d="M150 30 C105 30 70 65 70 110 C70 155 130 225 150 245 C150 245 150 30 150 30 Z" fill="url(#pinGleam)"/>
            <circle cx="150" cy="112" r="38" fill="#ffffff" filter="url(#glow3d)"/>
            <circle cx="150" cy="112" r="22" fill="#0284c7"/>
          </g>
        </svg>
      </div>
    </div>
  </div>

  <!-- =========================================
       BOTTOM ROW: 2 ช่องเท่ากัน (1250 x 843 px each)
       ========================================= -->
  <div class="bottom-row">

    <!-- AREA B: ล่างซ้าย (1250 x 843 px) -->
    <div class="area-b">
      <div class="glow-b"></div>
      <div class="bot-inner">
        <div class="bot-icon-plate">
          <!-- 3D Progress Growth & Verified Checkmark -->
          <svg width="240" height="240" viewBox="0 0 200 200">
            <defs>
              <linearGradient id="barG1" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#a7f3d0"/>
                <stop offset="100%" stop-color="#34d399"/>
              </linearGradient>
              <linearGradient id="barG2" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#6ee7b7"/>
                <stop offset="100%" stop-color="#10b981"/>
              </linearGradient>
              <linearGradient id="barG3" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#ffffff"/>
                <stop offset="100%" stop-color="#34d399"/>
              </linearGradient>
              <filter id="botShadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="16" stdDeviation="12" flood-color="#000000" flood-opacity="0.45"/>
              </filter>
            </defs>
            <circle cx="100" cy="100" r="92" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.4)" stroke-width="4"/>
            <rect x="40" y="105" width="28" height="55" rx="14" fill="url(#barG1)" filter="url(#botShadow)"/>
            <rect x="85" y="75" width="28" height="85" rx="14" fill="url(#barG2)" filter="url(#botShadow)"/>
            <rect x="130" y="45" width="28" height="115" rx="14" fill="url(#barG3)" filter="url(#botShadow)"/>
            <circle cx="145" cy="138" r="38" fill="#ffffff" stroke="#10b981" stroke-width="4" filter="url(#botShadow)"/>
            <path d="M132 138 L142 148 L159 128" fill="none" stroke="#059669" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>

        <div class="bot-title">อัปเดต & ปิดงาน</div>
        <div class="bot-sub sub-emerald">ส่ง % ความคืบหน้า • แนบรูปถ่าย • เช็กเอาต์</div>
        <div class="bot-touch">
          <span>แตะเพื่อรายงานผล</span>
          <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </div>
      </div>
    </div>

    <!-- AREA C: ล่างขวา (1250 x 843 px) -->
    <div class="area-c">
      <div class="glow-c"></div>
      <div class="bot-inner">
        <div class="bot-icon-plate">
          <!-- 3D Task Dispatch Board -->
          <svg width="240" height="240" viewBox="0 0 200 200">
            <defs>
              <linearGradient id="boardGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#ffffff"/>
                <stop offset="100%" stop-color="#c7d2fe"/>
              </linearGradient>
              <linearGradient id="clipGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#fde047"/>
                <stop offset="100%" stop-color="#eab308"/>
              </linearGradient>
            </defs>
            <circle cx="100" cy="100" r="92" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.4)" stroke-width="4"/>
            <rect x="52" y="42" width="96" height="128" rx="20" fill="url(#boardGrad2)" filter="url(#botShadow)"/>
            <rect x="74" y="28" width="52" height="28" rx="8" fill="url(#clipGrad2)" stroke="#ffffff" stroke-width="3"/>
            <rect x="68" y="78" width="52" height="11" rx="5" fill="#4338ca"/>
            <rect x="68" y="104" width="58" height="11" rx="5" fill="#4338ca"/>
            <rect x="68" y="130" width="38" height="11" rx="5" fill="#4338ca"/>
            <circle cx="145" cy="138" r="36" fill="#4f46e5" stroke="#ffffff" stroke-width="5" filter="url(#botShadow)"/>
            <path d="M134 138 L142 146 L157 129" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>

        <div class="bot-title">มอบหมายงาน</div>
        <div class="bot-sub sub-violet">ดูรายการงาน • สั่งงานช่าง • ติดตามสด</div>
        <div class="bot-touch">
          <span>แตะเพื่อดูงานทั้งหมด</span>
          <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </div>
      </div>
    </div>

  </div>

</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, '..', 'richmenu_perfect.html'), html);
console.log('richmenu_perfect.html updated successfully with premium layout & Prompt font.');
