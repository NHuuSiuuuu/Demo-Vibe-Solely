# Development Prompt

File này là nơi người dùng dán prompt/yêu cầu phát triển cho Solely.

## Cách dùng

1. Dán yêu cầu mới vào phần `Prompt của người dùng`.
2. Giữ lại các ràng buộc quan trọng trong phần `Quy định bắt buộc`.
3. Khi bắt đầu phát triển, coding agent phải đọc file này cùng `AGENTS.md`.
4. Sau khi hoàn tất thay đổi, cập nhật `CHANGELOG.md` theo rule trong `AGENTS.md`.

## Prompt của người dùng

<!-- Dán prompt/yêu cầu phát triển vào bên dưới dòng này. -->
You are given a task to integrate an existing React component in the codebase

The codebase should support:
- shadcn project structure  
- Tailwind CSS
- Typescript

If it doesn't, provide instructions on how to setup project via shadcn CLI, install Tailwind or Typescript.

Determine the default path for components and styles. 
If default path for components is not /components/ui, provide instructions on why it's important to create this folder
Copy-paste this component to /components/ui folder:
```tsx
gallery-animation.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ExpandableGalleryProps {
  images: string[];
  className?: string;
}

const ExpandableGallery: React.FC<ExpandableGalleryProps> = ({ images, className = '' }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const openImage = (index: number) => {
    setSelectedIndex(index);
  };

  const closeImage = () => {
    setSelectedIndex(null);
  };

  const goToNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex + 1) % images.length);
    }
  };

  const goToPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex - 1 + images.length) % images.length);
    }
  };

  const getFlexValue = (index: number) => {
    if (hoveredIndex === null) {
      return 1;
    }
    return hoveredIndex === index ? 2 : 0.5;
  };

  return (
    <div className={className}>
      {/* Horizontal Expandable Gallery */}
      <div className="flex gap-2 h-96 w-full">
        {images.map((image, index) => (
          <motion.div
            key={index}
            className="relative cursor-pointer overflow-hidden rounded-md"
            style={{ flex: 1 }}
            animate={{ flex: getFlexValue(index) }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => openImage(index)}
          >
            <img
              src={image}
              alt={`Gallery image ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <motion.div
              className="absolute inset-0 bg-black"
              initial={{ opacity: 0 }}
              animate={{ opacity: hoveredIndex === index ? 0 : 0.3 }}
              transition={{ duration: 0.3 }}
            />
          </motion.div>
        ))}
      </div>

      {/* Expanded View Modal */}
      <AnimatePresence>
        {selectedIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center dark:bg-black bg-white bg-opacity-95 p-4"
            onClick={closeImage}
          >
            {/* Close Button */}
            <button
              className="absolute top-4 right-4 z-10 text-white hover:text-gray-300 transition-colors"
              onClick={closeImage}
            >
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            {/* Previous Button */}
            {images.length > 1 && (
              <button
                className="absolute left-4 z-10 text-white hover:text-gray-300 transition-colors"
                onClick={goToPrev}
              >
                <svg
                  className="w-10 h-10"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            )}

            {/* Image */}
            <motion.div
              className="relative max-w-5xl max-h-[90vh] w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.img
                key={selectedIndex}
                src={images[selectedIndex]}
                alt={`Gallery image ${selectedIndex + 1}`}
                className="w-full h-full object-contain rounded-md"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
              />
            </motion.div>

            {/* Next Button */}
            {images.length > 1 && (
              <button
                className="absolute right-4 z-10 text-white hover:text-gray-300 transition-colors"
                onClick={goToNext}
              >
                <svg
                  className="w-10 h-10"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}

            {/* Image Counter */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm dark:bg-black bg-white bg-opacity-50 px-4 py-2 rounded-md">
              {selectedIndex + 1} / {images.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Example Usage
export function Component() {
  const images = [
    "https://cdn.21st.dev/assets/mirror/e8/e8173f9d3fc39d6c562c45ac058e5e57f43b4f6a0aa3783cd5cd5830d204160a.jpg",
    "https://cdn.21st.dev/assets/mirror/8e/8e6e1f07c0ab5d1ffceb6a04288a42eb918705f04e0aa7666bbc5bb662481ca0.jpg",
    "https://cdn.21st.dev/assets/mirror/3b/3b4d01c73cc20413c853be42695bc140acb4d2a32f6215f2e2bf61b60ebf440c.jpg",
    "https://cdn.21st.dev/assets/mirror/78/78b3e6f117be95793fb3d561ab909fbdecbbfcbfb9da026abaaa95c4cdf65a2f.jpg",
  ];

  return (
    <div className="min-h-screen dark:bg-black bg-white flex items-center justify-center p-8">
      <ExpandableGallery images={images} className="w-3/4 max-w-7xl" />
    </div>
  );
}

demo.tsx
import { Component } from "@/components/ui/gallery-animation";

export default function DemoOne() {
  return <Component />;
}

```

Install NPM dependencies:
```bash
framer-motion
```

Implementation Guidelines
 1. Analyze the component structure and identify all required dependencies
 2. Review the component's argumens and state
 3. Identify any required context providers or hooks and install them
 4. Questions to Ask
 - What data/props will be passed to this component?
 - Are there any specific state management requirements?
 - Are there any required assets (images, icons, etc.)?
 - What is the expected responsive behavior?
 - What is the best place to use this component in the app?

Steps to integrate
 0. Copy paste all the code above in the correct directories
 1. Install external dependencies
 2. Fill image assets with Unsplash stock images you know exist
 3. Use lucide-react icons for svgs or logos if component requires them



## Mục tiêu

<!-- Mô tả kết quả cuối cùng cần đạt được. -->
sửa lại ui session Sản phẩm bán chạy



## Phạm vi

<!-- Ghi rõ phần nào được sửa và phần nào không được đụng. -->


## Quy định bắt buộc

- Giữ stack React, Vite, Node.js, Express và PostgreSQL.
- Giữ auth JWT với role `customer` và `admin`.
- Không tự merge vào `main` nếu chưa có lệnh rõ từ người dùng.
- Không revert thay đổi ngoài phạm vi yêu cầu.
- Mọi thay đổi phải được ghi vào `CHANGELOG.md` bằng tiếng Việt.

## Kiểm chứng mong muốn

<!-- Ghi test/build/smoke test cần chạy nếu có yêu cầu cụ thể. -->


## Ghi chú

<!-- Ghi thêm thông tin thiết kế, link tham khảo, tài khoản demo hoặc production caveat nếu cần. -->
