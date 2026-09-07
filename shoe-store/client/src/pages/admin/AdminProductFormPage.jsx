import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { genderLabel, productStatusLabel } from '../../utils/formatters.js';

const emptyProduct = {
  name: '',
  description: '',
  brand: '',
  category: '',
  gender: 'unisex',
  price: '',
  status: 'active',
  featured: false
};

const emptyVariant = {
  sku: '',
  size: '',
  color: '',
  stockQuantity: '',
  discountPercent: '0'
};

function createSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toProductForm(product) {
  return {
    name: product.name || '',
    description: product.description || '',
    brand: product.brand || '',
    category: product.category || '',
    gender: product.gender || 'unisex',
    price: product.price ?? '',
    status: product.status || 'active',
    featured: Boolean(product.featured)
  };
}

export default function AdminProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const isNew = !id;
  const [form, setForm] = useState(emptyProduct);
  const [product, setProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [categories, setCategories] = useState([]);
  const [images, setImages] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [variantForm, setVariantForm] = useState(emptyVariant);
  const [status, setStatus] = useState(isNew ? 'ready' : 'loading');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .get('/api/admin/categories', { token })
      .then((data) => setCategories((data.categories || []).filter((category) => category.status === 'active')))
      .catch(() => setCategories([]));

    if (isNew) {
      return undefined;
    }

    let cancelled = false;
    setStatus('loading');
    setError('');

    apiClient
      .get(`/api/admin/products/${id}`, { token })
      .then((data) => {
        if (cancelled) {
          return;
        }
        const matchedProduct = data.product;
        if (!matchedProduct) {
          throw new Error('Không tìm thấy sản phẩm');
        }
        setProduct(matchedProduct);
        setForm(toProductForm(matchedProduct));
        setVariants(matchedProduct.variants || []);
        setImages(matchedProduct.images || []);
        setStatus('ready');
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, isNew, token]);

  const pageTitle = isNew ? 'Tạo sản phẩm' : 'Sửa sản phẩm';
  const savedProductId = product?.id || id;
  const canManageVariants = Boolean(savedProductId);
  const categoryOptions = categories.length
    ? categories
    : (form.category ? [{ id: 'current', slug: form.category, name: form.category }] : []);

  const productPayload = useMemo(
    () => ({
      slug: createSlug(form.name),
      name: form.name.trim(),
      description: form.description.trim(),
      brand: form.brand.trim(),
      category: form.category.trim(),
      gender: form.gender,
      price: Number(form.price),
      status: form.status,
      featured: Boolean(form.featured)
    }),
    [form]
  );

  function updateField(event) {
    const { name, type, checked, value } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  function updateVariantField(event) {
    const { name, value } = event.target;
    setVariantForm((current) => ({ ...current, [name]: value }));
  }

  function updateExistingVariantField(variantId, field, value) {
    setVariants((current) =>
      current.map((variant) => (variant.id === variantId ? { ...variant, [field]: value } : variant))
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setError('');

    try {
      const data = isNew
        ? await apiClient.post('/api/admin/products', productPayload, { token })
        : await apiClient.patch(`/api/admin/products/${id}`, productPayload, { token });
      setProduct(data.product);
      setForm(toProductForm(data.product));
      await uploadImages(data.product.id);
      setMessage('Đã lưu sản phẩm.');
      if (isNew) {
        navigate(`/admin/products/${data.product.id}/edit`, { replace: true });
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function uploadImages(productId) {
    if (!imageFiles.length) return;
    const { upload } = await apiClient.post('/api/admin/uploads/signature', {}, { token });
    const uploadedImages = [];
    for (const file of imageFiles) {
      const body = new FormData();
      body.append('file', file);
      body.append('api_key', upload.apiKey);
      body.append('timestamp', String(upload.timestamp));
      body.append('folder', upload.folder);
      body.append('signature', upload.signature);
      const cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/${upload.cloudName}/image/upload`, {
        method: 'POST',
        body
      });
      if (!cloudinaryResponse.ok) throw new Error('Không thể tải ảnh lên Cloudinary');
      const cloudinaryImage = await cloudinaryResponse.json();
      const imageData = await apiClient.post(`/api/admin/products/${productId}/images`, {
        imageUrl: cloudinaryImage.secure_url,
        publicId: cloudinaryImage.public_id,
        altText: form.name.trim()
      }, { token });
      uploadedImages.push(imageData.image);
    }
    setImages((current) => [...current, ...uploadedImages]);
    setImageFiles([]);
  }

  async function handleVariantSubmit(event) {
    event.preventDefault();
    setMessage('');
    setError('');

    try {
      const payload = {
        sku: variantForm.sku.trim(),
        size: variantForm.size.trim(),
        color: variantForm.color.trim(),
        stockQuantity: Number(variantForm.stockQuantity),
        discountPercent: Number(variantForm.discountPercent || 0)
      };
      const data = await apiClient.post(`/api/admin/products/${savedProductId}/variants`, payload, { token });
      setVariants((current) => [...current, data.variant]);
      setVariantForm(emptyVariant);
      setMessage('Đã lưu phiên bản.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleVariantUpdate(variant) {
    setMessage('');
    setError('');

    try {
      const payload = {
        sku: String(variant.sku || '').trim(),
        size: String(variant.size || '').trim(),
        color: String(variant.color || '').trim(),
        stockQuantity: Number(variant.stockQuantity),
        discountPercent: Number(variant.discountPercent || 0)
      };
      const data = await apiClient.patch(`/api/admin/variants/${variant.id}`, payload, { token });
      setVariants((current) => current.map((candidate) => (candidate.id === variant.id ? data.variant : candidate)));
      setMessage('Đã lưu phiên bản.');
    } catch (err) {
      setError(err.message);
    }
  }

  if (status === 'loading') {
    return <p className="muted">Đang tải sản phẩm...</p>;
  }

  return (
    <section className="admin-page" aria-labelledby="admin-product-form-title">
      <div className="section-heading">
        <div>
          <h1 id="admin-product-form-title">{pageTitle}</h1>
          <p>Điền đầy đủ thông tin danh mục và tồn kho để bán trên cửa hàng.</p>
        </div>
        <Link className="button-secondary" to="/admin/products">
          Quay lại sản phẩm
        </Link>
      </div>
      {status === 'error' ? <p className="form-error">{error}</p> : null}
      {message ? <p className="success-message">{message}</p> : null}
      {error && status !== 'error' ? <p className="form-error">{error}</p> : null}

      <form className="admin-form" onSubmit={handleSubmit}>
        <label>
          Tên sản phẩm
          <input name="name" required value={form.name} onChange={updateField} />
        </label>
        <label className="admin-form__wide">
          Mô tả
          <textarea name="description" required value={form.description} onChange={updateField} />
        </label>
        <label>
          Thương hiệu
          <input name="brand" required value={form.brand} onChange={updateField} />
        </label>
        <label>
          Danh mục
          <select name="category" required value={form.category} onChange={updateField}>
            <option value="">Chọn danh mục</option>
            {categoryOptions.map((category) => (
              <option value={category.slug} key={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <label>
          Giới tính
          <select name="gender" value={form.gender} onChange={updateField}>
            <option value="men">{genderLabel('men')}</option>
            <option value="women">{genderLabel('women')}</option>
            <option value="unisex">{genderLabel('unisex')}</option>
          </select>
        </label>
        <label>
          Giá
          <input name="price" type="number" min="0" step="1000" required value={form.price} onChange={updateField} />
        </label>
        <label>
          Trạng thái
          <select name="status" value={form.status} onChange={updateField}>
            <option value="active">{productStatusLabel('active')}</option>
            <option value="hidden">{productStatusLabel('hidden')}</option>
          </select>
        </label>
        <label className="admin-check">
          <input name="featured" type="checkbox" checked={form.featured} onChange={updateField} />
          Nổi bật
        </label>
        <div className="admin-form__actions">
          <button type="submit">Lưu sản phẩm</button>
        </div>
      </form>

      <section className="admin-subsection" aria-labelledby="product-images-title">
        <div className="section-heading"><h2 id="product-images-title">Hình ảnh sản phẩm</h2></div>
        <p className="muted">Ảnh sẽ được tải lên Cloudinary sau khi lưu sản phẩm.</p>
        <label className="admin-upload-field">
          Chọn ảnh
          <input type="file" accept="image/*" multiple onChange={(event) => setImageFiles(Array.from(event.target.files || []))} />
        </label>
        {imageFiles.length ? <p className="muted">Đã chọn {imageFiles.length} ảnh chờ tải lên.</p> : null}
        {images.length ? (
          <div className="admin-image-grid">
            {images.map((image) => <img key={image.id} src={image.imageUrl} alt={image.altText} />)}
          </div>
        ) : null}
      </section>

      <section className="admin-subsection" aria-labelledby="variant-section-title">
        <div className="section-heading">
          <h2 id="variant-section-title">Phiên bản sản phẩm</h2>
        </div>
        {canManageVariants ? (
          <>
            <form className="admin-form admin-form--compact" onSubmit={handleVariantSubmit}>
              <label>
                SKU
                <input name="sku" required value={variantForm.sku} onChange={updateVariantField} />
              </label>
              <label>
                Size
                <input name="size" required value={variantForm.size} onChange={updateVariantField} />
              </label>
              <label>
                Màu
                <input name="color" required value={variantForm.color} onChange={updateVariantField} />
              </label>
              <label>
                Tồn kho
                <input
                  name="stockQuantity"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={variantForm.stockQuantity}
                  onChange={updateVariantField}
                />
              </label>
              <label>
                % giảm giá
                <input
                  name="discountPercent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={variantForm.discountPercent}
                  onChange={updateVariantField}
                />
              </label>
              <div className="admin-form__actions">
                <button type="submit">Thêm phiên bản</button>
              </div>
            </form>
            <div className="admin-table-wrap">
              <table aria-label="Phiên bản sản phẩm" className="admin-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Size</th>
                    <th>Màu</th>
                    <th>Tồn kho</th>
                    <th>% giảm giá</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((variant) => (
                    <tr key={variant.id}>
                      <td>
                        <input
                          aria-label={`SKU cho ${variant.sku}`}
                          value={variant.sku}
                          onChange={(event) => updateExistingVariantField(variant.id, 'sku', event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`Size cho ${variant.sku}`}
                          value={variant.size}
                          onChange={(event) => updateExistingVariantField(variant.id, 'size', event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`Màu cho ${variant.sku}`}
                          value={variant.color}
                          onChange={(event) => updateExistingVariantField(variant.id, 'color', event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`Tồn kho cho ${variant.sku}`}
                          type="number"
                          min="0"
                          step="1"
                          value={variant.stockQuantity}
                          onChange={(event) => updateExistingVariantField(variant.id, 'stockQuantity', event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`% giảm giá cho ${variant.sku}`}
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={variant.discountPercent}
                          onChange={(event) => updateExistingVariantField(variant.id, 'discountPercent', event.target.value)}
                        />
                      </td>
                      <td>
                        <button type="button" onClick={() => handleVariantUpdate(variant)}>
                          Lưu {variant.sku}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="muted">Lưu sản phẩm trước khi thêm phiên bản.</p>
        )}
      </section>
    </section>
  );
}
