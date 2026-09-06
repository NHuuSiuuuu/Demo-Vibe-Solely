const ORDER_STATUS_LABELS = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy'
};

const PAYMENT_STATUS_LABELS = {
  unpaid: 'Chưa thanh toán',
  paid: 'Đã thanh toán'
};

const PRODUCT_STATUS_LABELS = {
  active: 'Đang bán',
  hidden: 'Đã ẩn'
};

const GENDER_LABELS = {
  men: 'Nam',
  women: 'Nữ',
  unisex: 'Unisex'
};

const CATEGORY_LABELS = {
  running: 'Chạy bộ',
  sneakers: 'Sneaker',
  lifestyle: 'Phong cách sống',
  everyday: 'Hằng ngày',
  court: 'Sân đấu',
  trail: 'Địa hình',
  training: 'Tập luyện',
  boots: 'Boots',
  walking: 'Đi bộ'
};

const COLOR_LABELS = {
  Black: 'Đen',
  White: 'Trắng',
  Slate: 'Xám đá',
  Gray: 'Xám',
  Olive: 'Olive',
  Sand: 'Cát',
  Brown: 'Nâu',
  Navy: 'Xanh navy',
  Tan: 'Nâu sáng',
  Green: 'Xanh lá',
  black: 'đen',
  white: 'trắng',
  red: 'đỏ'
};

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function labelFromMap(map, value) {
  return map[value] || value || '';
}

function orderStatusLabel(value) {
  return labelFromMap(ORDER_STATUS_LABELS, value);
}

function paymentStatusLabel(value) {
  return labelFromMap(PAYMENT_STATUS_LABELS, value);
}

function productStatusLabel(value) {
  return labelFromMap(PRODUCT_STATUS_LABELS, value);
}

function genderLabel(value) {
  return labelFromMap(GENDER_LABELS, value);
}

function categoryLabel(value) {
  return labelFromMap(CATEGORY_LABELS, value);
}

function colorLabel(value) {
  return labelFromMap(COLOR_LABELS, value);
}

export {
  CATEGORY_LABELS,
  COLOR_LABELS,
  GENDER_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PRODUCT_STATUS_LABELS,
  categoryLabel,
  colorLabel,
  formatMoney,
  genderLabel,
  orderStatusLabel,
  paymentStatusLabel,
  productStatusLabel
};
