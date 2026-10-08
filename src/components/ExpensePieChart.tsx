import { useId, useState } from 'react';
import { sumMoney } from '../utils/calculations';
import { currency, monthLabel } from '../utils/format';
import { Empty } from './ui';
interface CategoryExpense {
  id: string;
  name: string;
  amount: number;
}
const colors = [
  '#0e655b',
  '#cf7935',
  '#526ab2',
  '#ad4f75',
  '#68832e',
  '#408698',
  '#9461ae',
  '#a65d3b',
  '#76743d',
  '#496c82',
  '#b25152',
  '#527f63',
];
const percent = (amount: number, total: number) => {
  const share = (amount / total) * 100;
  return share < 0.1 ? '<0,1%' : `${share.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;
};
export function ExpensePieChart({
  categories,
  month,
}: {
  categories: CategoryExpense[];
  month: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailsId = useId();
  const total = sumMoney(categories.map((c) => c.amount));
  if (!total)
    return (
      <Empty title="Chưa có chi tiêu trong tháng">
        Biểu đồ sẽ xuất hiện khi bạn ghi khoản chi đầu tiên.
      </Empty>
    );
  const selected = categories.find((c) => c.id === selectedId);
  const toggle = (id: string) => setSelectedId((current) => (current === id ? null : id));
  let cumulative = 0;
  const slices = categories.map((category, index) => {
    const start = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    cumulative += category.amount;
    const end = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    const point = (angle: number) =>
      `${120 + 104 * Math.cos(angle)} ${120 + 104 * Math.sin(angle)}`;
    return {
      ...category,
      color: colors[index % colors.length],
      path: `M 120 120 L ${point(start)} A 104 104 0 ${category.amount / total > 0.5 ? 1 : 0} 1 ${point(end)} Z`,
    };
  });
  return (
    <div className="expense-pie" data-testid="expense-pie">
      <div className="expense-pie-visual">
        <svg
          viewBox="0 0 240 240"
          role="img"
          aria-label={`Biểu đồ tròn chi tiêu ${monthLabel(month)}, tổng ${currency(total)}. Chi tiết trong danh sách danh mục.`}
        >
          {slices.map((slice) => {
            const common = {
              fill: slice.color,
              stroke: '#fff',
              strokeWidth: 2,
              opacity: selected && selected.id !== slice.id ? 0.4 : 1,
              onClick: () => toggle(slice.id),
              className: 'expense-pie-slice',
            };
            const title = `${slice.name}: ${currency(slice.amount)} (${percent(slice.amount, total)})`;
            return slices.length === 1 ? (
              <circle key={slice.id} cx="120" cy="120" r="104" {...common}>
                <title>{title}</title>
              </circle>
            ) : (
              <path key={slice.id} d={slice.path} {...common}>
                <title>{title}</title>
              </path>
            );
          })}
        </svg>
        <div className="expense-pie-details" id={detailsId} aria-live="polite" aria-atomic="true">
          <span className="muted">{selected ? selected.name : 'Tổng chi tiêu'}</span>
          <strong>{currency(selected?.amount ?? total)}</strong>
          <small className="muted">
            {selected
              ? `${percent(selected.amount, total)} chi tiêu tháng`
              : 'Chạm danh mục để xem tỷ lệ'}
          </small>
        </div>
      </div>
      <ul className="expense-pie-legend" aria-label="Danh mục chi tiêu">
        {slices.map((slice) => (
          <li key={slice.id}>
            <button
              type="button"
              aria-pressed={selected?.id === slice.id}
              aria-describedby={detailsId}
              onClick={() => toggle(slice.id)}
            >
              <span
                className="expense-pie-swatch"
                style={{ backgroundColor: slice.color }}
                aria-hidden="true"
              />
              <span className="expense-pie-label">
                {slice.name}
                <small>{percent(slice.amount, total)} chi tiêu tháng</small>
              </span>
              <strong>{currency(slice.amount)}</strong>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
