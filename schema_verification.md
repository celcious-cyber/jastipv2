# Supabase Database Schema Verification

To ensure the Jastip Studio PWA functions correctly, please verify that your Supabase project has the following tables and columns:

## 1. `store_settings`
- `id` (int8, Primary Key, Identity)
- `store_name` (text)
- `store_slogan` (text)
- `is_premium` (boolean, default: true)
- `theme_color_primary` (text, e.g., '#c67156')
- `theme_color_secondary` (text)
- `bank_account` (text)
- `wa_closing` (text)
- `created_at` (timestamptz)

## 2. `store_users`
- `id` (uuid, Primary Key, Default: gen_random_uuid())
- `user_id` (uuid, References auth.users.id)
- `store_id` (int8, References store_settings.id)
- `role` (text) — values: 'admin', 'staff'
- `status` (text) — values: 'active', 'inactive'

## 3. `inventory` (Stok Tetap)
- `id` (uuid, Primary Key)
- `store_id` (int8, References store_settings.id)
- `item_name` (text)
- `brand` (text)
- `price` (numeric)
- `hpp` (numeric)
- `stock_qty` (int4)

## 4. `live_events` (🎙️ Live Event)
- `id` (uuid, Primary Key)
- `store_id` (int8, References store_settings.id)
- `title` (text)
- `location` (text)
- `duration` (text)
- `status` (text) — values: 'active', 'closed'
- `created_at` (timestamptz)

## 5. `event_items` (Katalog Live)
- `id` (uuid, Primary Key)
- `event_id` (uuid, References live_events.id)
- `item_name` (text)
- `brand_name` (text)
- `price` (numeric)
- `cost_price` (numeric)
- `stock_qty` (int4)
- `image_url` (text) — **New: Storage URL**
- `image_data` (text) — *Legacy: Base64*

## 6. `event_grabs` (Data Ambil)
- `id` (uuid, Primary Key)
- `event_id` (uuid, References live_events.id)
- `event_item_id` (uuid, References event_items.id)
- `customer_name` (text)
- `customer_phone` (text)
- `customer_address` (text)
- `qty` (int4)
- `created_at` (timestamptz)

## 7. `customers`
- `id` (uuid, Primary Key)
- `store_id` (int8, References store_settings.id)
- `name` (text)
- `phone` (text)
- `address` (text)

## 8. `orders`
- `id` (uuid, Primary Key)
- `store_id` (int8, References store_settings.id)
- `customer_id` (uuid, References customers.id)
- `items` (jsonb) — Array of { name, price, qty }
- `total_price` (numeric)
- `status` (text) — values: 'unpaid', 'packing', 'completed'

---

> [!TIP]
> **Supabase Storage**: Jangan lupa untuk membuat bucket bernama **`event-images`** di tab Storage dan buat kebijakan (Policy) agar publik dapat melihat (SELECT) gambar tersebut.
