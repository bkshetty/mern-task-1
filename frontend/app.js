// Determine API Base URL dynamically
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http')) {
    if (window.location.port === '5001') {
      return window.location.origin;
    }
  }
  return 'http://localhost:5001';
};

const API_BASE = getApiBaseUrl();
const ITEMS_API = `${API_BASE}/items`;
const HEALTH_API = `${API_BASE}/health`;

// DOM Elements
const itemForm = document.getElementById('item-form');
const editItemIdInput = document.getElementById('edit-item-id');
const itemNameInput = document.getElementById('item-name');
const itemPriceInput = document.getElementById('item-price');
const submitBtn = document.getElementById('submit-btn');
const submitBtnText = document.getElementById('submit-btn-text');
const cancelBtn = document.getElementById('cancel-btn');
const resetBtn = document.getElementById('reset-btn');
const formTitle = document.getElementById('form-title');
const formDesc = document.getElementById('form-desc');
const formModeEyebrow = document.getElementById('form-mode-eyebrow');

const itemsTableBody = document.getElementById('items-table-body');
const itemCountBadge = document.getElementById('item-count-badge');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');
const refreshBtn = document.getElementById('refresh-btn');
const filterInput = document.getElementById('filter-input');

// Bento KPI Metrics
const kpiTotalItems = document.getElementById('kpi-total-items');
const kpiTotalValue = document.getElementById('kpi-total-value');
const kpiAvgPrice = document.getElementById('kpi-avg-price');

// Navigation Status
const apiStatusBadge = document.getElementById('api-status-badge');
const apiStatusLabel = document.getElementById('api-status-label');
const toastShelf = document.getElementById('toast-shelf');

// Delete Modal Elements
const deleteModal = document.getElementById('delete-modal');
const modalDeleteMessage = document.getElementById('modal-delete-message');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalConfirmDeleteBtn = document.getElementById('modal-confirm-delete-btn');

// State
let itemsList = [];
let pendingDeleteId = null;
let pendingDeleteName = '';

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  checkBackendHealth();
  loadItems();
  setupEventListeners();
  checkUrlPreviewState();
});

// Setup event listeners
function setupEventListeners() {
  itemForm.addEventListener('submit', handleFormSubmit);
  cancelBtn.addEventListener('click', resetForm);
  resetBtn.addEventListener('click', resetForm);

  refreshBtn.addEventListener('click', () => {
    checkBackendHealth();
    loadItems();
  });

  if (filterInput) {
    filterInput.addEventListener('input', () => {
      renderItemsTable(filterInput.value.trim().toLowerCase());
    });
  }

  // Modal actions
  modalCancelBtn.addEventListener('click', closeDeleteModal);
  modalConfirmDeleteBtn.addEventListener('click', executeConfirmedDelete);

  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeleteModal();
  });

  // Smooth scroll links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href').substring(1);
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

// Check backend connectivity
async function checkBackendHealth() {
  try {
    const res = await fetch(HEALTH_API);
    if (res.ok) {
      apiStatusBadge.className = 'status-pill online';
      apiStatusLabel.textContent = 'Online &middot; Port 5001';
    } else {
      throw new Error('Non-200 health check');
    }
  } catch (err) {
    apiStatusBadge.className = 'status-pill offline';
    apiStatusLabel.textContent = 'Server Offline';
  }
}

// Fetch all items (GET /items)
async function loadItems() {
  showLoading(true);
  try {
    const response = await fetch(ITEMS_API);
    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }
    const data = await response.json();
    itemsList = Array.isArray(data) ? data : (data.data || []);
    renderItemsTable();
    updateKpis();
  } catch (error) {
    console.error('Error fetching items:', error);
    showToast(`Failed to load items: ${error.message}`, 'error');
    renderItemsTable();
    updateKpis();
  } finally {
    showLoading(false);
  }
}

// Render items into the HTML table matching Apple design specifications
function renderItemsTable(searchTerm = '') {
  itemsTableBody.innerHTML = '';

  const filtered = searchTerm
    ? itemsList.filter((item) =>
        item.name.toLowerCase().includes(searchTerm) || String(item.id).includes(searchTerm)
      )
    : itemsList;

  itemCountBadge.textContent = `${itemsList.length} item${itemsList.length === 1 ? '' : 's'}`;

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  filtered.forEach((item) => {
    const tr = document.createElement('tr');
    tr.id = `item-row-${item.id}`;

    const formattedPrice = typeof item.price === 'number'
      ? `$${item.price.toFixed(2)}`
      : `$${item.price}`;

    tr.innerHTML = `
      <td class="col-id">
        <span class="id-badge">${item.id}</span>
      </td>
      <td class="col-name">${escapeHtml(item.name)}</td>
      <td class="col-price">${formattedPrice}</td>
      <td class="col-action">
        <div class="action-cluster">
          <button class="btn-action-pill btn-action-edit" data-id="${item.id}" type="button">Edit</button>
          <button class="btn-action-pill btn-action-delete" data-id="${item.id}" type="button">Delete</button>
        </div>
      </td>
    `;

    // Attach event listeners
    const editBtn = tr.querySelector('.btn-action-edit');
    const deleteBtn = tr.querySelector('.btn-action-delete');

    editBtn.addEventListener('click', () => startEdit(item));
    deleteBtn.addEventListener('click', () => openDeleteModal(item.id, item.name));

    itemsTableBody.appendChild(tr);
  });
}

// Update Bento KPIs
function updateKpis() {
  const count = itemsList.length;
  const totalVal = itemsList.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  const avgVal = count > 0 ? totalVal / count : 0;

  if (kpiTotalItems) kpiTotalItems.textContent = count;
  if (kpiTotalValue) kpiTotalValue.textContent = `$${totalVal.toFixed(2)}`;
  if (kpiAvgPrice) kpiAvgPrice.textContent = `$${avgVal.toFixed(2)}`;
}

// Handle Form Submit: Create (POST /items) or Update (PUT /items/:id)
async function handleFormSubmit(e) {
  e.preventDefault();

  const name = itemNameInput.value.trim();
  const priceValue = itemPriceInput.value.trim();

  if (!name) {
    showToast('Product name is required.', 'error');
    itemNameInput.focus();
    return;
  }

  if (!priceValue || isNaN(Number(priceValue)) || Number(priceValue) < 0) {
    showToast('Please enter a valid numeric price.', 'error');
    itemPriceInput.focus();
    return;
  }

  const price = parseFloat(Number(priceValue).toFixed(2));
  const editId = editItemIdInput.value;

  submitBtn.disabled = true;

  try {
    if (editId) {
      // UPDATE: PUT /items/:id
      const res = await fetch(`${ITEMS_API}/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, price }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Update failed with status ${res.status}`);
      }

      showToast(`Item #${editId} updated successfully.`, 'success');
    } else {
      // CREATE: POST /items
      const res = await fetch(ITEMS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, price }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Create failed with status ${res.status}`);
      }

      const created = await res.json();
      showToast(`Item #${created.id} "${created.name}" created successfully.`, 'success');
    }

    resetForm();
    await loadItems();
  } catch (error) {
    console.error('Form submission error:', error);
    showToast(error.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

// Switch form to Edit Mode (Figure 4)
function startEdit(item) {
  editItemIdInput.value = item.id;
  itemNameInput.value = item.name;
  itemPriceInput.value = item.price;

  formModeEyebrow.textContent = 'Editing Mode';
  formTitle.textContent = `Update Item #${item.id}`;
  formDesc.textContent = `Modify the details for "${item.name}" and click Update Item.`;
  submitBtnText.textContent = 'Update Item';
  cancelBtn.classList.remove('hidden');

  const formSection = document.getElementById('form-section');
  if (formSection) {
    formSection.scrollIntoView({ behavior: 'smooth' });
  }
  itemNameInput.focus();
}

// Reset form to Add Mode
function resetForm() {
  editItemIdInput.value = '';
  itemForm.reset();
  formModeEyebrow.textContent = 'Inventory Entry';
  formTitle.textContent = 'Add Item to Catalog';
  formDesc.textContent = 'Provide the product name and unit price. All fields are instantly validated and synced.';
  submitBtnText.textContent = 'Submit';
  cancelBtn.classList.add('hidden');
}

// Open Delete Confirmation Modal (Figure 5)
function openDeleteModal(id, name) {
  pendingDeleteId = id;
  pendingDeleteName = name;
  modalDeleteMessage.textContent = `Are you sure you want to delete "${name}" (ID #${id}) from the catalog?`;
  deleteModal.classList.remove('hidden');
}

function closeDeleteModal() {
  deleteModal.classList.add('hidden');
  pendingDeleteId = null;
  pendingDeleteName = '';
}

async function executeConfirmedDelete() {
  if (!pendingDeleteId) return;

  const id = pendingDeleteId;
  const name = pendingDeleteName;
  closeDeleteModal();

  try {
    const res = await fetch(`${ITEMS_API}/${id}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `Delete failed with status ${res.status}`);
    }

    showToast(`"${name}" removed from inventory.`, 'success');
    await loadItems();
  } catch (error) {
    console.error('Error deleting item:', error);
    showToast(`Delete failed: ${error.message}`, 'error');
  }
}

// Helper: Show/hide loading indicator
function showLoading(isLoading) {
  if (isLoading) {
    loadingState.classList.remove('hidden');
  } else {
    loadingState.classList.add('hidden');
  }
}

// Helper: Apple Toast notification
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `apple-toast ${type}`;
  toast.innerHTML = `
    <span class="toast-dot" style="width: 8px; height: 8px; border-radius: 50%; background: ${type === 'error' ? '#FF3B30' : '#34C759'};"></span>
    <span>${escapeHtml(message)}</span>
  `;

  toastShelf.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

// Helper: Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Development & Screenshot State Previews (triggered via ?state=fig1..fig5)
function checkUrlPreviewState() {
  const params = new URLSearchParams(window.location.search);
  const state = params.get('state');
  if (!state) return;

  if (state === 'fig1') {
    // Figure 1: Starting Phase (empty inventory)
    itemsList = [];
    renderItemsTable();
    updateKpis();
    if (apiStatusBadge) {
      apiStatusBadge.className = 'status-pill online';
      apiStatusLabel.textContent = 'Online · Port 5001';
    }
  } else if (state === 'fig2') {
    // Figure 2: While Adding Items (form filled with Notebook, 50)
    itemsList = [];
    renderItemsTable();
    updateKpis();
    itemNameInput.value = 'Notebook';
    itemPriceInput.value = '50';
    if (apiStatusBadge) {
      apiStatusBadge.className = 'status-pill online';
      apiStatusLabel.textContent = 'Online · Port 5001';
    }
  } else if (state === 'fig3') {
    // Figure 3: Items Added (ID 1, Notebook, 50)
    itemsList = [{ id: 1, name: 'Notebook', price: 50 }];
    renderItemsTable();
    updateKpis();
    showToast('Item #1 "Notebook" created successfully.', 'success');
    if (apiStatusBadge) {
      apiStatusBadge.className = 'status-pill online';
      apiStatusLabel.textContent = 'Online · Port 5001';
    }
  } else if (state === 'fig4') {
    // Figure 4: Updating Item Price (Edit mode with price 60)
    itemsList = [{ id: 1, name: 'Notebook', price: 50 }];
    renderItemsTable();
    updateKpis();
    startEdit({ id: 1, name: 'Notebook', price: 60 });
    if (apiStatusBadge) {
      apiStatusBadge.className = 'status-pill online';
      apiStatusLabel.textContent = 'Online · Port 5001';
    }
  } else if (state === 'fig5') {
    // Figure 5: Deleting Items from List (Delete confirmation modal open)
    itemsList = [{ id: 1, name: 'Notebook', price: 60 }];
    renderItemsTable();
    updateKpis();
    openDeleteModal(1, 'Notebook');
    if (apiStatusBadge) {
      apiStatusBadge.className = 'status-pill online';
      apiStatusLabel.textContent = 'Online · Port 5001';
    }
  }
}

