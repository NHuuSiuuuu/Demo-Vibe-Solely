import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';

export default function AdminCategoriesPage() {
  const { token } = useAuth();
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadCategories() {
    const data = await apiClient.get('/api/admin/categories', { token });
    setCategories(data.categories || []);
  }

  useEffect(() => {
    loadCategories().catch((err) => setError(err.message));
  }, [token]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiClient.post('/api/admin/categories', { name }, { token });
      setName('');
      setMessage('Đã thêm danh mục.');
      await loadCategories();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleCategory(category) {
    setError('');
    try {
      const data = await apiClient.patch(`/api/admin/categories/${category.id}`, {
        status: category.status === 'active' ? 'hidden' : 'active'
      }, { token });
      setCategories((current) => current.map((item) => item.id === category.id ? data.category : item));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="admin-page" aria-labelledby="admin-categories-title">
      <div className="section-heading">
        <div>
          <h1 id="admin-categories-title">Quản lý danh mục</h1>
          <p>Danh mục được chọn bằng tùy chọn khi tạo hoặc sửa sản phẩm.</p>
        </div>
      </div>
      {message ? <p className="success-message">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      <form className="admin-form admin-form--compact" onSubmit={handleSubmit}>
        <label>
          Tên danh mục mới
          <input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Ví dụ: Giày đi biển" />
        </label>
        <div className="admin-form__actions"><button type="submit">Thêm danh mục</button></div>
      </form>
      <div className="admin-table-wrap">
        <table className="admin-table" aria-label="Danh mục sản phẩm">
          <thead><tr><th>Tên</th><th>Slug tự sinh</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id}>
                <td><strong>{category.name}</strong></td>
                <td>{category.slug}</td>
                <td>{category.status === 'active' ? 'Đang dùng' : 'Đã ẩn'}</td>
                <td><button type="button" onClick={() => toggleCategory(category)}>{category.status === 'active' ? 'Ẩn' : 'Hiện'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
