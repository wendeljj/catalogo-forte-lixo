const estado = {
  carrinho: [],
  produtoAtual: null,
  produtos: [],
};

const PEDIDO_MINIMO = 400;
const STORAGE_KEY = 'fortelixo_carrinho_v1';

function salvarCarrinho() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estado.carrinho));
  } catch (e) {
    console.warn('Não foi possível salvar o carrinho:', e);
  }
}

function carregarCarrinho() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) estado.carrinho = parsed;
  } catch (e) {
    console.warn('Não foi possível restaurar o carrinho:', e);
  }
}

const el = id => document.getElementById(id);

const fmt = valor =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const chave = p => p.id != null ? String(p.id) : p.nome;

function mostrarToast(msg, tipo = 'sucesso') {
  const toast = el('toast');
  toast.querySelector('.toast-msg').textContent = msg;
  toast.dataset.tipo = tipo;
  toast.classList.add('visivel');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('visivel'), 2400);
}

function abrirModal(produto) {
  estado.produtoAtual = produto;

  el('modal-img').src = produto.img;
  el('modal-img').alt = produto.nome;
  el('modal-category').textContent = produto.categoria ?? '';
  el('modal-nome').textContent = produto.nome;
  el('modal-preco').textContent = fmt(produto.preco);

  const qty = el('modal-qty');
  qty.value = 1;
  qty.min = 1;

  el('modal-overlay').classList.add('ativo');
  document.body.style.overflow = 'hidden';
}

function fecharModal() {
  el('modal-overlay').classList.remove('ativo');
  estado.produtoAtual = null;
  document.body.style.overflow = '';
}

function alterarQtdModal(delta) {
  const input = el('modal-qty');
  const novo = Math.max(1, (parseInt(input.value) || 1) + delta);
  input.value = novo;
}

function adicionarAoCarrinho(produto, quantidade) {
  if (!produto || quantidade < 1) return;

  const k = chave(produto);
  const ex = estado.carrinho.find(i => chave(i) === k);

  if (ex) {
    ex.quantidade += quantidade;
  } else {
    estado.carrinho.push({ ...produto, quantidade });
  }

  salvarCarrinho();
  atualizarUI();
  mostrarToast(`${produto.nome} adicionado!`);
}

function alterarQtdItem(k, delta) {
  const idx = estado.carrinho.findIndex(i => chave(i) === k);
  if (idx === -1) return;

  estado.carrinho[idx].quantidade += delta;
  if (estado.carrinho[idx].quantidade <= 0) estado.carrinho.splice(idx, 1);

  salvarCarrinho();
  atualizarUI();
}

function setQtdItem(k, valor) {
  const qty = parseInt(valor) || 0;
  const idx = estado.carrinho.findIndex(i => chave(i) === k);
  if (idx === -1) return;

  if (qty <= 0) {
    estado.carrinho.splice(idx, 1);
  } else {
    estado.carrinho[idx].quantidade = qty;
  }

  salvarCarrinho();
  atualizarUI();
}

function limparCarrinho() {
  if (!confirm('Limpar todo o carrinho?')) return;
  estado.carrinho = [];
  salvarCarrinho();
  atualizarUI();
}

const abrirCarrinho = () => {
  el('carrinho-overlay').classList.add('ativo');
  document.body.style.overflow = 'hidden';
};

const fecharCarrinho = () => {
  el('carrinho-overlay').classList.remove('ativo');
  document.body.style.overflow = '';
};

function atualizarBadge() {
  const total = estado.carrinho.reduce((s, i) => s + i.quantidade, 0);
  const badge = el('carrinho-badge');
  badge.textContent = total > 99 ? '99+' : total;
  badge.classList.toggle('visivel', total > 0);
}

function calcularTotal() {
  return estado.carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0);
}

function renderizarCarrinho() {
  const lista = el('carrinho-lista');
  const totalEl = el('carrinho-subtotal-valor');
  const btnWpp = el('btn-enviar-whatsapp');
  const btnClear = el('btn-limpar-carrinho');
  const avisoMin = el('aviso-minimo');

  lista.innerHTML = '';

  if (estado.carrinho.length === 0) {
    lista.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon"><i class="fa-solid fa-basket-shopping"></i></div>
        <p>Carrinho vazio</p>
        <span>Adicione produtos para fazer um pedido</span>
      </div>`;
    totalEl.textContent = 'R$ 0,00';
    btnWpp.disabled = true;
    btnClear.style.display = 'none';
    if (avisoMin) avisoMin.classList.remove('visivel');
    atualizarBarraProgresso(0);
    if (obs) obs.value = '';
    return;
  }

  btnClear.style.display = 'flex';

  let total = 0;
  const frag = document.createDocumentFragment();

  estado.carrinho.forEach(item => {
    const k = chave(item);
    const subtot = item.preco * item.quantidade;
    total += subtot;

    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div class="cart-item-img">
        <img src="${item.img}" alt="${item.nome}" loading="lazy">
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.nome}</div>
        <div class="cart-item-unit">${fmt(item.preco)} / und.</div>
      </div>
      <div class="cart-qty">
        <button class="cart-qty-btn" aria-label="Diminuir">−</button>
        <input
          class="cart-qty-input"
          type="number"
          min="1"
          value="${item.quantidade}"
          aria-label="Quantidade de ${item.nome}"
        >
        <button class="cart-qty-btn" aria-label="Aumentar">+</button>
      </div>
      <div class="cart-item-total">${fmt(subtot)}</div>
    `;

    const [btnM, btnP] = row.querySelectorAll('.cart-qty-btn');
    const input = row.querySelector('.cart-qty-input');

    btnM.addEventListener('click', () => alterarQtdItem(k, -1));
    btnP.addEventListener('click', () => alterarQtdItem(k, 1));
    input.addEventListener('change', e => setQtdItem(k, e.target.value));
    input.addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });

    frag.appendChild(row);
  });

  lista.appendChild(frag);
  totalEl.textContent = fmt(total);

  const atingiuMinimo = total >= PEDIDO_MINIMO;
  btnWpp.disabled = !atingiuMinimo;

  if (avisoMin) {
    if (atingiuMinimo) {
      avisoMin.classList.remove('visivel');
    } else {
      const falta = PEDIDO_MINIMO - total;
      avisoMin.querySelector('.aviso-falta').textContent = fmt(falta);
      avisoMin.classList.add('visivel');
    }
  }

  atualizarBarraProgresso(total);
}

function atualizarBarraProgresso(total) {
  const barra = el('progresso-barra');
  const rotulo = el('progresso-rotulo');
  const wrapper = el('progresso-wrapper');
  if (!barra || !rotulo || !wrapper) return;

  const pct = Math.min(100, (total / PEDIDO_MINIMO) * 100);
  barra.style.width = `${pct}%`;

  if (total >= PEDIDO_MINIMO) {
    wrapper.dataset.estado = 'atingido';
    rotulo.textContent = '✓ Pedido mínimo atingido!';
  } else if (total === 0) {
    wrapper.dataset.estado = 'vazio';
    rotulo.textContent = `Mínimo: ${fmt(PEDIDO_MINIMO)}`;
  } else {
    wrapper.dataset.estado = 'progresso';
    const falta = PEDIDO_MINIMO - total;
    rotulo.textContent = `Faltam ${fmt(falta)} para o mínimo`;
  }
}

function atualizarUI() {
  atualizarBadge();
  renderizarCarrinho();
}

function enviarWhatsApp() {
  if (!estado.carrinho.length) return;

  const total = calcularTotal();
  if (total < PEDIDO_MINIMO) {
    mostrarToast(`Pedido mínimo de ${fmt(PEDIDO_MINIMO)} não atingido.`, 'erro');
    return;
  }

  const numero = '5511964970905';
  let msg = '*Pedido - Forte-Lixo*\n\n';

  estado.carrinho.forEach(i => {
    msg += `• ${i.quantidade}x ${i.nome}\n`;
  });

  window.open(
    `https://api.whatsapp.com/send/?phone=${numero}&text=${encodeURIComponent(msg)}&type=phone_number&app_absent=0`,
    '_blank'
  );
}

function filtrar() {
  const termo = el('pesquisa-input').value.toLowerCase().trim();
  const cat = el('pesquisa-select').value;

  const lista = estado.produtos.filter(p =>
    p.nome.toLowerCase().includes(termo) &&
    (cat === '' || p.categoria === cat)
  );

  renderizarProdutos(lista);
}

function popularSelects() {
  const cats = [...new Set(estado.produtos.map(p => p.categoria))];
  const selects = [el('pesquisa-select'), el('pesquisa-select-mobile')];

  selects.forEach(s => {
    if (!s) return;
    s.innerHTML = '<option value="">Todas</option>';
    cats.forEach(c => {
      const o = document.createElement('option');
      o.value = c; o.textContent = c;
      s.appendChild(o);
    });
  });
}

function renderizarProdutos(lista) {
  const main = el('conteudo-principal');
  main.innerHTML = '';

  if (!lista.length) {
    main.innerHTML = `
      <div class="no-results">
        <i class="fa-solid fa-magnifying-glass"></i>
        <p>Nenhum produto encontrado</p>
        <span>Tente outro termo ou categoria</span>
      </div>`;
    return;
  }

  const grupos = lista.reduce((acc, p) => {
    (acc[p.categoria] ??= []).push(p);
    return acc;
  }, {});

  const frag = document.createDocumentFragment();

  for (const [cat, itens] of Object.entries(grupos)) {
    const hdr = document.createElement('div');
    hdr.className = 'category-header';
    hdr.innerHTML = `
      <span class="category-title">${cat}</span>
      <span class="category-line"></span>
      <span class="category-count">${itens.length} produto${itens.length !== 1 ? 's' : ''}</span>
    `;
    frag.appendChild(hdr);

    const grid = document.createElement('div');
    grid.className = 'product-grid';
    itens.forEach(p => grid.appendChild(criarCard(p)));
    frag.appendChild(grid);
  }

  main.appendChild(frag);
}

function criarCard(produto) {
  const card = document.createElement('div');
  card.className = 'product-card';
  card.innerHTML = `
    <div class="card-img">
      <div class="card-img-inner">
        <img src="${produto.img}" alt="${produto.nome}" loading="lazy">
      </div>
    </div>
    <div class="card-body">
      <span class="card-category">${produto.categoria}</span>
      <h3 class="card-name">${produto.nome}</h3>
      <div class="card-divider"></div>
      <div class="card-price-row">
        <span class="card-price">${fmt(produto.preco)}</span>
        <span class="card-unit">/ ${produto.quantidade}</span>
      </div>
      <button class="card-btn" aria-label="Adicionar ${produto.nome} ao carrinho">
        <i class="fa-solid fa-basket-shopping"></i>
        Adicionar
      </button>
    </div>
  `;

  const btn = card.querySelector('.card-btn');

  btn.addEventListener('click', e => {
    e.stopPropagation();
    abrirModal(produto);
  });

  card.addEventListener('click', e => {
    if (e.target.closest('.card-btn')) return;
    abrirModal(produto);
  });

  return card;
}

function setupSearch() {
  const iD = el('pesquisa-input'), sD = el('pesquisa-select'), bD = el('pesquisa-botao');
  const iM = el('pesquisa-input-mobile'), sM = el('pesquisa-select-mobile'), bM = el('pesquisa-botao-mobile');

  const syncD = () => { if (iM) iM.value = iD.value; if (sM) sM.value = sD.value; filtrar(); };
  const syncM = () => { if (iD) iD.value = iM.value; if (sD) sD.value = sM.value; filtrar(); };

  iD?.addEventListener('input', syncD);
  sD?.addEventListener('change', syncD);
  bD?.addEventListener('click', syncD);
  iM?.addEventListener('input', syncM);
  sM?.addEventListener('change', syncM);
  bM?.addEventListener('click', syncM);
}

function setupModal() {
  el('modal-overlay')?.addEventListener('click', e => {
    if (e.target === el('modal-overlay')) fecharModal();
  });
  el('btn-modal-cancelar')?.addEventListener('click', fecharModal);
  el('btn-modal-adicionar')?.addEventListener('click', () => {
    const qty = Math.max(1, parseInt(el('modal-qty').value) || 1);
    if (estado.produtoAtual) { adicionarAoCarrinho(estado.produtoAtual, qty); fecharModal(); }
  });
  el('qty-menos')?.addEventListener('click', () => alterarQtdModal(-1));
  el('qty-mais')?.addEventListener('click', () => alterarQtdModal(1));
  el('modal-qty')?.addEventListener('change', e => {
    const v = parseInt(e.target.value) || 1;
    e.target.value = Math.max(1, v);
  });
}

function setupCarrinho() {
  el('btn-carrinho-nav')?.addEventListener('click', abrirCarrinho);
  el('btn-fechar-carrinho')?.addEventListener('click', fecharCarrinho);
  el('carrinho-overlay')?.addEventListener('click', e => {
    if (e.target === el('carrinho-overlay')) fecharCarrinho();
  });
  el('btn-enviar-whatsapp')?.addEventListener('click', enviarWhatsApp);
  el('btn-limpar-carrinho')?.addEventListener('click', limparCarrinho);
}

async function init() {
  carregarCarrinho();

  try {
    const res = await fetch('produtos.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    estado.produtos = await res.json();

    popularSelects();
    renderizarProdutos(estado.produtos);
    setupSearch();
    setupModal();
    setupCarrinho();
    atualizarUI();

    if (estado.carrinho.length > 0) {
      const total = estado.carrinho.reduce((s, i) => s + i.quantidade, 0);
      mostrarToast(`🛒 ${total} item${total !== 1 ? 's' : ''} restaurado${total !== 1 ? 's' : ''} do carrinho`);
    }

  } catch (err) {
    console.error('Erro ao carregar produtos:', err);
    el('conteudo-principal').innerHTML = `
      <div class="no-results">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <p>Erro ao carregar produtos</p>
        <span>Tente recarregar a página</span>
      </div>`;
  }
}

document.addEventListener('DOMContentLoaded', init);
