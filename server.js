// server.js — Shopee Affiliate Product Finder + Auto Video Generator
const express = require("express");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/videos", express.static(path.join(__dirname, "videos")));

const APP_ID = process.env.SHOPEE_APP_ID || "";
const API_KEY = process.env.SHOPEE_API_KEY || "";
const HAS_CREDENTIALS = Boolean(APP_ID && API_KEY);
const GRAPHQL_ENDPOINT = "https://open-api.affiliate.shopee.co.th/graphql"; // ปรับตามโดเมนประเทศของบัญชีคุณ

// ---------- Shopee Affiliate GraphQL signing (HMAC-SHA256) ----------
function buildSignedHeaders(payload) {
  const timestamp = Math.floor(Date.now() / 1000);
  const factorStr = `${APP_ID}${timestamp}${payload}${API_KEY}`;
  const signature = crypto.createHash("sha256").update(factorStr).digest("hex");
  return {
    "Content-Type": "application/json",
    Authorization: `SHA256 Credential=${APP_ID}, Timestamp=${timestamp}, Signature=${signature}`,
  };
}

async function fetchRealProducts({ keyword = "", sortType = 2, limit = 20 }) {
  // sortType: Shopee productOfferV2 sort — 2 = sales desc (ตรวจสอบค่าจริงจากเอกสาร Open API ของคุณ)
  const query = `
    query {
      productOfferV2(keyword: "${keyword}", sortType: ${sortType}, limit: ${limit}) {
        nodes {
          itemId
          productName
          commissionRate
          sales
          priceMin
          priceMax
          imageUrl
          offerLink
          ratingStar
        }
      }
    }
  `;
  const payload = JSON.stringify({ query });
  const headers = buildSignedHeaders(payload);
  const res = await fetch(GRAPHQL_ENDPOINT, { method: "POST", headers, body: payload });
  if (!res.ok) throw new Error(`Shopee API error: ${res.status}`);
  const json = await res.json();
  return json?.data?.productOfferV2?.nodes || [];
}

// ---------- Mock data (ใช้ตอนยังไม่มี App ID / API Key) ----------
function getMockProducts() {
  return [
    { itemId: "1001", productName: "หูฟังบลูทูธไร้สาย TWS เบสหนัก กันน้ำ", commissionRate: "12%", sales: 15420, priceMin: 199, priceMax: 199, imageUrl: "https://picsum.photos/seed/earbuds/600/600", offerLink: "https://s.shopee.co.th/mock1", ratingStar: 4.7 },
    { itemId: "1002", productName: "แผ่นแปะสิว Hydrocolloid 36 ชิ้น", commissionRate: "18%", sales: 9830, priceMin: 39, priceMax: 39, imageUrl: "https://picsum.photos/seed/skincare/600/600", offerLink: "https://s.shopee.co.th/mock2", ratingStar: 4.9 },
    { itemId: "1003", productName: "ที่รัดผมกันลื่น เซ็ต 10 ชิ้น", commissionRate: "15%", sales: 7200, priceMin: 59, priceMax: 59, imageUrl: "https://picsum.photos/seed/hair/600/600", offerLink: "https://s.shopee.co.th/mock3", ratingStar: 4.6 },
    { itemId: "1004", productName: "ขวดน้ำสูญญากาศเก็บความเย็น 24 ชม.", commissionRate: "10%", sales: 6120, priceMin: 149, priceMax: 149, imageUrl: "https://picsum.photos/seed/bottle/600/600", offerLink: "https://s.shopee.co.th/mock4", ratingStar: 4.8 },
    { itemId: "1005", productName: "ไฟ LED USB หนีบโต๊ะอ่านหนังสือ", commissionRate: "20%", sales: 5400, priceMin: 89, priceMax: 89, imageUrl: "https://picsum.photos/seed/led/600/600", offerLink: "https://s.shopee.co.th/mock5", ratingStar: 4.5 },
  ];
}

// ---------- API: list/rank products ----------
app.get("/api/products", async (req, res) => {
  try {
    const keyword = req.query.keyword || "";
    let products;
    if (HAS_CREDENTIALS) {
      products = await fetchRealProducts({ keyword, sortType: 2, limit: 30 });
    } else {
      products = getMockProducts();
    }
    // จัดอันดับ "สินค้าขายดี": เรียงตามยอดขาย แล้วถ่วงด้วยคอมมิชชั่น
    const ranked = products
      .map((p) => ({
        ...p,
        score: Number(p.sales || 0) * (1 + parseFloat(p.commissionRate) / 100 || 0),
      }))
      .sort((a, b) => b.score - a.score);
    res.json({ source: HAS_CREDENTIALS ? "shopee_api" : "mock", products: ranked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- API: generate video for a product ----------
app.post("/api/generate-video", async (req, res) => {
  try {
    const { itemId, productName, priceMin, commissionRate, imageUrl } = req.body;
    if (!itemId || !productName || !imageUrl) {
      return res.status(400).json({ error: "missing product fields" });
    }
    const outFile = path.join(__dirname, "videos", `${itemId}.mp4`);
    await buildVideo({ productName, price: priceMin, commissionRate, imageUrl, outFile });
    res.json({
      videoUrl: `/videos/${itemId}.mp4`,
      caption: buildCaption(productName, priceMin, commissionRate),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

function buildCaption(name, price, commissionRate) {
  return `🔥 ${name}\n💸 เริ่มต้นเพียง ฿${price}\n✅ สินค้าขายดี รีวิวดี\n👉 กดลิงก์ในไบโอ/แคปชั่นเพื่อสั่งซื้อ\n#shopee #ของมันต้องมี #รีวิวสินค้า`;
}

// ---------- Video builder: image + Ken Burns zoom + text overlay + royalty-free-style tone ----------
function buildVideo({ productName, price, commissionRate, imageUrl, outFile }) {
  return new Promise(async (resolve, reject) => {
    try {
      const tmpImg = path.join(__dirname, "assets", `${Date.now()}.jpg`);
      const imgRes = await fetch(imageUrl);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      fs.writeFileSync(tmpImg, buf);

      const safeText = productName.replace(/:/g, "").replace(/'/g, "").slice(0, 60);
      const priceText = `ราคา ${price} บาท`;

      // ffmpeg: zoompan (Ken Burns) 5 วินาที 720x1280 (แนวตั้งสำหรับ Shopee Video) + ข้อความ
      const args = [
        "-y",
        "-loop", "1",
        "-i", tmpImg,
        "-vf",
        `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,` +
        `zoompan=z='min(zoom+0.0015,1.2)':d=125:s=1080x1920:fps=25,` +
        `drawtext=text='${safeText}':fontcolor=white:fontsize=54:box=1:boxcolor=black@0.5:boxborderw=20:x=(w-text_w)/2:y=h-400,` +
        `drawtext=text='${priceText}':fontcolor=yellow:fontsize=64:box=1:boxcolor=black@0.5:boxborderw=20:x=(w-text_w)/2:y=h-280`,
        "-t", "5",
        "-pix_fmt", "yuv420p",
        outFile,
      ];
      execFile("ffmpeg", args, (error, stdout, stderr) => {
        fs.unlink(tmpImg, () => {});
        if (error) return reject(new Error(stderr.toString().slice(-500)));
        resolve();
      });
    } catch (e) {
      reject(e);
    }
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Shopee affiliate app running on http://localhost:${PORT}`);
  console.log(HAS_CREDENTIALS ? "✅ ใช้ Shopee Affiliate API จริง" : "⚠️  ยังไม่ตั้งค่า SHOPEE_APP_ID/SHOPEE_API_KEY — ใช้ mock data อยู่");
});
