# Shopee Affiliate Video Bot

เว็บแอปสำหรับ:
1. ค้นหา/จัดอันดับสินค้า affiliate ของ Shopee ตาม **ยอดขาย** (ถ่วงน้ำหนักด้วยคอมมิชชั่น)
2. สร้างวิดีโอโปรโมทสั้น (แนวตั้ง 1080x1920) จากภาพสินค้าอัตโนมัติ พร้อมแคปชั่นและลิงก์ affiliate

## เริ่มใช้งาน

```bash
npm install
cp .env.example .env
npm start
```

เปิดเบราว์เซอร์ที่ `http://localhost:3000`

หากยังไม่ได้ใส่ `SHOPEE_APP_ID` / `SHOPEE_API_KEY` ใน `.env` แอปจะใช้ **mock data** ให้ทดสอบระบบได้ทันที (มี badge สีเหลืองบอกไว้)

## วิธีเชื่อมต่อ Shopee Affiliate API จริง

1. สมัคร Shopee Affiliate ที่ affiliate.shopee.co.th (หรือโดเมนของประเทศคุณ)
2. ในแดชบอร์ด ไปที่เมนู **Open API** → กด Generate เพื่อรับ **App ID** และ **API Key**
3. ใส่ค่าใน `.env`
4. ตรวจสอบ `GRAPHQL_ENDPOINT` ใน `server.js` ให้ตรงกับโดเมนบัญชีของคุณ (เช่น `.co.th`, `.com.br` ฯลฯ) — ดูจากเอกสารในหน้า Open API ของคุณเอง เพราะ endpoint/พารามิเตอร์อาจต่างกันตามภูมิภาคและมีการอัปเดตเป็นระยะ
5. ตรวจสอบชื่อฟิลด์ query (`productOfferV2` ฯลฯ) กับเอกสารล่าสุดในแดชบอร์ดของคุณ เผื่อมีการเปลี่ยนแปลง schema

## Deploy ขึ้น cloud เพื่อเปิดใช้จากมือถือ (แนะนำ: Render.com, ฟรี)

ทำได้ทั้งหมดผ่านเบราว์เซอร์บนมือถือ ไม่ต้องมีคอมพิวเตอร์:

1. **อัปโหลดโค้ดขึ้น GitHub**
   - เปิด github.com บนมือถือ → สร้างบัญชี (ถ้ายังไม่มี) → กด "New repository" → ตั้งชื่อ เช่น `shopee-affiliate-bot`
   - กด "uploading an existing file" → เลือกไฟล์ทั้งหมดในโฟลเดอร์นี้ (ยกเว้น `node_modules` ถ้ามี) → Commit

2. **Deploy บน Render**
   - เปิด render.com → สมัคร/ล็อกอินด้วยบัญชี GitHub
   - กด "New +" → "Web Service" → เลือก repo ที่เพิ่งอัปโหลด
   - Render จะอ่านไฟล์ `render.yaml` และ `Dockerfile` ที่แนบมาให้อัตโนมัติ (มี ffmpeg ติดตั้งมาให้แล้ว)
   - ใส่ Environment Variables: `SHOPEE_APP_ID`, `SHOPEE_API_KEY` (ถ้ายังไม่มี ปล่อยว่างไว้ก่อนได้ แอปจะใช้ mock data)
   - กด "Create Web Service" — รอ build เสร็จประมาณ 2-5 นาที

3. **เข้าใช้งาน**
   - Render จะให้ URL แบบ `https://shopee-affiliate-bot.onrender.com` — เปิดจากเบราว์เซอร์มือถือได้เลย ใช้งานเหมือนกับที่รันในเครื่อง
   - ⚠️ Free tier ของ Render จะ sleep เมื่อไม่มีคนใช้ ครั้งแรกที่เปิดหลัง sleep จะช้าประมาณ 30-50 วิ

## เกี่ยวกับการโพสวิดีโอลง Shopee Video

**แอปนี้ไม่ได้ทำการโพสอัตโนมัติเข้าบัญชี Shopee Video ให้** เพราะ Shopee ไม่มี public API สำหรับสิ่งนี้ และการทำบอทเลียนแบบผู้ใช้เพื่ออัปโหลด (browser automation) จะผิดเงื่อนไขการใช้งานของแพลตฟอร์ม เสี่ยงบัญชีถูกระงับ

สิ่งที่แอปทำให้แทน: เตรียมไฟล์วิดีโอ (.mp4), แคปชั่น, และลิงก์สินค้าให้พร้อม 100% — เหลือแค่คุณกดอัปโหลดเข้า Shopee Video ผ่านแอปมือถือเอง (ใช้เวลาไม่กี่วินาทีต่อคลิป) หรือตรวจสอบว่า Shopee Creator/Seller Center มีฟีเจอร์ bulk upload อย่างเป็นทางการให้ใช้ในบัญชีของคุณหรือไม่

## โครงสร้างโปรเจกต์

```
server.js          -> API: /api/products, /api/generate-video
public/index.html  -> หน้าเว็บ UI
videos/             -> วิดีโอที่สร้างเสร็จ (.mp4)
assets/             -> ไฟล์ภาพชั่วคราวระหว่างสร้างวิดีโอ
```

## ปรับแต่งรูปแบบวิดีโอ

แก้ไขฟังก์ชัน `buildVideo()` ใน `server.js` — ใช้ ffmpeg (`zoompan` + `drawtext`) สร้างเอฟเฟกต์ซูมภาพ (Ken Burns) พร้อมข้อความชื่อสินค้า/ราคา ความยาว 5 วินาทีต่อคลิป สามารถ:
- เปลี่ยนสี/ฟอนต์/ตำแหน่งข้อความใน `drawtext`
- เพิ่มเพลงประกอบด้วย `-i music.mp3` และ `-map` เสียงเข้าไป (ต้องใช้ไฟล์เพลงที่มีลิขสิทธิ์ถูกต้อง/royalty-free)
- ต่อหลายภาพเป็นสไลด์โชว์โดยวนลูป `buildVideo` แล้ว concat ด้วย ffmpeg
