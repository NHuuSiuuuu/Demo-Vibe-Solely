# Changelog

File này ghi lại các thay đổi quan trọng của dự án để dễ theo dõi phần sản phẩm, code, database và triển khai sau này.

## Chưa phát hành

### Kế hoạch triển khai tìm kiếm sản phẩm bằng hình ảnh

- Thêm plan triển khai Gemini Embedding 2, vector ảnh sản phẩm riêng, API tìm kiếm multipart, nút camera cho catalog, quản trị reindex và các bước kiểm thử backend/frontend.

### Thiết kế tìm kiếm sản phẩm bằng hình ảnh

- Thêm spec thiết kế tìm kiếm bằng Gemini Embedding 2: người dùng chọn/chụp ảnh từ biểu tượng camera cạnh ô tìm kiếm, backend truy vấn vector ảnh bằng pgvector và admin có thể reindex embedding ảnh sản phẩm.

### Phân biệt COD, VNPay và hoàn tiền

- Tách rõ trạng thái thanh toán COD/VNPay trên chi tiết đơn và trang kết quả; bổ sung timeline riêng cho tiến trình đơn hàng và tiến trình thanh toán.
- Signed Return URL của VNPay cũng đối soát đơn ngay sau khi khách hoàn tất OTP; IPN vẫn giữ vai trò retry/server-to-server và chạy idempotent.
- Cho phép khách hủy đơn đang chờ xử lý; hủy COD giữ trạng thái chưa thanh toán, còn hủy VNPay đã thanh toán chuyển sang chờ hoàn tiền và hoàn tồn kho an toàn.
- Bổ sung trạng thái `refund_pending` và `refunded`; admin có nút xác nhận đã hoàn tiền VNPay, chống xác nhận lặp và không cho giao đơn đang chờ/đã hoàn tiền.
- Bổ sung migration cộng dồn, API hủy đơn/xác nhận hoàn tiền, thông báo UI riêng cho COD/VNPay và kiểm thử backend/frontend tương ứng.

### Hoàn thiện sau rà soát thanh toán

- Sửa form admin để chỉ gửi `discountPercent` của phiên bản đã tồn tại khi trường giảm giá được chỉnh sửa; lưu tồn kho không làm mất giá legacy, còn chủ động sửa về `0` vẫn ngừng fallback. Cờ chỉnh sửa được xóa sau khi lưu thành công.
- Dùng chung phần hiển thị giá gốc/phần trăm giảm giá trong giỏ, checkout, chi tiết đơn khách hàng và chi tiết đơn admin; hiển thị đúng giá trị `0`, bỏ qua từng trường lịch sử `null`/thiếu và giữ nguyên tổng tiền đã lưu.
- Tách trạng thái chi tiết đơn theo mã đơn/token để loại bỏ đơn và nút thanh toán cũ khi điều hướng; bỏ qua URL, lỗi và trạng thái tải từ yêu cầu tiếp tục thanh toán đã hết hiệu lực sau khi đổi đơn, đổi đăng nhập hoặc rời trang.
- Bổ sung kiểm thử UI/API cho lưu tồn kho của phiên bản legacy, metadata lịch sử và phản hồi thanh toán đến muộn; cập nhật hướng dẫn thao tác giảm giá về `0`.

### Gia cố thanh toán và giá bán

- Sửa URL thanh toán VNPay không gửi `vnp_IpnUrl` như một tham số thanh toán; IPN vẫn được cấu hình riêng ở endpoint backend để tránh Sandbox trả lỗi hệ thống `code=99`.
- Sửa `db:migrate` để chạy migration catalog rồi VNPay/giảm giá với `ON_ERROR_STOP=1`; kiểm thử trực tiếp runner, lỗi tiến trình và migration chạy lặp trên PostgreSQL nhúng.
- Bổ sung hạn thanh toán 15 phút theo GMT+7 vào cùng payload ký VNPay, kiểm thử chuyển ngày/năm và chữ ký không mã hóa lặp.
- Chặn giao/hoàn tất đơn VNPay chưa thanh toán; chặn hủy khi thanh toán còn đang chờ đối soát để bảo toàn tồn kho khi IPN đến muộn. Đơn VNPay đã thanh toán khi hủy sẽ chuyển sang chờ hoàn tiền; đơn thất bại vẫn được hủy và hoàn tồn đúng một lần; COD giữ luồng cũ.
- Thêm API có xác thực `POST /api/orders/:id/payment-url` và nút tiếp tục thanh toán trong chi tiết đơn, dùng số tiền/mã tham chiếu đã lưu mà không tạo thêm đơn, trừ kho hoặc xóa giỏ.
- Thêm cờ phân biệt giá legacy với giảm giá do admin nhập; nhập `discountPercent` kể cả `0` sẽ ngừng fallback vĩnh viễn, giữ cột delta để kiểm toán và không bật lại khi chạy migration.
- Đồng bộ helper, bộ lọc/sắp xếp catalog, giỏ hàng, đơn hàng và RAG sang giá bán làm tròn nguyên đồng trước khi nhân số lượng; giữ nguyên số tiền lịch sử và độ chính xác dữ liệu giá gốc.
- Bổ sung ngữ cảnh `basePrice`/`discountPercent` cho giỏ và snapshot dòng đơn hàng; dữ liệu lịch sử không xác định trả `null`, không suy đoán theo catalog hiện tại.
- Xóa trạng thái đơn/lỗi cũ trên trang kết quả VNPay trước khi tải mã đơn mới; bổ sung kiểm thử điều hướng và lỗi/nút thử lại.

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
- Thêm API admin cho RAG tại `/api/admin/rag` để xem overview, quản lý tài liệu tri thức, reindex và kiểm thử truy vấn bằng quyền admin.
- Thêm trang admin `/admin/rag` "Kho tri thức AI" để xem trạng thái RAG, quản lý tài liệu chính sách, reindex và kiểm thử truy vấn qua backend.
- Thêm tài liệu setup Gemini/RAG, database pgvector, quy trình reindex và cách kiểm thử admin/customer assistant.
- Thêm khu vực index sản phẩm trong admin RAG để xem số sản phẩm đã index/cần reindex và reindex một sản phẩm bằng ID.
- Thêm schema giá giảm theo phần trăm và hợp đồng thanh toán VNPay, gồm trạng thái thanh toán, cột đối soát giao dịch và migration bảo toàn giá biến thể legacy.
- Đồng bộ seed và script Việt hóa biến thể sang discount_percent để bootstrap schema mới không còn tham chiếu price_delta.
- Thêm helper backend dùng chung để chuẩn hóa phần trăm giảm giá đến hai chữ số thập phân và tính giá bán biến thể theo nguyên đồng, kèm fallback có cờ cho dữ liệu giá cũ đã migrate.
- Thêm service backend tạo URL thanh toán VNPay Sandbox bằng chữ ký HMAC-SHA512, xác minh callback và dựng response IPN mà không cập nhật database.
- Thêm tạo đơn VNPay trạng thái chờ thanh toán, return redirect đã xác minh chữ ký và IPN đối soát dưới transaction lock theo cơ chế idempotent, không lặp thao tác trừ tồn kho hoặc xóa giỏ hàng.
- Thêm lựa chọn thanh toán COD/VNPay tại checkout, trang kết quả xác minh trạng thái từ đơn hàng và nhãn phương thức/trạng thái thanh toán trên lịch sử đơn hàng.
- Bổ sung README hướng dẫn cấu hình VNPay Sandbox bằng biến môi trường backend, mở HTTPS tunnel công khai cho IPN và checklist kiểm thử end-to-end cho giá giảm, COD cùng các nhánh callback VNPay.

### Đã thay đổi
- Sửa checkout để VNPay chuyển hướng ngay theo URL hợp lệ mà không bị lỗi làm mới giỏ hàng chặn lại, đồng thời bỏ qua `paymentUrl` bất thường trong response đơn COD.
- Từ chối hủy đơn VNPay đã thanh toán bằng HTTP 409 trước khi hoàn tồn kho vì luồng hoàn tiền chưa nằm trong phạm vi hiện tại.
- Siết chặt đối soát VNPay theo đồng thời mã phản hồi và trạng thái giao dịch, từ chối callback thiếu trường bắt buộc, đồng thời bảo vệ vòng đời đơn để admin không đánh dấu thanh toán VNPay thành công hoặc để IPN cập nhật đơn đã hủy.
- Thêm migration tương thích cho database cũ để tạo bảng danh mục và cột Cloudinary của ảnh sản phẩm mà không xóa dữ liệu.
- Thêm quản lý danh mục trong admin, tự sinh slug sản phẩm từ tên và upload nhiều ảnh sản phẩm qua Cloudinary.
- Thêm upload nhiều ảnh sản phẩm lên Cloudinary qua chữ ký backend, tự sinh slug từ tên sản phẩm và chọn danh mục bằng dropdown quản trị.
- Cải thiện giao diện chatbot: render xuống dòng, danh sách đánh số/gạch đầu dòng và chữ đậm đúng định dạng Markdown từ Gemini.
- Tăng ngân sách đầu ra của Gemini để các câu trả lời chính sách và hướng dẫn không bị cắt giữa chừng, đồng thời giới hạn độ dài bằng chỉ dẫn trợ lý.

- Cải thiện prompt trợ lý ảo Solely để trả lời tiếng Việt tự nhiên, đủ ý, không lộ nhãn kỹ thuật và tăng giới hạn output để tránh câu trả lời bị cắt giữa chừng.
- Cho câu hỏi chính sách tổng quát retrieve đủ các tài liệu policy liên quan, đồng thời giữ giới hạn card sản phẩm đúng theo số lượng khách yêu cầu.
- Cho phép lệnh reindex toàn bộ retry cả tài liệu RAG đang ở trạng thái `needs_reindex`, tránh bỏ sót policy sau khi Gemini tạm thời chưa được cấu hình.
- Cập nhật model chat Gemini mặc định sang `gemini-3.6-flash` vì model `gemini-2.5-flash` không còn khả dụng với cấu hình API hiện tại.
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
- Chuyển API chat khách hàng `/api/ai/chat` sang trả lời qua RAG/Gemini, trả về `answer`, `products`, `sources` và không còn lưu hội thoại vào `ai_chat_messages`.
- Cập nhật trợ lý mua sắm để nhận `sources` từ RAG nội bộ, hiển thị câu trả lời chính sách không kèm sản phẩm và chỉ render card khi API trả sản phẩm.
- Sửa service RAG để giữ marker `needs_reindex` cho sản phẩm khi Gemini embedding lỗi và loại product chunks khỏi context nếu sản phẩm bị filter loại bỏ.
- Sửa API admin RAG test query để trả về các chunk tri thức đã truy xuất thay vì luôn trả mảng rỗng.
- Đồng bộ các thao tác tạo/sửa sản phẩm và biến thể trong admin với RAG: reindex best-effort, fallback `needs_reindex` khi lỗi và đánh dấu chunk `hidden` khi ẩn sản phẩm.
- Cô lập lỗi cập nhật trạng thái chunk RAG để thao tác lưu sản phẩm/biến thể trong admin không thất bại khi phần bookkeeping RAG gặp lỗi database.
- Bổ sung fallback rõ ràng khi trợ lý RAG chưa có Gemini hoặc bảng RAG chưa sẵn sàng để khách không gặp lỗi nội bộ.
- Cập nhật script setup database để `psql` dừng và trả exit code lỗi khi SQL lỗi, tránh báo setup RAG thành công giả khi thiếu pgvector.
- Bổ sung README mô tả trạng thái RAG degraded/unconfigured và fallback chat khi thiếu `GEMINI_API_KEY`.
- Cập nhật admin RAG overview để trả trạng thái vận hành chi tiết: số tài liệu theo trạng thái, chunks theo nguồn, sản phẩm đã index/cần reindex, thời điểm index gần nhất và trạng thái pgvector.
- Cập nhật lưu tài liệu chính sách RAG để reindex best-effort sau khi tạo/sửa tài liệu active; nếu Gemini hoặc indexing lỗi thì vẫn giữ bản lưu và đánh dấu `needs_reindex`.
- Cập nhật parser yêu cầu số lượng của trợ lý RAG để hiểu các câu như `2 sản phẩm`, `2 mẫu`, `2 đôi`.
- Cập nhật admin RAG overview để báo trạng thái bảng RAG/pgvector chưa sẵn sàng thay vì trả lỗi 500 chung.
- Cập nhật demo database in-memory để bỏ cú pháp pgvector không được PGlite hỗ trợ nhưng vẫn giữ schema PostgreSQL thật có pgvector.
- Chuyển catalog, giỏ hàng, tạo đơn và API quản trị biến thể sang `discountPercent`; backend tự tính và chốt giá sau giảm, không còn đọc hoặc ghi `priceDelta` trong API runtime mới.
- Từ chối payload quản trị biến thể còn gửi `priceDelta` bằng HTTP 400, tránh âm thầm lưu mức giảm giá `0%` thay cho dữ liệu legacy.
- Đồng bộ form biến thể admin sang `% giảm giá`, trang chi tiết dùng `unitPrice` từ backend và hiển thị quan hệ giữa giá gốc với giá sau giảm.
- Cập nhật index/retrieval RAG dùng helper giá chung, đưa phần trăm giảm và giá sau giảm chính xác vào ngữ cảnh cùng card sản phẩm gợi ý.
- Sửa query index sản phẩm RAG để không `GROUP BY` dữ liệu JSON, bảo đảm chạy được trên PostgreSQL thật.
- Đồng bộ retrieval RAG để chọn cùng một biến thể thỏa size và khoảng giá, tránh hiển thị giá của biến thể khác với điều kiện tìm kiếm.
- Cập nhật catalog sản phẩm trả `price` sau giảm và `discountPercent` của biến thể mặc định còn hàng bằng helper giá backend.
- Đồng bộ lọc khoảng giá và sắp xếp catalog theo giá hiển thị sau giảm của chính biến thể được chọn; size, màu và giá giờ cùng áp dụng trên một variant candidate.

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
- Bổ sung test backend bắt buộc admin xem được RAG overview và customer bị chặn khỏi endpoint admin RAG.
- Bổ sung test backend bắt buộc admin RAG test query trả về chunk tri thức khi retrieval tìm thấy ngữ cảnh.
- Bổ sung test backend cho các mức giảm giá `0%`, `10%`, `100%`, phần trăm thập phân, làm tròn, fallback giá legacy, giá catalog/cart/order và validation admin `0..100`.
- Bổ sung regression test POST admin để bảo đảm `priceDelta` legacy không được chấp nhận trong runtime API.
- Bổ sung test backend bắt buộc `/api/ai/chat` dùng RAG, không lưu tin nhắn chat và trả `sources` cùng sản phẩm/tri thức liên quan.
- Bổ sung test frontend bắt buộc admin navigation hiển thị "Kho tri thức AI" và route `/admin/rag` render tổng quan tri thức, chính sách và kiểm thử truy vấn.
- Bổ sung test frontend bắt buộc trợ lý mua sắm hiển thị câu trả lời chính sách RAG mà không render "Sản phẩm gợi ý" khi API trả `products: []`.
- Bổ sung test backend cho reindex tài liệu chính sách sau create/update, fallback `needs_reindex`, overview RAG vận hành và parser số lượng `2 sản phẩm`.
- Bổ sung test frontend bắt buộc admin RAG hiển thị trạng thái index sản phẩm và gọi API reindex một sản phẩm.
- Bổ sung test frontend và RAG bảo vệ payload `discountPercent`, ràng buộc nhập `0..100`, giá chi tiết sau giảm và card RAG không lộ `priceDelta`.
- Bổ sung regression test chạy query index trên PostgreSQL-compatible PGlite, retrieval nhiều biến thể theo size/giá và catalog trả giá mặc định sau giảm.
- Bổ sung regression test bảo đảm catalog lọc min/max, sắp xếp theo giá hiển thị sau giảm và trả đúng variant đã thỏa đồng thời size/giá.
- Bổ sung unit test VNPay cho thứ tự và encoding query, chữ ký HMAC-SHA512, quy đổi đơn vị tiền, callback hợp lệ, chữ ký/số tiền bị sửa và cấu hình thiếu secret.

## 2026-09-05

### Đã thêm

- Viết spec thiết kế MVP cho flow cửa hàng giày có auth.
- Viết plan triển khai gồm scaffold, database, auth, product API, cart/orders, admin flow, AI advisor, frontend flow, verification và docs.
