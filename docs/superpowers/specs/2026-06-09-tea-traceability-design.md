# Dojateas — Hệ thống Truy xuất Nguồn gốc Trà

**Ngày:** 2026-06-09  
**Trạng thái:** Approved

---

## Tổng quan

Hệ thống cho phép người dùng quét QR code trên hộp trà để xem thông tin truy xuất nguồn gốc (ngày thu hái, sản xuất, vùng trồng...). Kết hợp với landing page giới thiệu thương hiệu.

**Phạm vi:**
- Landing page thương hiệu
- Trang trace công khai (quét QR → xem thông tin lô hàng)
- Admin panel nội bộ (nhập liệu, tạo QR)

---

## Kiến trúc

Một ứng dụng monolith duy nhất (TanStack Start, SSR), không tách frontend/backend.

```
/                    Landing page
/products            Danh sách sản phẩm
/trace/:batchId      Trang truy xuất công khai
/admin               Admin panel (protected)
/admin/batches       Quản lý lô hàng
/admin/qr/:id        Tạo & in QR code
```

### Cấu trúc thư mục

```
dojateas/
├── app/
│   ├── routes/
│   │   ├── index.tsx
│   │   ├── products.tsx
│   │   ├── trace.$batchId.tsx
│   │   └── admin/
│   ├── components/
│   └── db/
│       ├── schema.ts
│       └── queries/
├── public/
└── drizzle/
```

---

## Data Model

```sql
-- Sản phẩm (loại trà)
products
  id           uuid PK
  name         text
  description  text
  image_url    text
  created_at   timestamptz

-- Lô hàng sản xuất (mỗi lô = một QR)
batches
  id               uuid PK   -- batchId trong QR URL
  product_id       uuid FK → products.id
  harvest_date     date
  production_date  date
  expiry_date      date
  quantity         integer   -- số hộp trong lô
  status           text      -- 'active' | 'recalled'
  created_at       timestamptz

-- Chi tiết mở rộng (key-value, dễ thêm trường sau)
batch_details
  id          uuid PK
  batch_id    uuid FK → batches.id
  key         text        -- "origin_region", "altitude", "farmer_name"...
  value       text
  media_url   text        -- ảnh hoặc video (nullable)
```

**Ghi chú thiết kế:**
- `batch_details` dùng key-value để thêm thông tin mới mà không cần thay đổi schema
- `status = 'recalled'` hiển thị banner cảnh báo khi người dùng quét QR
- `batchId` là UUID — không thể đoán hoặc brute-force

---

## Luồng chính

### Tạo lô hàng (Staff)

1. Đăng nhập `/admin`
2. Tạo hoặc chọn sản phẩm
3. Nhập thông tin lô: harvest_date, production_date, expiry_date, quantity
4. Thêm batch_details: vùng trồng, độ cao, quy trình, ảnh...
5. Lưu → hệ thống tự sinh UUID làm batchId
6. Truy cập `/admin/qr/:batchId` → tải PNG QR code → in lên hộp

### Truy xuất nguồn gốc (Người dùng)

1. Quét QR code trên hộp
2. Trình duyệt mở `https://dojateas.vn/trace/<batchId>`
3. Trang hiển thị:
   - Tên sản phẩm + ảnh
   - Thông tin lô (thu hái, sản xuất, hạn sử dụng)
   - Chi tiết mở rộng dạng card/timeline
   - Nếu `status = 'recalled'`: banner cảnh báo đỏ

---

## Tech Stack

| Layer | Công nghệ |
|---|---|
| Framework | TanStack Start (SSR) |
| Database ORM | Drizzle ORM + PostgreSQL |
| Styling | Tailwind CSS v4 + shadcn/ui |
| QR Generation | `qrcode` npm package (server-side) |
| Auth (admin) | Better Auth — email/password |
| Deploy | TBD (Vercel + Neon/Supabase là lựa chọn đang cân nhắc) |

---

## Phạm vi ngoài (để sau)

- App di động
- Tài khoản đối tác (nhà vườn tự nhập liệu)
- Loyalty program / lịch sử quét của người dùng
- Ảnh người thu hái, video quy trình (có thể thêm qua batch_details)
- Chứng nhận chất lượng

---

## Mở rộng trong tương lai

Mọi thông tin thêm (ảnh, video, tên người thu hái, chứng nhận) đều có thể thêm vào `batch_details` mà không cần thay đổi schema. Deploy strategy sẽ được quyết định sau khi có thêm thông tin về yêu cầu vận hành.
