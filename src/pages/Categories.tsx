import { useApp } from '../app/context';
import { finance } from '../services/finance';
import { AddButton, Empty, PageHeading } from '../components/ui';
import { RecordActions } from '../components/RecordActions';
export function Categories() {
  const { data, openEditor } = useApp();
  return (
    <>
      <PageHeading
        title="Danh mục"
        description="Phân loại thu và chi theo cách phù hợp với bạn."
        action={
          <AddButton onClick={() => openEditor({ kind: 'category' })}>Thêm danh mục</AddButton>
        }
      />
      <div className="two-columns">
        {(['expense', 'income'] as const).map((type) => (
          <section className="panel" key={type}>
            <div className="section-heading">
              <h2>{type === 'expense' ? 'Chi tiêu' : 'Thu nhập'}</h2>
              <span className="pill light">
                {data.categories.filter((c) => c.type === type).length} danh mục
              </span>
            </div>
            {data.categories
              .filter((c) => c.type === type)
              .map((c) => (
                <div className="category-row" key={c.id}>
                  <span className={`category-dot ${type}`} />
                  <strong>{c.name}</strong>
                  <RecordActions
                    label={`danh mục ${c.name}`}
                    onEdit={() => openEditor({ kind: 'category', value: c })}
                    onDelete={() => finance.removeCategory(c.id)}
                  />
                </div>
              ))}
            {!data.categories.some((c) => c.type === type) && <Empty title="Chưa có danh mục" />}
          </section>
        ))}
      </div>
    </>
  );
}
