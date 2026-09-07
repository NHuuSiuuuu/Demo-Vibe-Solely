# Thiết kế tìm kiếm sản phẩm bằng hình ảnh với Gemini

Ngày: 2026-09-07  
Phạm vi: Solely storefront, backend sản phẩm, database và Kho tri thức AI

## Mục tiêu

Cho phép khách hàng bấm biểu tượng camera cạnh ô tìm kiếm sản phẩm, chọn ảnh có sẵn hoặc chụp ảnh trực tiếp bằng điện thoại, sau đó nhận danh sách giày giống nhất trong catalog Solely.

Tính năng dùng embedding trực tiếp của ảnh, không chuyển ảnh thành mô tả text làm cơ chế tìm kiếm chính. API key Gemini chỉ được dùng ở backend.

## Bối cảnh hiện tại

- Frontend dùng React/Vite.
- Backend dùng Node.js/Express.
- Ảnh sản phẩm được lưu qua Cloudinary và metadata nằm trong `product_images`.
- Hệ thống đã có `rag_chunks.embedding vector(768)` cho RAG text.
- Gemini client hiện dùng `gemini-embedding-001` cho text embedding.
- Trang catalog hiện có ô tìm kiếm chữ trong `ProductListPage.jsx`.
- Admin đã có trang `/admin/rag` để theo dõi và reindex tri thức.

Gemini Embedding 2 hỗ trợ input ảnh và text trong cùng một không gian embedding, với dimension khuyến nghị 768; ảnh PNG và JPEG được hỗ trợ. Tham khảo tài liệu chính thức:

- https://ai.google.dev/gemini-api/docs/embeddings
- https://ai.google.dev/gemini-api/docs/models/gemini-embedding-2

## Thiết kế được chọn

### 1. Trải nghiệm khách hàng

Trong khu vực tìm kiếm của catalog, thêm nút camera cạnh input tìm kiếm. Nút này mở một file input ảnh với `accept="image/jpeg,image/png"` và `capture="environment"`.

- Trên điện thoại, trình duyệt có thể mở camera sau để chụp.
- Trên máy tính, trình duyệt mở file picker.
- Sau khi chọn ảnh, frontend hiển thị preview và trạng thái đang tìm.
- Frontend gửi ảnh lên API bằng `multipart/form-data`.
- Kết quả thay thế danh sách catalog hiện tại và hiển thị điểm tương đồng nếu backend trả về.
- Người dùng vẫn có thể áp dụng giá, thương hiệu, giới tính, size và màu sau khi tìm bằng ảnh.
- Có nút xóa ảnh để quay lại tìm kiếm chữ/bộ lọc thông thường.

Không bắt buộc đăng nhập để tìm kiếm bằng ảnh.

### 2. Lưu embedding ảnh sản phẩm

Tạo bảng riêng, không dùng chung `rag_chunks`, để tách retrieval ảnh khỏi chatbot RAG text:

```sql
product_image_embeddings
- id BIGSERIAL PRIMARY KEY
- product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE
- product_image_id BIGINT NOT NULL REFERENCES product_images(id) ON DELETE CASCADE
- embedding vector(768)
- embedding_model TEXT NOT NULL
- status TEXT NOT NULL DEFAULT 'active'
- error_message TEXT
- created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

Ràng buộc và index:

- `UNIQUE (product_image_id, embedding_model)` để reindex không tạo bản ghi trùng.
- Check `status` chỉ nhận `active`, `needs_reindex`, `error`.
- `embedding` nullable để có thể lưu `status = 'error'` khi Gemini lỗi trước khi tạo được vector; check `status <> 'active' OR embedding IS NOT NULL` bắt buộc vector với bản ghi active.
- `product_images` có unique key `(id, product_id)` và bảng embedding có composite foreign key `(product_image_id, product_id)` để không thể ghép ảnh của sản phẩm này với `product_id` của sản phẩm khác.
- Index theo `product_id`, `product_image_id`, `status`.
- Vector index cosine chỉ được tạo khi database có `pgvector`.

Một sản phẩm có thể có nhiều ảnh. Khi truy vấn, kết quả được gom theo `product_id` và chỉ giữ điểm cao nhất của mỗi sản phẩm.

### 3. Indexing ảnh sản phẩm

Khi admin upload ảnh mới:

```text
Cloudinary upload thành công
→ lưu product_images
→ tải bytes ảnh từ URL phía backend
→ gọi Gemini Embedding 2
→ lưu vector vào product_image_embeddings
```

Khi xóa ảnh, embedding liên quan được xóa nhờ foreign key hoặc service đồng bộ. Khi cập nhật/ẩn/xóa sản phẩm, embedding không được dùng trong kết quả sản phẩm active.

Admin `/admin/rag` bổ sung:

- Tổng số ảnh đã index.
- Số ảnh lỗi hoặc cần reindex.
- Model/dimension đang dùng.
- Nút reindex toàn bộ ảnh.
- Nút reindex ảnh của một sản phẩm.

Lỗi Gemini khi lưu sản phẩm không được làm rollback thao tác catalog; embedding được đánh dấu `error` để admin retry và theo dõi được.

### 4. API tìm kiếm bằng ảnh

```text
POST /api/products/search-by-image
Content-Type: multipart/form-data
Field: image
Optional fields: brand, gender, size, color, minPrice, maxPrice, limit
```

Luồng backend:

1. Kiểm tra field ảnh tồn tại.
2. Kiểm tra MIME chỉ cho phép JPEG/PNG.
3. Giới hạn kích thước request/ảnh.
4. Đọc ảnh trong memory, không lưu ảnh truy vấn của khách.
5. Gọi Gemini Embedding 2 với inline image data.
6. Truy vấn cosine similarity trên `product_image_embeddings`.
7. Chỉ lấy sản phẩm đang active và ảnh/vector đang active.
8. Gom theo sản phẩm, giữ similarity cao nhất.
9. Áp dụng các filter catalog nếu có.
10. Trả tối đa 12 sản phẩm theo điểm giảm dần.

Response gồm:

```json
{
  "products": [],
  "query": { "type": "image" },
  "threshold": 0.35
}
```

Nếu không có kết quả vượt threshold, trả danh sách rỗng với thông báo phù hợp; không tự trả sản phẩm ngẫu nhiên.

### 5. Gemini client

Mở rộng client hiện tại thành hai chức năng rõ ràng:

- `embedText(text)` cho RAG policy/catalog hiện tại.
- `embedImage({ data, mimeType })` cho visual search.

Model ảnh mặc định là `gemini-embedding-2`, cấu hình bằng `GEMINI_IMAGE_EMBEDDING_MODEL`, dimension mặc định 768 bằng `GEMINI_EMBEDDING_DIMENSION`.

Nếu model ảnh chưa được cấu hình hoặc API trả lỗi, API search trả lỗi có mã ổn định để frontend hiển thị hướng dẫn thử lại. Không trả stack trace, API key hoặc prompt nội bộ.

### 6. Bảo mật, chi phí và quyền riêng tư

- Gemini key chỉ nằm trong backend environment.
- Ảnh query không lưu lâu dài.
- Giới hạn kích thước, loại file và thời gian xử lý.
- Không log base64 hoặc bytes ảnh.
- Không đưa URL Cloudinary private hoặc API key vào response.
- Reindex toàn bộ phải là thao tác admin và có trạng thái tiến trình/lỗi rõ ràng.
- Không để lỗi image embedding làm hỏng chatbot RAG text hoặc catalog text search.

## Phạm vi không làm trong đợt này

- Không xây camera preview tùy chỉnh bằng `getUserMedia`; dùng file input với `capture` để giảm độ phức tạp.
- Không lưu lịch sử ảnh tìm kiếm.
- Không nhận video hoặc PDF.
- Không thay thế text RAG hiện tại.
- Không thêm bộ lọc AI tự suy luận ngoài filter catalog có sẵn.

## Kiểm thử và tiêu chí nghiệm thu

### Backend

- Tạo bảng/migration chạy được trên database mới và database đã có dữ liệu.
- Migration được chạy hai lần trên PostgreSQL/pgvector thật, giữ nguyên một sentinel row, và kiểm tra status invalid, duplicate key, cascade, vector dimension 768 cùng cosine opclass qua `pg_catalog`.
- Embed ảnh thành công tạo đúng vector 768 chiều.
- Reindex lặp không tạo bản ghi trùng.
- Upload ảnh lỗi MIME/kích thước bị từ chối.
- Search trả sản phẩm theo similarity, gom nhiều ảnh cùng sản phẩm đúng.
- Không trả sản phẩm hidden.
- Filter giá/thương hiệu/size/màu vẫn hoạt động sau image search.
- Gemini lỗi không làm hỏng create/update sản phẩm.
- Endpoint không làm lộ key, base64 hoặc stack trace.

### Frontend

- Nút camera nằm cạnh ô tìm kiếm và có accessible label tiếng Việt.
- Chọn file trên desktop hoạt động.
- `capture="environment"` có mặt cho mobile camera.
- Có preview, loading, lỗi, empty state và nút xóa ảnh.
- Kết quả ảnh render cùng `ProductCard` hiện tại.
- Text search và filter cũ không bị phá.

### Kiểm chứng cuối

- Server tests.
- Client tests.
- Client build.
- `git diff --check`.
- Kiểm tra API thật khi `GEMINI_API_KEY` và pgvector đã cấu hình.
- Ghi rõ nếu local chưa có pgvector hoặc Gemini API không thể chạy live.
