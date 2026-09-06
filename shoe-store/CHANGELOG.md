# Changelog

File này ghi lại các thay đổi quan trọng của dự án để dễ theo dõi phần sản phẩm, code, database và triển khai sau này.

## Chưa phát hành

### Đã thêm

- Tạo MVP cửa hàng giày bằng React, Vite, Node.js, Express và hỗ trợ PostgreSQL.
- Thêm đăng ký/đăng nhập bằng email và mật khẩu, JWT session, phân quyền `customer` và `admin`.
- Thêm danh sách sản phẩm, trang chi tiết sản phẩm, tìm kiếm, bộ lọc, ảnh sản phẩm, size, màu và biến thể có tồn kho.
- Thêm giỏ hàng, checkout COD, tạo đơn hàng, lịch sử đơn hàng của khách và trang chi tiết đơn.
- Thêm dashboard admin để quản lý sản phẩm, biến thể, tồn kho và trạng thái đơn hàng.
- Thêm AI tư vấn sản phẩm dựa trên dữ liệu catalog, có fallback khi chưa cấu hình OpenAI API key.
- Thêm schema và seed database cho users, products, product images, variants, carts, orders, order items và AI chat messages.
- Thêm tài liệu setup local và tài khoản demo.
- Cài và cấu hình PostgreSQL local trên remote development server.
- Thêm script `database/localize-vietnamese-products.sql` để cập nhật dữ liệu sản phẩm PostgreSQL thật sang bộ sản phẩm Solely tiếng Việt mà không reset database.
- Thêm ảnh sản phẩm thật từ `images.unsplash.com` cho bộ sản phẩm Solely, thay cho ảnh placeholder.
- Thêm giao diện storefront phong cách editorial tối giản cho Solely, gồm hero carousel, hàng mới về, banner ưu đãi, bento sản phẩm bán chạy, Solely Journal, Instagram strip và footer nền tối.
- Thêm giao diện chi tiết sản phẩm mới với breadcrumb, đánh giá, quantity stepper, nút mua ngay, danh sách review và carousel sản phẩm liên quan.
- Thêm component `ImageStreamHero` cho hero trang Home với hiệu ứng hai luồng ảnh sneaker chạy theo chiều sâu/perspective.
- Thêm admin workspace riêng cho `/admin/*` với sidebar quản trị có icon, collapse, dark mode cục bộ, header admin và dashboard mở rộng.
- Thêm test bảo vệ để admin không render header, footer, nav, túi hàng và các page shell của người dùng.
- Thêm `AGENTS.md` ở root project để quy định workflow cho coding agent, gồm rule changelog, kiểm chứng, git và vị trí tài liệu.
- Thêm `DEVELOPMENT_PROMPT.md` ở root project để người dùng dán prompt phát triển và agent đọc trước khi lập kế hoạch hoặc code.
- Thêm giao diện chat bubble cho trợ lý mua sắm, gồm message log, bubble user/assistant, typing indicator và composer cố định trong panel.
- Thêm nút mở trợ lý mua sắm dạng tròn, chỉ dùng icon và có animation pulse.
- Thêm cấu hình mẫu `server/.env.example` cho `DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY` và `OPENAI_MODEL`.
- Thêm cấu hình mẫu Gemini/RAG trong `server/.env.example` và tài liệu nhắc không commit API key.
- Thêm catalog 20 sản phẩm Solely với mô tả giàu thông tin về mục đích sử dụng, chất liệu, đệm, độ bám, form chân và ngữ cảnh phù hợp để chuẩn bị cho chatbot RAG.
- Thêm spec thiết kế hệ thống RAG Gemini có trang quản trị `Kho tri thức AI`, dữ liệu sản phẩm, chính sách, điều khoản, vận chuyển, đổi trả và kiểm thử truy vấn trong admin.
- Thêm plan triển khai hệ thống RAG Gemini cho admin và chatbot, gồm schema, Gemini client, indexing, retrieval, admin API, admin UI, đồng bộ sản phẩm và kiểm chứng end-to-end.
- Thêm schema RAG gồm `rag_documents`, `rag_chunks`, pgvector `embedding vector(768)` và dữ liệu seed chính sách mặc định cho trợ lý AI Solely.
- Thêm Gemini client phía backend cho embedding và trả lời dựa trên ngữ cảnh RAG, cùng helper tạo nội dung/chia đoạn tri thức sản phẩm.
- Thêm service backend cho RAG indexing/retrieval bằng Gemini, gồm reindex sản phẩm, reindex tài liệu, reindex toàn bộ, truy xuất context và trả lời dựa trên nguồn tri thức.

### Đã thay đổi

- Thêm fallback database in-memory để review local khi chưa cấu hình `DATABASE_URL`.
- Cập nhật lớp truy cập database để backend chạy được với PostgreSQL thật hoặc demo fallback.
- Cải thiện phần admin chỉnh tồn kho biến thể sau vòng review implementation.
- Việt hóa toàn bộ giao diện khách hàng và admin: auth, giỏ hàng, checkout, đơn hàng, trạng thái, quản lý sản phẩm, quản lý đơn và AI assistant.
- Redesign storefront theo hướng thương hiệu Solely premium sneaker: header sticky, hero, trust bar, product grid, filter danh mục, banner chất liệu, story, newsletter và footer.
- Cập nhật metadata gốc của frontend sang `lang="vi"` và title Solely.
- Cập nhật seed database sang dữ liệu sản phẩm Solely tiếng Việt.
- Bổ sung icon bằng `lucide-react` cho các thành phần UI chính.
- Chuyển toàn bộ hiển thị tiền từ USD sang VND, bỏ số lẻ thập phân.
- Cập nhật giá sản phẩm/biến thể trong seed và script cập nhật PostgreSQL sang mức giá VND phù hợp shop giày Việt Nam.
- Cập nhật input giá trong admin theo bước VND `1000`.
- Áp phong cách từ prompt furniture editorial vào shop giày Solely nhưng giữ nguyên domain shop giày Việt, sản phẩm sneaker, giá VND và nghiệp vụ hiện có.
- Cập nhật hover card ảnh sản phẩm, CTA terracotta, typography uppercase, divider mảnh, responsive grid và header hamburger cho mobile.
- Thay ảnh hero tĩnh bằng corridor image stream có hỗ trợ reduced motion.
- Tinh chỉnh hero image stream gần demo hơn: tăng mật độ lên 12 card mỗi rail, đặt nội dung giữa màn hình và làm luồng ảnh nổi rõ hơn.
- Căn trái nội dung hero, bỏ nút đổi slide cũ, đổi nút sản phẩm sang “Thêm vào giỏ hàng”, giảm độ đậm chữ, nới khoảng cách nội dung và chỉnh card để chỉ ảnh phóng to khi hover.
- Tách route `/admin/*` khỏi layout storefront để admin chỉ thấy các màn quản trị, không còn điều hướng mua hàng của user.
- Cập nhật dashboard admin dùng dữ liệu thật cho doanh thu, sản phẩm, đơn chờ xử lý, tồn kho, hoạt động gần đây và sản phẩm nổi bật.
- Sửa query cập nhật trạng thái đơn hàng admin để tránh lỗi PostgreSQL `inconsistent types deduced for parameter $1` khi chuyển đơn sang đã xác nhận.
- Cập nhật `AGENTS.md` để yêu cầu đọc `DEVELOPMENT_PROMPT.md` khi file có prompt hiện hành.
- Chuyển UI trợ lý mua sắm từ form trả lời đơn sang trải nghiệm chat hỗ trợ người dùng, giữ stack React/CSS hiện tại thay vì copy nguyên component shadcn/Tailwind/TypeScript.
- Sửa lại UI trợ lý mua sắm sau review để composer luôn nằm cuối panel, label đủ tương phản trên nền tối và message log tự cuộn xuống tin nhắn mới.
- Đưa sản phẩm gợi ý vào trong luồng chat của trợ lý mua sắm, tách ô nhập khỏi nút gửi, đổi nút gửi sang icon-only và cho phép nhấn Enter để gửi.
- Thu nhỏ sản phẩm gợi ý trong trợ lý mua sắm và hiển thị như một tin nhắn assistant nằm trong vùng chat có thể cuộn.
- Rút gọn sản phẩm gợi ý trong trợ lý mua sắm để chỉ hiển thị tên sản phẩm và giá.
- Thêm lại ảnh nhỏ cho sản phẩm gợi ý trong chat, bỏ thanh scroll riêng của gợi ý và ẩn thanh scroll lịch sử trò chuyện.
- Thêm chuyển đổi giao diện light/dark cho storefront, lưu theme vào `localStorage` và đồng bộ màu trợ lý mua sắm theo theme hiện tại.
- Cập nhật nút đóng trợ lý mua sắm để dùng màu theo theme light/dark, hover rõ hơn và không còn bị lệch màu trên nền sáng.
- Cập nhật `product-badge` để dùng màu nền, viền và chữ theo theme light/dark.
- Cập nhật retrieval trợ lý mua sắm để nhận diện nhu cầu leo núi/trekking/outdoor và chỉ lọc sản phẩm trail phù hợp trước khi tư vấn.
- Cập nhật trợ lý mua sắm để dùng OpenAI ranking sau khi backend lọc catalog, kèm fallback nội bộ tự nhiên hơn khi thiếu API key hoặc chỉ có một sản phẩm phù hợp.
- Cập nhật script `database/localize-vietnamese-products.sql` thành upsert để đồng bộ sản phẩm, ảnh và biến thể mới vào PostgreSQL thật mà không cần reset database.
- Cập nhật script setup database để chạy schema, seed và upsert Việt hóa/RAG theo cùng một luồng lặp lại được.
- Sửa service RAG để giữ marker `needs_reindex` cho sản phẩm khi Gemini embedding lỗi và loại product chunks khỏi context nếu sản phẩm bị filter loại bỏ.

### Đã kiểm chứng

- Backend test suite đã pass trong quá trình triển khai MVP.
- Frontend test suite đã pass trong quá trình triển khai MVP.
- `npm test` đã pass sau bản Việt hóa/redesign: server 52/52, client 20/20.
- `npm run build` đã pass sau bản Việt hóa/redesign.
- `git diff --check` đã pass sau bản Việt hóa/redesign.
- Kết nối PostgreSQL local đã được kiểm chứng bằng cách tạo customer qua API và đọc lại từ bảng `users`.
- API products đã được kiểm chứng trả dữ liệu Solely tiếng Việt từ PostgreSQL thật.
- Thêm test bắt buộc UI hiển thị VND thay vì USD trong customer/admin flow.
- Thêm test bắt buộc seed dùng giá VND-scale và không còn ảnh placeholder.
- Thêm test cho homepage editorial và trang chi tiết sản phẩm có quantity stepper/nút mua ngay.
- Thêm test bắt buộc homepage render hiệu ứng image stream trong hero.
- Thêm test bắt buộc Home không còn nút đổi slide cũ và nút sản phẩm dùng “Thêm vào giỏ hàng”.
- `npm test` đã pass sau fix trạng thái đơn và admin workspace: server 54/54, client 23/23.
- `npm run build` đã pass sau khi tách admin workspace.
- `git diff --check` đã pass sau khi tách admin workspace.
- Smoke test API đã kiểm chứng customer register/login, catalog/detail, AI advisor, cart, checkout COD, customer order list/detail và admin chuyển trạng thái `pending -> confirmed -> shipping -> completed`.
- Thêm test frontend bắt buộc trợ lý mua sắm hiển thị message log, tin nhắn user, typing indicator, câu trả lời assistant và sản phẩm gợi ý.
- Bổ sung test frontend bắt buộc sản phẩm gợi ý nằm trong message log, nút mở/nút gửi không có text hiển thị và Enter gửi được tin nhắn.
- Bổ sung test frontend bắt buộc sản phẩm gợi ý là một message assistant trong vùng chat scrollable và dùng layout mini.
- Bổ sung test frontend bắt buộc sản phẩm gợi ý không hiển thị ảnh, meta, size hoặc nút thêm giỏ trong chat.
- Bổ sung test frontend bắt buộc gợi ý trong chat có ảnh nhỏ, không dùng scroll riêng và message log có class ẩn scrollbar.
- Bổ sung test frontend bắt buộc storefront có nút đổi theme, class light/dark và lưu lựa chọn theme sau khi render lại.
- Bổ sung test frontend bắt buộc nút đóng trợ lý mua sắm dùng class theme-aware.
- Bổ sung test frontend bắt buộc `product-badge` dùng class theme-aware.
- Bổ sung test backend bắt buộc câu hỏi giày leo núi/trekking trả về sản phẩm trail/outdoor thay vì catalog không liên quan.
- Bổ sung test backend bắt buộc trợ lý mua sắm dùng OpenAI ranking khi có `OPENAI_API_KEY` và không dùng câu fallback số nhiều khi chỉ có một sản phẩm phù hợp.
- Bổ sung test database bắt buộc seed có ít nhất 20 sản phẩm, đủ nhóm danh mục chính và mô tả đủ dài để làm nguồn dữ liệu RAG.
- Bổ sung test backend cho service RAG indexing/retrieval và câu chào nhanh của trợ lý RAG.

## 2026-09-05

### Đã thêm

- Viết spec thiết kế MVP cho flow cửa hàng giày có auth.
- Viết plan triển khai gồm scaffold, database, auth, product API, cart/orders, admin flow, AI advisor, frontend flow, verification và docs.
