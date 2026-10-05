const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Read Foresee Logo as Base64
let logoBase64 = '';
try {
  const logoBuf = fs.readFileSync(path.join(__dirname, '..', 'foresee-logo.png'));
  logoBase64 = `data:image/png;base64,${logoBuf.toString('base64')}`;
} catch (e) {
  console.warn('Could not read logo:', e.message);
}

// 2. HTML Content for Formal Technical Specification Document
const htmlContent = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>เอกสารสรุปรายละเอียดเทคโนโลยีและเครื่องมือที่ใช้พัฒนา - Foresee Field Operations v2.0</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Prompt:wght@400;500;600;700&display=swap');

    @page {
      size: A4 portrait;
      margin: 0;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Sarabun', 'Segoe UI', Tahoma, sans-serif;
      font-size: 13px;
      line-height: 1.6;
      color: #1e293b;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    h1, h2, h3, h4, .font-heading {
      font-family: 'Prompt', 'Sarabun', sans-serif;
    }

    /* Page container */
    .page {
      width: 210mm;
      height: 297mm;
      max-height: 297mm;
      padding: 22mm 24mm 16mm 24mm;
      box-sizing: border-box;
      page-break-after: always;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
    }

    .page:last-child {
      page-break-after: avoid;
    }

    /* Header */
    .doc-header {
      border-bottom: 2px solid #2563eb;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-img {
      height: 46px;
      object-fit: contain;
    }

    .header-text h1 {
      font-size: 18px;
      color: #0f172a;
      font-weight: 700;
      letter-spacing: -0.3px;
    }

    .header-text p {
      font-size: 11px;
      color: #64748b;
      font-weight: 500;
    }

    .doc-badge {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1d4ed8;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 600;
      text-align: right;
    }

    /* Metadata Box */
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 18px;
      margin-bottom: 18px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }

    .meta-item {
      font-size: 11px;
    }

    .meta-item .label {
      color: #64748b;
      font-weight: 500;
      margin-bottom: 2px;
      display: block;
    }

    .meta-item .val {
      color: #0f172a;
      font-weight: 700;
      font-size: 12px;
    }

    /* Sections */
    .section-title {
      font-size: 13.5px;
      font-weight: 700;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 1px solid #e2e8f0;
    }

    .section-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 6px;
      background: #2563eb;
      color: #ffffff;
      font-size: 11.5px;
    }

    /* Tech Cards */
    .tech-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 14px;
    }

    .tech-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.02);
    }

    .tech-card.highlight {
      border-left: 3.5px solid #2563eb;
      background: #f8fafc;
    }

    .tech-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
    }

    .tech-name {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
    }

    .tech-tag {
      font-size: 9px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 5px;
      background: #e2e8f0;
      color: #475569;
    }

    .tech-tag.blue { background: #dbeafe; color: #1e40af; }
    .tech-tag.green { background: #d1fae5; color: #065f46; }
    .tech-tag.amber { background: #fef3c7; color: #92400e; }
    .tech-tag.purple { background: #ede9fe; color: #5b21b6; }

    .tech-desc {
      font-size: 11px;
      color: #475569;
      line-height: 1.55;
    }

    /* Comparison Table */
    .spec-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-top: 10px;
      margin-bottom: 14px;
    }

    .spec-table th, .spec-table td {
      border: 1px solid #e2e8f0;
      padding: 8px 12px;
      text-align: left;
      line-height: 1.5;
    }

    .spec-table th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
    }

    .spec-table tr:nth-child(even) {
      background: #f8fafc;
    }

    /* Handover Summary Banner */
    .summary-callout {
      margin-top: 20px;
      padding: 16px 20px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #10b981;
      border-radius: 10px;
    }

    .summary-callout-title {
      font-weight: 700;
      font-size: 12.5px;
      color: #0f172a;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .summary-callout-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
    }

    .summary-callout-text {
      font-size: 11px;
      color: #475569;
      line-height: 1.6;
      margin: 0;
    }

    /* Footer */
    .doc-footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      margin-top: 16px;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
    }
  </style>
</head>
<body>

  <!-- ==================== PAGE 1 ==================== -->
  <div class="page">
    <div>
      <div class="doc-header">
        <div class="logo-container">
          ${logoBase64 ? `<img src="${logoBase64}" class="logo-img" alt="Foresee Technology">` : ''}
          <div class="header-text">
            <h1>Foresee Technology Co., Ltd.</h1>
            <p>ระบบมอบหมายงานและติดตามการปฏิบัติงานหน้างาน (Field Operations v2.0)</p>
          </div>
        </div>
        <div class="doc-badge">
          <div>เอกสารส่งมอบโครงการ</div>
          <div style="font-size: 10px; color: #64748b;">Technical Handover Specification</div>
        </div>
      </div>

      <div class="meta-box">
        <div class="meta-item">
          <span class="label">ชื่อระบบ (System Name)</span>
          <span class="val">Foresee Field Operations 2.0</span>
        </div>
        <div class="meta-item">
          <span class="label">วันที่ส่งมอบ (Handover Date)</span>
          <span class="val">5 ตุลาคม 2569</span>
        </div>
        <div class="meta-item">
          <span class="label">สถาปัตยกรรม (Architecture)</span>
          <span class="val">Vite Modular + Supabase Cloud</span>
        </div>
        <div class="meta-item">
          <span class="label">สถานะ (Project Status)</span>
          <span class="val" style="color: #059669;">พร้อมใช้งาน (Production Ready)</span>
        </div>
      </div>

      <!-- Section 1 -->
      <div class="section-title">
        <span class="section-icon">1</span>
        <span>ส่วนติดต่อผู้ใช้และเทคโนโลยีหน้าบ้าน (Frontend Technologies & Client-Side)</span>
      </div>

      <div class="tech-grid">
        <div class="tech-card highlight">
          <div class="tech-header">
            <span class="tech-name">Modular ES6+ & Vite v8.3</span>
            <span class="tech-tag blue">Core & Build</span>
          </div>
          <div class="tech-desc">
            สถาปัตยกรรมแยกโมดูลอิสระ (Modular JavaScript Architecture) พร้อมระบบคอมไพล์ Vite รองรับ HMR, Rollup Bundling และ Code Splitting อัตโนมัติ โหลดเร็ว ประมวลผลลื่นไหล ไม่ติดแคช
          </div>
        </div>

        <div class="tech-card highlight">
          <div class="tech-header">
            <span class="tech-name">Tailwind CSS v3.4 Responsive UI</span>
            <span class="tech-tag green">UI & Layout</span>
          </div>
          <div class="tech-desc">
            ออกแบบ Responsive เต็มรูปแบบ รองรับการแสดงผลสมบูรณ์แบบทั้งบนคอมพิวเตอร์หน้าจอขนาดใหญ่ และบนสมาร์ตโฟน (iOS / Android) ในโหมด LINE LIFF พร้อมปรับสเกลหน้าจออัตโนมัติ
          </div>
        </div>

        <div class="tech-card">
          <div class="tech-header">
            <span class="tech-name">HTML5 Canvas Image Compression</span>
            <span class="tech-tag amber">Media Engine</span>
          </div>
          <div class="tech-desc">
            อัลกอริทึมบีบอัดและปรับสัดส่วนภาพถ่ายหน้างานอัตโนมัติบนเครื่องลูกข่าย (Client-Side) ก่อนส่งขึ้นคลาวด์เซิร์ฟเวอร์ ลดขนาดไฟล์ลงกว่า 80% ป้องกันปัญหาอินเทอร์เน็ตหน้างานช้า
          </div>
        </div>

        <div class="tech-card">
          <div class="tech-header">
            <span class="tech-name">Interactive Lightbox Viewer</span>
            <span class="tech-tag purple">Media Viewer</span>
          </div>
          <div class="tech-desc">
            ระบบดูภาพถ่ายความละเอียดสูง รองรับคลิกซูม 1 คลิก (Click-to-zoom 2.2x), การหมุนลูกกลิ้งเมาส์, การลากเลื่อนดูภาพแบบอิสระไม่ติดขอบ และการใช้ 2 นิ้วขยายบนสมาร์ตโฟน (Pinch-to-zoom)
          </div>
        </div>
      </div>

      <!-- Section 2 -->
      <div class="section-title">
        <span class="section-icon">2</span>
        <span>การเชื่อมต่อระบบนิเวศ LINE Platform (LINE Integration & LIFF)</span>
      </div>

      <div class="tech-grid">
        <div class="tech-card">
          <div class="tech-header">
            <span class="tech-name">LINE Front-end Framework (LIFF SDK v2)</span>
            <span class="tech-tag green">Authentication</span>
          </div>
          <div class="tech-desc">
            ระบบ Single Sign-On (SSO) เชื่อมต่อและดึงข้อมูลโปรไฟล์ผู้ปฏิบัติงานผ่านบัญชี LINE อัตโนมัติ เพื่อบันทึกชื่อผู้ลงพื้นที่จริงโดยไม่ต้องพิมพ์ล็อกอินซ้ำ ลดขั้นตอนการทำงาน
          </div>
        </div>

        <div class="tech-card">
          <div class="tech-header">
            <span class="tech-name">Dynamic LINE Flex Message Cards</span>
            <span class="tech-tag green">LINE Cards</span>
          </div>
          <div class="tech-desc">
            การ์ดแจ้งเตือนผลงานแบบ Mega Bubble ปรับเปลี่ยนเฉดสีตามสถานะงานจริง: สีเขียว (ปิดงานสำเร็จ), สีแดงเตือนภัย (ติดปัญหาหน้างาน) และสีน้ำเงิน (อัปเดตความคืบหน้าระหว่างวัน)
          </div>
        </div>

        <div class="tech-card">
          <div class="tech-header">
            <span class="tech-name">Deep Link Action Routing Engine</span>
            <span class="tech-tag blue">Navigation</span>
          </div>
          <div class="tech-desc">
            ระบบส่งต่อพารามิเตอร์ผ่าน URL (Deep Linking) นำทางผู้ใช้ไปยังแท็บงานที่ต้องการทันที เช่น เปิดดูรายละเอียดงาน, หน้าเช็กอิน หรือหน้าปิดงาน พร้อมดึงข้อมูลเดิมขึ้นมาแสดงอัตโนมัติ
          </div>
        </div>

        <div class="tech-card">
          <div class="tech-header">
            <span class="tech-name">Mobile-First In-App Webview Engine</span>
            <span class="tech-tag purple">Mobile UX</span>
          </div>
          <div class="tech-desc">
            ออกแบบให้ทำงานบน In-App Browser ของ LINE ได้อย่างสมบูรณ์แบบ รองรับทั้งระบบปฏิบัติการ iOS และ Android โดยผู้ปฏิบัติงานไม่ต้องติดตั้งแอปพลิเคชันเพิ่มเติมลงในเครื่อง
          </div>
        </div>
      </div>
    </div>

    <div class="doc-footer">
      <span>Foresee Technology Co., Ltd. • Technical Specification Document</span>
      <span>หน้า 1 จาก 2</span>
    </div>
  </div>

  <!-- ==================== PAGE 2 ==================== -->
  <div class="page">
    <div>
      <div class="doc-header">
        <div class="logo-container">
          ${logoBase64 ? `<img src="${logoBase64}" class="logo-img" alt="Foresee Technology">` : ''}
          <div class="header-text">
            <h1>Foresee Technology Co., Ltd.</h1>
            <p>ระบบมอบหมายงานและติดตามการปฏิบัติงานหน้างาน (Field Operations v2.0)</p>
          </div>
        </div>
        <div class="doc-badge">
          <div>Technical Handover</div>
          <div style="font-size: 10px; color: #64748b;">Cloud & Security</div>
        </div>
      </div>

      <!-- Section 3 -->
      <div class="section-title">
        <span class="section-icon">3</span>
        <span>ฐานข้อมูลและโครงสร้างพื้นฐานคลาวด์ (Cloud Database & Storage Infrastructure)</span>
      </div>

      <div class="tech-grid">
        <div class="tech-card highlight">
          <div class="tech-header">
            <span class="tech-name">Supabase PostgreSQL 15</span>
            <span class="tech-tag blue">Database</span>
          </div>
          <div class="tech-desc">
            ฐานข้อมูลเชิงสัมพันธ์ประสิทธิภาพสูงบนระบบคลาวด์ จัดเก็บตารางงาน (tasks), บันทึกเช็กอิน-เช็กเอาต์ (checkins), ข้อมูลไทม์ไลน์ภาพถ่าย และรายชื่อผู้ปฏิบัติงาน (technicians)
          </div>
        </div>

        <div class="tech-card highlight">
          <div class="tech-header">
            <span class="tech-name">Supabase Realtime (WebSocket Engine)</span>
            <span class="tech-tag blue">Realtime Sync</span>
          </div>
          <div class="tech-desc">
            ระบบรับ-ส่งข้อมูลแบบสองทิศทาง (Bidirectional WebSockets) ซิงก์สถานะงาน เปอร์เซ็นต์ความคืบหน้า และภาพถ่าย ระหว่างคอมพิวเตอร์และมือถือทันทีแบบ 0-Latency โดยไม่ต้องกดรีเฟรชหน้าจอ
          </div>
        </div>

        <div class="tech-card">
          <div class="tech-header">
            <span class="tech-name">Supabase Storage Bucket (work-photos)</span>
            <span class="tech-tag amber">Cloud Storage</span>
          </div>
          <div class="tech-desc">
            ระบบจัดเก็บไฟล์รูปภาพหน้างานจริงใน Cloud Storage รองรับ Public CDN URL พร้อมระบบ Auto-cleanup ลบไฟล์ภาพออกจากถังทันทีเมื่อผู้ใช้กดลบรูปหรือลบงาน ป้องกันไฟล์ขยะตกค้าง
          </div>
        </div>

        <div class="tech-card">
          <div class="tech-header">
            <span class="tech-name">Google Apps Script (GAS) Dual Sync</span>
            <span class="tech-tag purple">Backup System</span>
          </div>
          <div class="tech-desc">
            ระบบสำรองข้อมูลคู่ขนานเข้าสู่ Google Sheets อัตโนมัติ เพื่อให้ฝ่ายบริหารสามารถดึงข้อมูลสรุปการปฏิบัติงานรายวันไปวิเคราะห์และทำรายงานย้อนหลังได้สะดวก
          </div>
        </div>
      </div>

      <!-- Section 4 -->
      <div class="section-title">
        <span class="section-icon">4</span>
        <span>การติดตั้ง ความปลอดภัย และการส่งมอบระบบ (DevOps & Deployment)</span>
      </div>

      <table class="spec-table">
        <thead>
          <tr>
            <th style="width: 28%;">หัวข้อ (Component)</th>
            <th style="width: 32%;">เทคโนโลยี / แพลตฟอร์ม</th>
            <th style="width: 40%;">รายละเอียดและมาตรฐานความปลอดภัย</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Production Hosting</strong></td>
            <td>Vercel Global Edge Network</td>
            <td>โฮสติ้งเซิร์ฟเวอร์ความเร็วสูงระดับโลก รองรับโหลดและการเปิดใช้งานพร้อมกันหลายอุปกรณ์</td>
          </tr>
          <tr>
            <td><strong>Version Control & CI/CD</strong></td>
            <td>Git & GitHub Automated Pipeline</td>
            <td>ระบบควบคุมเวอร์ชันซอร์สโค้ด และการคอมไพล์เพื่ออัปเดตเวอร์ชันโปรดักชันอัตโนมัติเมื่อพุชโค้ด</td>
          </tr>
          <tr>
            <td><strong>Data Security & Protocol</strong></td>
            <td>HTTPS / TLS 1.3 Encryption</td>
            <td>การเข้ารหัสข้อมูลทุกช่องทางระหว่างผู้ใช้งาน, LINE และคลาวด์เซิร์ฟเวอร์ ปลอดภัยตามมาตรฐานสากล</td>
          </tr>
          <tr>
            <td><strong>API & Integration</strong></td>
            <td>RESTful & WebSockets (JSON)</td>
            <td>สถาปัตยกรรม API มาตรฐาน สะอาด ปลอดภัย และรองรับการขยายระบบในอนาคต</td>
          </tr>
          <tr>
            <td><strong>Backup & Resilience</strong></td>
            <td>Cloud Storage & Google Sheets Dual Sync</td>
            <td>ระบบสำรองข้อมูลคู่ขนาน ป้องกันข้อมูลสูญหาย และอำนวยความสะดวกในการจัดทำรายงานย้อนหลัง</td>
          </tr>
        </tbody>
      </table>

      <!-- Handover Summary Callout -->
      <div class="summary-callout">
        <div class="summary-callout-title">
          <span class="summary-callout-dot"></span>
          <span>สรุปสถานะการส่งมอบระบบ (Handover Status & System Verification)</span>
        </div>
        <p class="summary-callout-text">
          ระบบ Foresee Field Operations v2.0 ได้รับการพัฒนา ติดตั้ง และผ่านการทดสอบฟังก์ชันการทำงานครบถ้วน (Full End-to-End Testing) ทั้งระบบจัดการงานมอบหมาย, การระบุพิกัดสถานที่ปฏิบัติงาน, การบีบอัดและอัปโหลดภาพถ่ายขึ้น Cloud Storage อัตโนมัติ, การแจ้งเตือน LINE Flex Message ตลอดจนระบบ Realtime Data Synchronization บนโครงสร้างพื้นฐาน Vercel Global Edge Network และ Supabase Cloud พร้อมเปิดให้บุคลากรใช้งานจริงได้ทันที
        </p>
      </div>
    </div>

    <div class="doc-footer">
      <span>Foresee Technology Co., Ltd. • Technical Specification Document</span>
      <span>หน้า 2 จาก 2</span>
    </div>
  </div>

</body>
</html>
`;

// 3. Write HTML to temporary file
const tempHtmlPath = path.join(__dirname, '..', 'handover_spec_temp.html');
fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');

// 4. Output PDF Paths
const projectPdfPath = path.join(__dirname, '..', 'Foresee_System_Specification_Handover.pdf');
const desktopPdfPath = path.join('C:', 'Users', 'golst', 'Desktop', 'Foresee_System_Specification_Handover.pdf');

console.log('Generating PDF using Microsoft Edge...');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const command = `"${edgePath}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${projectPdfPath}" "file:///${tempHtmlPath.replace(/\\\\/g, '/')}"`;

try {
  execSync(command, { stdio: 'inherit' });
  console.log('PDF created successfully at:', projectPdfPath);

  // Copy to Desktop
  fs.copyFileSync(projectPdfPath, desktopPdfPath);
  console.log('PDF copied to Desktop at:', desktopPdfPath);

  // Keep a copy of HTML for easy browser inspection
  const persistentHtmlPath = path.join(__dirname, '..', 'handover_spec.html');
  fs.copyFileSync(tempHtmlPath, persistentHtmlPath);

  // Take preview screenshots
  try {
    const screenshotCmd1 = `"${edgePath}" --headless --disable-gpu --window-size=980,1380 --screenshot="${path.join(__dirname, '..', 'preview_page1.png')}" "file:///${tempHtmlPath.replace(/\\\\/g, '/')}"`;
    execSync(screenshotCmd1, { stdio: 'ignore' });
    const screenshotCmd2 = `"${edgePath}" --headless --disable-gpu --window-size=980,2750 --screenshot="${path.join(__dirname, '..', 'preview_full.png')}" "file:///${tempHtmlPath.replace(/\\\\/g, '/')}"`;
    execSync(screenshotCmd2, { stdio: 'ignore' });
    console.log('Preview screenshots captured');
  } catch (e) {}

  // Clean up temp html
  fs.unlinkSync(tempHtmlPath);
} catch (err) {
  console.error('Failed to generate PDF:', err.message);
}
