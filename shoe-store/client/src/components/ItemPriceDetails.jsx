import { formatMoney } from '../utils/formatters.js';

export default function ItemPriceDetails({ item }) {
  const hasBasePrice = item.basePrice !== null && item.basePrice !== undefined;
  const hasDiscount = item.discountPercent !== null && item.discountPercent !== undefined;
  if (!hasBasePrice && !hasDiscount) return null;

  return (
    <small className="muted">
      {hasBasePrice ? <span>Giá gốc: {formatMoney(item.basePrice)}</span> : null}
      {hasBasePrice && hasDiscount ? ' · ' : null}
      {hasDiscount ? <span>Giảm giá: {item.discountPercent}%</span> : null}
    </small>
  );
}
