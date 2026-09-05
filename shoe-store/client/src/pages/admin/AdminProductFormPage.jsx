import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';

const emptyProduct = {
  slug: '',
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
  priceDelta: '0'
};

function toProductForm(product) {
  return {
    slug: product.slug || '',
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
  const [variantForm, setVariantForm] = useState(emptyVariant);
  const [status, setStatus] = useState(isNew ? 'ready' : 'loading');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
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
          throw new Error('Product not found');
        }
        setProduct(matchedProduct);
        setForm(toProductForm(matchedProduct));
        setVariants(matchedProduct.variants || []);
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

  const pageTitle = isNew ? 'Create product' : 'Edit product';
  const savedProductId = product?.id || id;
  const canManageVariants = Boolean(savedProductId);

  const productPayload = useMemo(
    () => ({
      slug: form.slug.trim(),
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
      setMessage('Product saved.');
      if (isNew) {
        navigate(`/admin/products/${data.product.id}/edit`, { replace: true });
      }
    } catch (err) {
      setError(err.message);
    }
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
        priceDelta: Number(variantForm.priceDelta || 0)
      };
      const data = await apiClient.post(`/api/admin/products/${savedProductId}/variants`, payload, { token });
      setVariants((current) => [...current, data.variant]);
      setVariantForm(emptyVariant);
      setMessage('Variant saved.');
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
        priceDelta: Number(variant.priceDelta || 0)
      };
      const data = await apiClient.patch(`/api/admin/variants/${variant.id}`, payload, { token });
      setVariants((current) => current.map((candidate) => (candidate.id === variant.id ? data.variant : candidate)));
      setMessage('Variant saved.');
    } catch (err) {
      setError(err.message);
    }
  }

  if (status === 'loading') {
    return <p className="muted">Loading product...</p>;
  }

  return (
    <section className="admin-page" aria-labelledby="admin-product-form-title">
      <div className="section-heading">
        <div>
          <h1 id="admin-product-form-title">{pageTitle}</h1>
          <p>Use required catalog fields from the admin API.</p>
        </div>
        <Link className="button-secondary" to="/admin/products">
          Back to products
        </Link>
      </div>
      {status === 'error' ? <p className="form-error">{error}</p> : null}
      {message ? <p className="success-message">{message}</p> : null}
      {error && status !== 'error' ? <p className="form-error">{error}</p> : null}

      <form className="admin-form" onSubmit={handleSubmit}>
        <label>
          Slug
          <input name="slug" required value={form.slug} onChange={updateField} />
        </label>
        <label>
          Name
          <input name="name" required value={form.name} onChange={updateField} />
        </label>
        <label className="admin-form__wide">
          Description
          <textarea name="description" required value={form.description} onChange={updateField} />
        </label>
        <label>
          Brand
          <input name="brand" required value={form.brand} onChange={updateField} />
        </label>
        <label>
          Category
          <input name="category" required value={form.category} onChange={updateField} />
        </label>
        <label>
          Gender
          <select name="gender" value={form.gender} onChange={updateField}>
            <option value="men">men</option>
            <option value="women">women</option>
            <option value="unisex">unisex</option>
          </select>
        </label>
        <label>
          Price
          <input name="price" type="number" min="0" step="0.01" required value={form.price} onChange={updateField} />
        </label>
        <label>
          Status
          <select name="status" value={form.status} onChange={updateField}>
            <option value="active">active</option>
            <option value="hidden">hidden</option>
          </select>
        </label>
        <label className="admin-check">
          <input name="featured" type="checkbox" checked={form.featured} onChange={updateField} />
          Featured
        </label>
        <div className="admin-form__actions">
          <button type="submit">Save product</button>
        </div>
      </form>

      <section className="admin-subsection" aria-labelledby="variant-section-title">
        <div className="section-heading">
          <h2 id="variant-section-title">Variant section</h2>
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
                Color
                <input name="color" required value={variantForm.color} onChange={updateVariantField} />
              </label>
              <label>
                Stock
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
                Price delta
                <input name="priceDelta" type="number" min="0" step="0.01" value={variantForm.priceDelta} onChange={updateVariantField} />
              </label>
              <div className="admin-form__actions">
                <button type="submit">Add variant</button>
              </div>
            </form>
            <div className="admin-table-wrap">
              <table aria-label="Product variants" className="admin-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Size</th>
                    <th>Color</th>
                    <th>Stock</th>
                    <th>Price delta</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((variant) => (
                    <tr key={variant.id}>
                      <td>
                        <input
                          aria-label={`SKU for ${variant.sku}`}
                          value={variant.sku}
                          onChange={(event) => updateExistingVariantField(variant.id, 'sku', event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`Size for ${variant.sku}`}
                          value={variant.size}
                          onChange={(event) => updateExistingVariantField(variant.id, 'size', event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`Color for ${variant.sku}`}
                          value={variant.color}
                          onChange={(event) => updateExistingVariantField(variant.id, 'color', event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`Stock for ${variant.sku}`}
                          type="number"
                          min="0"
                          step="1"
                          value={variant.stockQuantity}
                          onChange={(event) => updateExistingVariantField(variant.id, 'stockQuantity', event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`Price delta for ${variant.sku}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={variant.priceDelta}
                          onChange={(event) => updateExistingVariantField(variant.id, 'priceDelta', event.target.value)}
                        />
                      </td>
                      <td>
                        <button type="button" onClick={() => handleVariantUpdate(variant)}>
                          Save {variant.sku}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="muted">Save product before adding variants.</p>
        )}
      </section>
    </section>
  );
}
