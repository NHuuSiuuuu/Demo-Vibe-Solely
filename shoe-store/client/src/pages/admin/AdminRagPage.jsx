import { useEffect, useMemo, useState } from 'react';
import { CircleAlert, Database, FileText, Image as ImageIcon, PackageSearch, RefreshCcw, Search, Sparkles } from 'lucide-react';
import { apiClient } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';

const emptyOverview = {
  available: true,
  geminiConfigured: false,
  pgvectorAvailable: false,
  documentCount: 0,
  chunkCount: 0,
  needsReindexCount: 0,
  documentCountsByStatus: { active: 0, hidden: 0, needsReindex: 0 },
  chunkCountsBySourceType: { document: 0, product: 0 },
  indexedProductCount: 0,
  staleProductCount: 0,
  lastIndexedAt: null
};

const emptyImageOverview = {
  totalImages: 0,
  indexedCount: 0,
  errorCount: 0,
  needsReindexCount: 0,
  model: '',
  dimension: 0,
  lastIndexedAt: null
};

const emptyDocumentForm = {
  title: '',
  slug: '',
  documentType: 'general',
  status: 'active',
  content: ''
};

const documentTypeOptions = [
  { value: 'ordering', label: 'Đặt hàng' },
  { value: 'payment', label: 'Thanh toán' },
  { value: 'shipping', label: 'Vận chuyển' },
  { value: 'returns', label: 'Đổi trả' },
  { value: 'warranty', label: 'Bảo hành' },
  { value: 'terms', label: 'Điều khoản' },
  { value: 'size_guide', label: 'Hướng dẫn size' },
  { value: 'general', label: 'Chính sách chung' }
];

const statusOptions = [
  { value: 'active', label: 'Đang dùng' },
  { value: 'needs_reindex', label: 'Cần reindex' },
  { value: 'hidden', label: 'Ẩn' }
];

function documentTypeLabel(value) {
  return documentTypeOptions.find((option) => option.value === value)?.label || value;
}

function statusLabel(value) {
  return statusOptions.find((option) => option.value === value)?.label || value;
}

function formatDateTime(value) {
  if (!value) return 'Chưa index';

  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}

function createSlug(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function AdminRagPage() {
  const { token } = useAuth();
  const [overview, setOverview] = useState(emptyOverview);
  const [documents, setDocuments] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [documentForm, setDocumentForm] = useState(emptyDocumentForm);
  const [editingDocumentId, setEditingDocumentId] = useState(null);
  const [documentActionId, setDocumentActionId] = useState(null);
  const [isSavingDocument, setIsSavingDocument] = useState(false);
  const [isReindexingAll, setIsReindexingAll] = useState(false);
  const [productReindexId, setProductReindexId] = useState('');
  const [isReindexingProduct, setIsReindexingProduct] = useState(false);
  const [imageOverview, setImageOverview] = useState(emptyImageOverview);
  const [imageStatus, setImageStatus] = useState('loading');
  const [imageError, setImageError] = useState('');
  const [imageNotice, setImageNotice] = useState('');
  const [isReindexingImages, setIsReindexingImages] = useState(false);
  const [imageProductReindexId, setImageProductReindexId] = useState('');
  const [isReindexingProductImages, setIsReindexingProductImages] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testStatus, setTestStatus] = useState('idle');
  const [testResult, setTestResult] = useState(null);
  const [testError, setTestError] = useState('');

  const sortedDocuments = useMemo(
    () => [...documents].sort((first, second) => new Date(second.updatedAt || 0) - new Date(first.updatedAt || 0)),
    [documents]
  );
  const unindexedImageCount = Math.max(
    Number(imageOverview.totalImages || 0)
      - Number(imageOverview.indexedCount || 0)
      - Number(imageOverview.needsReindexCount || 0)
      - Number(imageOverview.errorCount || 0),
    0
  );
  const isImageReindexing = isReindexingImages || isReindexingProductImages;

  async function loadRagData({ silent = false } = {}) {
    if (!silent) setStatus('loading');
    setError('');

    try {
      const [overviewData, documentsData] = await Promise.all([
        apiClient.get('/api/admin/rag/overview', { token }),
        apiClient.get('/api/admin/rag/documents', { token })
      ]);
      setOverview(overviewData.overview || emptyOverview);
      setDocuments(documentsData.documents || []);
      setStatus('ready');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }

  async function loadImageOverview({ silent = false } = {}) {
    if (!silent) setImageStatus('loading');
    setImageError('');

    try {
      const data = await apiClient.get('/api/admin/rag/image-overview', { token });
      setImageOverview(data.overview || emptyImageOverview);
      setImageStatus('ready');
    } catch (err) {
      setImageError(err.message);
      setImageStatus('error');
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadRag() {
      setStatus('loading');
      setError('');

      try {
        const [overviewData, documentsData] = await Promise.all([
          apiClient.get('/api/admin/rag/overview', { token }),
          apiClient.get('/api/admin/rag/documents', { token })
        ]);
        if (!cancelled) {
          setOverview(overviewData.overview || emptyOverview);
          setDocuments(documentsData.documents || []);
          setStatus('ready');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setStatus('error');
        }
      }
    }

    async function loadImages() {
      setImageStatus('loading');
      setImageError('');

      try {
        const data = await apiClient.get('/api/admin/rag/image-overview', { token });
        if (!cancelled) {
          setImageOverview(data.overview || emptyImageOverview);
          setImageStatus('ready');
        }
      } catch (err) {
        if (!cancelled) {
          setImageError(err.message);
          setImageStatus('error');
        }
      }
    }

    loadRag();
    loadImages();

    return () => {
      cancelled = true;
    };
  }, [token]);

  function updateDocumentField(field, value) {
    setDocumentForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'title' && !editingDocumentId ? { slug: createSlug(value) } : {})
    }));
  }

  function startEditing(document) {
    setEditingDocumentId(document.id);
    setDocumentForm({
      title: document.title || '',
      slug: document.slug || '',
      documentType: document.documentType || 'general',
      status: document.status || 'active',
      content: document.content || ''
    });
    setNotice('');
    setError('');
  }

  function resetDocumentForm() {
    setEditingDocumentId(null);
    setDocumentForm(emptyDocumentForm);
  }

  async function handleDocumentSubmit(event) {
    event.preventDefault();
    setIsSavingDocument(true);
    setNotice('');
    setError('');

    try {
      const payload = {
        title: documentForm.title,
        slug: documentForm.slug,
        documentType: documentForm.documentType,
        status: documentForm.status,
        content: documentForm.content
      };
      const data = editingDocumentId
        ? await apiClient.put(`/api/admin/rag/documents/${editingDocumentId}`, payload, { token })
        : await apiClient.post('/api/admin/rag/documents', payload, { token });
      const savedDocument = data.document;

      setDocuments((current) => {
        if (editingDocumentId) {
          return current.map((document) => (document.id === savedDocument.id ? savedDocument : document));
        }

        return [savedDocument, ...current];
      });
      resetDocumentForm();
      setNotice(editingDocumentId ? 'Đã cập nhật tài liệu tri thức.' : 'Đã thêm tài liệu tri thức.');
      await loadRagData({ silent: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSavingDocument(false);
    }
  }

  async function handleDeleteDocument(documentId) {
    setDocumentActionId(documentId);
    setNotice('');
    setError('');

    try {
      await apiClient.delete(`/api/admin/rag/documents/${documentId}`, { token });
      setDocuments((current) => current.filter((document) => document.id !== documentId));
      if (editingDocumentId === documentId) resetDocumentForm();
      setNotice('Đã xóa tài liệu tri thức.');
      await loadRagData({ silent: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setDocumentActionId(null);
    }
  }

  async function handleReindexAll() {
    setIsReindexingAll(true);
    setNotice('');
    setError('');

    try {
      await apiClient.post('/api/admin/rag/reindex', {}, { token });
      setNotice('Đã gửi yêu cầu reindex toàn bộ kho tri thức.');
      await loadRagData({ silent: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsReindexingAll(false);
    }
  }

  async function handleReindexDocument(documentId) {
    setDocumentActionId(documentId);
    setNotice('');
    setError('');

    try {
      await apiClient.post(`/api/admin/rag/documents/${documentId}/reindex`, {}, { token });
      setNotice('Đã reindex tài liệu tri thức.');
      await loadRagData({ silent: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setDocumentActionId(null);
    }
  }

  async function handleReindexProduct(event) {
    event.preventDefault();
    const productId = productReindexId.trim();
    if (!productId) return;

    setIsReindexingProduct(true);
    setNotice('');
    setError('');

    try {
      await apiClient.post(`/api/admin/rag/products/${productId}/reindex`, {}, { token });
      setNotice(`Đã reindex sản phẩm #${productId}.`);
      await loadRagData({ silent: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsReindexingProduct(false);
    }
  }

  async function handleReindexAllImages() {
    setIsReindexingImages(true);
    setImageNotice('');
    setImageError('');

    try {
      const data = await apiClient.post('/api/admin/rag/images/reindex', {}, { token });
      const indexed = Number(data.summary?.indexed || 0);
      const failed = Number(data.summary?.failed || 0);
      setImageNotice(`Đã reindex ảnh: ${indexed} thành công, ${failed} lỗi.`);
      await loadImageOverview({ silent: true });
    } catch (err) {
      setImageError(err.message);
    } finally {
      setIsReindexingImages(false);
    }
  }

  async function handleReindexProductImages(event) {
    event.preventDefault();
    const productId = imageProductReindexId.trim();
    if (!productId) return;

    setIsReindexingProductImages(true);
    setImageNotice('');
    setImageError('');

    try {
      const data = await apiClient.post(`/api/admin/rag/products/${productId}/image-reindex`, {}, { token });
      const indexed = Number(data.summary?.indexed || 0);
      const failed = Number(data.summary?.failed || 0);
      setImageNotice(`Đã reindex ảnh sản phẩm #${productId}: ${indexed} thành công, ${failed} lỗi.`);
      await loadImageOverview({ silent: true });
    } catch (err) {
      setImageError(err.message);
    } finally {
      setIsReindexingProductImages(false);
    }
  }

  async function handleTestSubmit(event) {
    event.preventDefault();
    const message = testMessage.trim();
    if (!message) return;

    setTestStatus('loading');
    setTestResult(null);
    setTestError('');

    try {
      const data = await apiClient.post('/api/admin/rag/test', { message }, { token });
      setTestResult(data);
      setTestStatus('ready');
    } catch (err) {
      setTestError(err.message);
      setTestStatus('error');
    }
  }

  return (
    <section className="admin-page admin-rag-page" aria-labelledby="admin-rag-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">RAG / Gemini</p>
          <h1 id="admin-rag-title">Kho tri thức AI</h1>
          <p>Quản lý chính sách, trạng thái index và kiểm thử câu trả lời trước khi trợ lý tư vấn dùng trong storefront.</p>
        </div>
        <button type="button" className="button-secondary" onClick={handleReindexAll} disabled={isReindexingAll}>
          <RefreshCcw size={16} aria-hidden="true" />
          {isReindexingAll ? 'Đang reindex...' : 'Reindex toàn bộ'}
        </button>
      </div>

      {status === 'loading' ? <p className="muted">Đang tải kho tri thức...</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="form-success">{notice}</p> : null}

      <section className="admin-subsection" aria-labelledby="rag-overview-title">
        <div className="admin-panel-heading">
          <h2 id="rag-overview-title">Tổng quan tri thức</h2>
        </div>
        <div className="rag-admin-grid">
          <StatusCard icon={Sparkles} label="Gemini" value={overview.geminiConfigured ? 'Đã cấu hình' : 'Chưa cấu hình'} tone={overview.geminiConfigured ? 'green' : 'orange'} />
          <StatusCard icon={Database} label="pgvector" value={overview.pgvectorAvailable ? 'Sẵn sàng' : 'Chưa sẵn sàng'} tone={overview.pgvectorAvailable ? 'green' : 'orange'} />
          <StatusCard icon={FileText} label="Tài liệu" value={overview.documentCount} tone="blue" />
          <StatusCard icon={Database} label="Chunks đang dùng" value={overview.chunkCount} tone="green" />
          <StatusCard icon={RefreshCcw} label="Cần reindex" value={overview.needsReindexCount} tone={overview.needsReindexCount ? 'orange' : 'blue'} />
        </div>
        {!overview.available && overview.message ? <p className="form-error">{overview.message}</p> : null}
        <div className="rag-overview-details" aria-label="Chi tiết trạng thái RAG">
          <span>Tài liệu: {overview.documentCountsByStatus?.active || 0} đang dùng, {overview.documentCountsByStatus?.needsReindex || 0} cần reindex, {overview.documentCountsByStatus?.hidden || 0} ẩn</span>
          <span>Chunks: {overview.chunkCountsBySourceType?.document || 0} chính sách, {overview.chunkCountsBySourceType?.product || 0} sản phẩm</span>
          <span>Index gần nhất: {formatDateTime(overview.lastIndexedAt)}</span>
        </div>
      </section>

      <section className="admin-subsection rag-product-index-panel" aria-labelledby="rag-products-title">
        <div className="admin-panel-heading">
          <h2 id="rag-products-title">Sản phẩm</h2>
        </div>
        <div className="rag-admin-grid rag-admin-grid--compact">
          <StatusCard icon={PackageSearch} label="Đã index" value={overview.indexedProductCount || 0} tone="green" />
          <StatusCard icon={RefreshCcw} label="Cần reindex" value={overview.staleProductCount || 0} tone={overview.staleProductCount ? 'orange' : 'blue'} />
        </div>
        <form className="admin-form rag-product-reindex-form" onSubmit={handleReindexProduct}>
          <label>
            ID sản phẩm
            <input
              inputMode="numeric"
              pattern="[0-9]+"
              value={productReindexId}
              onChange={(event) => setProductReindexId(event.target.value)}
              placeholder="Ví dụ: 10"
              required
            />
          </label>
          <div className="admin-form__actions">
            <button type="submit" className="button-link" disabled={isReindexingProduct}>
              <RefreshCcw size={16} aria-hidden="true" />
              {isReindexingProduct ? 'Đang reindex...' : 'Reindex sản phẩm'}
            </button>
          </div>
        </form>
      </section>

      <section className="admin-subsection rag-image-index-panel" aria-labelledby="rag-images-title">
        <div className="admin-panel-heading rag-image-index-heading">
          <div>
            <h2 id="rag-images-title">Embedding ảnh sản phẩm</h2>
            <p>Theo dõi ảnh của các sản phẩm đang bán và retry các embedding chưa sẵn sàng.</p>
          </div>
          <button type="button" className="button-secondary" onClick={handleReindexAllImages} disabled={isImageReindexing}>
            <RefreshCcw size={16} aria-hidden="true" />
            {isReindexingImages ? 'Đang reindex ảnh...' : 'Reindex toàn bộ ảnh'}
          </button>
        </div>

        {imageStatus === 'loading' ? <p className="muted">Đang tải trạng thái embedding ảnh...</p> : null}
        {imageError ? <p className="form-error" role="alert">{imageError}</p> : null}
        {imageNotice ? <p className="form-success" role="status">{imageNotice}</p> : null}

        <div className="rag-admin-grid rag-image-status-grid">
          <StatusCard icon={ImageIcon} label="Ảnh sản phẩm đang bán" value={imageOverview.totalImages || 0} tone="blue" />
          <StatusCard icon={Database} label="Đã index" value={imageOverview.indexedCount || 0} tone="green" />
          <StatusCard icon={ImageIcon} label="Chưa index" value={unindexedImageCount} tone={unindexedImageCount ? 'orange' : 'blue'} />
          <StatusCard icon={RefreshCcw} label="Cần reindex" value={imageOverview.needsReindexCount || 0} tone={imageOverview.needsReindexCount ? 'orange' : 'blue'} />
          <StatusCard icon={CircleAlert} label="Lỗi" value={imageOverview.errorCount || 0} tone={imageOverview.errorCount ? 'red' : 'blue'} />
        </div>

        <div className="rag-overview-details" aria-label="Chi tiết embedding ảnh">
          <span>Model: {imageOverview.model ? `${imageOverview.model} · ${imageOverview.dimension} chiều` : 'Chưa có dữ liệu'}</span>
          <span>Index gần nhất: {formatDateTime(imageOverview.lastIndexedAt)}</span>
        </div>

        <form className="admin-form rag-product-reindex-form" onSubmit={handleReindexProductImages}>
          <label>
            ID sản phẩm
            <input
              inputMode="numeric"
              pattern="[0-9]+"
              value={imageProductReindexId}
              onChange={(event) => setImageProductReindexId(event.target.value)}
              placeholder="Ví dụ: 10"
              required
            />
          </label>
          <div className="admin-form__actions">
            <button type="submit" className="button-link" disabled={isImageReindexing}>
              <RefreshCcw size={16} aria-hidden="true" />
              {isReindexingProductImages ? 'Đang reindex ảnh...' : 'Reindex ảnh sản phẩm'}
            </button>
          </div>
        </form>
      </section>

      <div className="rag-admin-layout">
        <section className="admin-subsection" aria-labelledby="rag-documents-title">
          <div className="admin-panel-heading">
            <h2 id="rag-documents-title">Chính sách</h2>
          </div>
          <form className="admin-form rag-document-form" onSubmit={handleDocumentSubmit}>
            <label>
              Tiêu đề
              <input value={documentForm.title} onChange={(event) => updateDocumentField('title', event.target.value)} required />
            </label>
            <label>
              Slug
              <input value={documentForm.slug} onChange={(event) => updateDocumentField('slug', event.target.value)} required />
            </label>
            <label>
              Loại tài liệu
              <select value={documentForm.documentType} onChange={(event) => updateDocumentField('documentType', event.target.value)}>
                {documentTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Trạng thái
              <select value={documentForm.status} onChange={(event) => updateDocumentField('status', event.target.value)}>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-form__wide">
              Nội dung
              <textarea value={documentForm.content} onChange={(event) => updateDocumentField('content', event.target.value)} rows="7" required />
            </label>
            <div className="admin-form__actions admin-form__wide">
              <button type="submit" className="button-link" disabled={isSavingDocument}>
                {isSavingDocument ? 'Đang lưu...' : editingDocumentId ? 'Cập nhật tài liệu' : 'Thêm tài liệu'}
              </button>
              {editingDocumentId ? (
                <button type="button" className="button-secondary" onClick={resetDocumentForm}>
                  Hủy sửa
                </button>
              ) : null}
            </div>
          </form>

          <div className="rag-document-list">
            {sortedDocuments.map((document) => (
              <article className="rag-document-card" key={document.id}>
                <div>
                  <strong>{document.title}</strong>
                  <span>{documentTypeLabel(document.documentType)} · {statusLabel(document.status)}</span>
                  <p>{document.content}</p>
                  <small>Index gần nhất: {formatDateTime(document.lastIndexedAt)}</small>
                </div>
                <div className="rag-document-actions">
                  <button type="button" className="button-secondary" onClick={() => startEditing(document)}>
                    Sửa
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={documentActionId === document.id}
                    onClick={() => handleReindexDocument(document.id)}
                  >
                    Reindex
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    disabled={documentActionId === document.id}
                    onClick={() => handleDeleteDocument(document.id)}
                  >
                    Xóa
                  </button>
                </div>
              </article>
            ))}
            {status === 'ready' && sortedDocuments.length === 0 ? <p className="muted">Chưa có tài liệu chính sách.</p> : null}
          </div>
        </section>

        <section className="admin-subsection rag-test-panel" aria-labelledby="rag-test-title">
          <div className="admin-panel-heading">
            <h2 id="rag-test-title">Kiểm thử truy vấn</h2>
          </div>
          <form className="admin-form rag-test-form" onSubmit={handleTestSubmit}>
            <label className="admin-form__wide">
              Câu hỏi
              <textarea
                value={testMessage}
                onChange={(event) => setTestMessage(event.target.value)}
                placeholder="Ví dụ: Chính sách đổi trả giày như thế nào?"
                rows="5"
                required
              />
            </label>
            <div className="admin-form__actions admin-form__wide">
              <button type="submit" className="button-link" disabled={testStatus === 'loading'}>
                <Search size={16} aria-hidden="true" />
                {testStatus === 'loading' ? 'Đang kiểm thử...' : 'Gửi truy vấn'}
              </button>
            </div>
          </form>
          {testError ? <p className="form-error">{testError}</p> : null}
          {testResult ? (
            <div className="rag-answer-panel">
              <h3>Câu trả lời</h3>
              <p>{testResult.answer}</p>
              <h3>Nguồn</h3>
              <div className="rag-source-list">
                {(testResult.chunks?.length ? testResult.chunks : testResult.sources || []).map((source, index) => (
                  <article key={`${source.sourceType || source.type || 'source'}-${source.sourceId || source.id || index}`}>
                    <strong>{source.title || source.name || 'Nguồn tri thức'}</strong>
                    <span>
                      {source.sourceType || source.type || 'knowledge'} #{source.sourceId || source.id || index + 1}
                    </span>
                    {source.content ? <p>{source.content}</p> : null}
                  </article>
                ))}
                {!testResult.chunks?.length && !testResult.sources?.length ? <p className="muted">Không có nguồn được trả về.</p> : null}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}

function StatusCard({ icon: Icon, label, value, tone }) {
  return (
    <article className={`rag-status-card rag-status-card--${tone}`}>
      <span>
        <Icon size={18} aria-hidden="true" />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
