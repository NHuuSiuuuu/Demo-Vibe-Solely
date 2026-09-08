import { orderStatusLabel, paymentMethodLabel, paymentStatusLabel } from '../utils/formatters.js';

const ORDER_STEPS = ['pending', 'confirmed', 'shipping', 'completed'];

function orderSteps(order) {
  if (order.orderStatus === 'cancelled') return ['cancelled'];
  return ORDER_STEPS;
}

function paymentSteps(order) {
  if (order.paymentMethod === 'cod') {
    return [
      { key: 'cod_order', label: 'Đặt đơn COD', reached: true },
      { key: 'cod_paid', label: 'Thanh toán khi nhận hàng', reached: order.paymentStatus === 'paid' }
    ];
  }
  const steps = [{ key: 'pending', label: 'Chờ thanh toán', reached: true }];
  if (order.paymentStatus === 'failed') {
    steps.push({ key: 'failed', label: paymentStatusLabel('failed'), reached: true });
  } else if (['paid', 'refund_pending', 'refunded'].includes(order.paymentStatus)) {
    steps.push({ key: 'paid', label: paymentStatusLabel('paid'), reached: true });
  }
  if (['refund_pending', 'refunded'].includes(order.paymentStatus)) {
    steps.push({ key: 'refund_pending', label: paymentStatusLabel('refund_pending'), reached: true });
  }
  if (order.paymentStatus === 'refunded') {
    steps.push({ key: 'refunded', label: paymentStatusLabel('refunded'), reached: true });
  }
  return steps;
}

function TimelineTrack({ label, steps, currentKey }) {
  return (
    <div className="order-timeline__track" aria-label={label}>
      <h3>{label}</h3>
      <ol>
        {steps.map((step, index) => {
          const key = typeof step === 'string' ? step : step.key;
          const text = typeof step === 'string' ? orderStatusLabel(step) : step.label;
          const isCurrent = key === currentKey;
          const reached = typeof step === 'string' ? index <= steps.indexOf(currentKey) : step.reached;
          return (
            <li className={`order-timeline__item${reached ? ' order-timeline__item--reached' : ''}${isCurrent ? ' order-timeline__item--current' : ''}`} key={key}>
              <span className="order-timeline__dot" aria-hidden="true" />
              <span>{text}</span>
              {isCurrent && label === 'Tiến trình đơn hàng' ? <strong>Hiện tại</strong> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function OrderTimeline({ order }) {
  return (
    <section className="order-timeline" aria-label="Tiến trình trạng thái đơn hàng">
      <div className="order-timeline__heading">
        <h2>Timeline đơn hàng</h2>
        <span>{paymentMethodLabel(order.paymentMethod)}</span>
      </div>
      <div className="order-timeline__tracks">
        <TimelineTrack label="Tiến trình đơn hàng" steps={orderSteps(order)} currentKey={order.orderStatus} />
        <TimelineTrack label="Tiến trình thanh toán" steps={paymentSteps(order)} currentKey={order.paymentStatus} />
      </div>
    </section>
  );
}
